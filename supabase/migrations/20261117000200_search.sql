-- Catalog search RPC.
-- Text matching uses pg_trgm against the title; source/playability filters are
-- enforced in the function while security invoker keeps RLS authoritative.

create index if not exists tracks_bpm_idx on public.tracks (bpm) where bpm is not null;
create index if not exists tracks_created_at_idx on public.tracks (created_at desc);

create or replace function public.search_tracks(
  q text default null,
  genre text default null,
  mood text default null,
  bpm_min integer default null,
  bpm_max integer default null,
  lim integer default 50,
  off integer default 0
)
returns setof public.tracks
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with params as (
    select
      nullif(btrim($1), '') as query,
      nullif(btrim($2), '') as genre_filter,
      nullif(btrim($3), '') as mood_filter,
      $4::integer as bpm_min_filter,
      $5::integer as bpm_max_filter,
      least(greatest(coalesce($6, 50), 1), 100) as page_size,
      greatest(coalesce($7, 0), 0) as page_offset
  )
  select t.*
  from public.tracks t
  cross join params p
  where t.source = 'catalog'
    and t.is_playable = true
    and (p.query is null or t.title operator(extensions.%) p.query)
    and (p.genre_filter is null or lower(t.genre) = lower(p.genre_filter))
    and (p.mood_filter is null or lower(t.mood) = lower(p.mood_filter))
    and (p.bpm_min_filter is null or t.bpm >= p.bpm_min_filter)
    and (p.bpm_max_filter is null or t.bpm <= p.bpm_max_filter)
  order by
    case
      when p.query is null then null
      else extensions.similarity(t.title, p.query)
    end desc nulls last,
    t.created_at desc
  limit (select page_size from params)
  offset (select page_offset from params);
$$;

revoke all on function public.search_tracks(text, text, text, integer, integer, integer, integer) from public;
grant execute on function public.search_tracks(text, text, text, integer, integer, integer, integer)
  to anon, authenticated;
