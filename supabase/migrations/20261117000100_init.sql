-- Duskwave baseline schema
-- Enums, tables, indexes, RLS, RPCs, storage buckets.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_tier as enum ('free', 'premium');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.playlist_kind as enum ('user', 'liked', 'blend', 'import', 'jam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.playlist_visibility as enum ('private', 'public', 'unlisted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.track_source as enum ('catalog', 'upload');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.play_context as enum ('album', 'playlist', 'search', 'blend', 'jam', 'liked', 'history');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_status as enum ('pending', 'fetching', 'matching', 'done', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_match_status as enum ('matched', 'vibe', 'placeholder', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.jam_role as enum ('host', 'guest');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique check (username::text ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar_url text,
  bio text,
  tier public.user_tier not null default 'free',
  premium_since timestamptz,
  history_enabled boolean not null default true,
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix integer := 0;
begin
  base_username := lower(regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(base_username) < 3 then
    base_username := 'listener';
  end if;
  candidate := left(base_username, 20);
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := left(base_username, 16) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', candidate)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  bio text,
  license text,
  license_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists (id) on delete cascade,
  title text not null,
  cover_url text,
  release_year integer,
  license text,
  license_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  artist_id uuid not null references public.artists (id) on delete cascade,
  album_id uuid references public.albums (id) on delete set null,
  duration_ms integer not null check (duration_ms > 0),
  audio_key text not null,
  cover_url text,
  isrc text,
  genre text,
  mood text,
  bpm integer,
  source public.track_source not null default 'catalog',
  owner_id uuid references public.profiles (id) on delete cascade,
  is_playable boolean not null default true,
  license text,
  license_url text,
  attribution text,
  search tsvector generated always as (
    to_tsvector('simple', title || ' ' || coalesce(genre, '') || ' ' || coalesce(mood, ''))
  ) stored,
  created_at timestamptz not null default now(),
  constraint tracks_catalog_owner_chk check (
    (source = 'catalog' and owner_id is null) or (source = 'upload' and owner_id is not null)
  )
);

create index if not exists tracks_title_trgm_idx on public.tracks using gin (title extensions.gin_trgm_ops);
create index if not exists tracks_search_idx on public.tracks using gin (search);
create index if not exists tracks_artist_idx on public.tracks (artist_id);
create index if not exists tracks_owner_idx on public.tracks (owner_id) where owner_id is not null;
create index if not exists tracks_genre_idx on public.tracks (genre);

-- ---------------------------------------------------------------------------
-- Playlists
-- ---------------------------------------------------------------------------
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  kind public.playlist_kind not null default 'user',
  visibility public.playlist_visibility not null default 'private',
  pair_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists playlists_touch_updated_at on public.playlists;
create trigger playlists_touch_updated_at
  before update on public.playlists
  for each row execute function public.touch_updated_at();

create index if not exists playlists_owner_idx on public.playlists (owner_id);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  position double precision not null,
  added_by uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now()
);

create index if not exists playlist_tracks_playlist_idx on public.playlist_tracks (playlist_id, position);

create table if not exists public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

-- ---------------------------------------------------------------------------
-- Listening history and premium instrumentation
-- ---------------------------------------------------------------------------
create table if not exists public.plays (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  context_type public.play_context not null default 'history',
  context_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ms_played integer not null default 0 check (ms_played >= 0),
  completed boolean not null default false
);

create index if not exists plays_user_started_idx on public.plays (user_id, started_at desc);
create index if not exists plays_track_idx on public.plays (track_id);

create table if not exists public.skip_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists skip_events_user_created_idx on public.skip_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Jam
-- ---------------------------------------------------------------------------
create table if not exists public.jam_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null default 'Duskwave Jam',
  is_active boolean not null default true,
  current_track_id uuid references public.tracks (id) on delete set null,
  position_ms integer not null default 0,
  is_playing boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

drop trigger if exists jam_sessions_touch_updated_at on public.jam_sessions;
create trigger jam_sessions_touch_updated_at
  before update on public.jam_sessions
  for each row execute function public.touch_updated_at();

create table if not exists public.jam_participants (
  session_id uuid not null references public.jam_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.jam_role not null default 'guest',
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.jam_queue (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.jam_sessions (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  added_by uuid not null references public.profiles (id) on delete cascade,
  position double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists jam_queue_session_idx on public.jam_queue (session_id, position);

-- ---------------------------------------------------------------------------
-- Spotify importer
-- ---------------------------------------------------------------------------
create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_playlist_id text not null,
  source_name text not null,
  status public.import_status not null default 'pending',
  total integer not null default 0,
  matched integer not null default 0,
  vibe_matched integer not null default 0,
  placeholders integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists import_jobs_user_idx on public.import_jobs (user_id, created_at desc);

create table if not exists public.import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs (id) on delete cascade,
  source_track_id text not null,
  title text not null,
  artists text not null,
  album text,
  isrc text,
  duration_ms integer,
  matched_track_id uuid references public.tracks (id) on delete set null,
  confidence numeric(4, 3),
  status public.import_match_status not null,
  created_at timestamptz not null default now()
);

create index if not exists import_items_job_idx on public.import_items (job_id);

-- ---------------------------------------------------------------------------
-- Blends
-- ---------------------------------------------------------------------------
create table if not exists public.blends (
  id uuid primary key default gen_random_uuid(),
  pair_key text not null unique,
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  score numeric(5, 2) not null default 0,
  playlist_id uuid references public.playlists (id) on delete set null,
  last_generated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.likes enable row level security;
alter table public.plays enable row level security;
alter table public.skip_events enable row level security;
alter table public.jam_sessions enable row level security;
alter table public.jam_participants enable row level security;
alter table public.jam_queue enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_items enable row level security;
alter table public.blends enable row level security;

-- profiles: public read for authenticated users, self update
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- catalog is public; uploads are owner-scoped
drop policy if exists "artists readable" on public.artists;
create policy "artists readable" on public.artists for select using (true);

drop policy if exists "albums readable" on public.albums;
create policy "albums readable" on public.albums for select using (true);

drop policy if exists "tracks readable" on public.tracks;
create policy "tracks readable" on public.tracks
  for select using (is_playable = true or owner_id = auth.uid());

drop policy if exists "tracks owner insert" on public.tracks;
create policy "tracks owner insert" on public.tracks
  for insert to authenticated with check (source = 'upload' and owner_id = auth.uid());

drop policy if exists "tracks owner update" on public.tracks;
create policy "tracks owner update" on public.tracks
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "tracks owner delete" on public.tracks;
create policy "tracks owner delete" on public.tracks
  for delete to authenticated using (owner_id = auth.uid());

-- playlists
drop policy if exists "playlists readable" on public.playlists;
create policy "playlists readable" on public.playlists
  for select using (
    visibility in ('public', 'unlisted')
    or owner_id = auth.uid()
  );

drop policy if exists "playlists owner insert" on public.playlists;
create policy "playlists owner insert" on public.playlists
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "playlists owner update" on public.playlists;
create policy "playlists owner update" on public.playlists
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "playlists owner delete" on public.playlists;
create policy "playlists owner delete" on public.playlists
  for delete to authenticated using (owner_id = auth.uid());

-- playlist tracks
drop policy if exists "playlist tracks readable" on public.playlist_tracks;
create policy "playlist tracks readable" on public.playlist_tracks
  for select using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and (p.visibility in ('public', 'unlisted') or p.owner_id = auth.uid())
    )
  );

drop policy if exists "playlist tracks owner insert" on public.playlist_tracks;
create policy "playlist tracks owner insert" on public.playlist_tracks
  for insert to authenticated with check (
    added_by = auth.uid()
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())
  );

drop policy if exists "playlist tracks owner update" on public.playlist_tracks;
create policy "playlist tracks owner update" on public.playlist_tracks
  for update to authenticated using (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())
  );

drop policy if exists "playlist tracks owner delete" on public.playlist_tracks;
create policy "playlist tracks owner delete" on public.playlist_tracks
  for delete to authenticated using (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())
  );

-- likes
drop policy if exists "likes self read" on public.likes;
create policy "likes self read" on public.likes for select to authenticated using (user_id = auth.uid());

drop policy if exists "likes self insert" on public.likes;
create policy "likes self insert" on public.likes for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "likes self delete" on public.likes;
create policy "likes self delete" on public.likes for delete to authenticated using (user_id = auth.uid());

-- plays
drop policy if exists "plays self read" on public.plays;
create policy "plays self read" on public.plays for select to authenticated using (user_id = auth.uid());

drop policy if exists "plays self insert" on public.plays;
create policy "plays self insert" on public.plays for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "plays self delete" on public.plays;
create policy "plays self delete" on public.plays for delete to authenticated using (user_id = auth.uid());

-- skip events
drop policy if exists "skips self read" on public.skip_events;
create policy "skips self read" on public.skip_events for select to authenticated using (user_id = auth.uid());

drop policy if exists "skips self insert" on public.skip_events;
create policy "skips self insert" on public.skip_events for insert to authenticated with check (user_id = auth.uid());

-- jam sessions
drop policy if exists "jam sessions participant read" on public.jam_sessions;
create policy "jam sessions participant read" on public.jam_sessions
  for select using (
    is_active = true
    or host_id = auth.uid()
    or exists (
      select 1 from public.jam_participants jp
      where jp.session_id = id and jp.user_id = auth.uid()
    )
  );

drop policy if exists "jam sessions host insert" on public.jam_sessions;
create policy "jam sessions host insert" on public.jam_sessions
  for insert to authenticated with check (host_id = auth.uid());

drop policy if exists "jam sessions host update" on public.jam_sessions;
create policy "jam sessions host update" on public.jam_sessions
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

drop policy if exists "jam sessions host delete" on public.jam_sessions;
create policy "jam sessions host delete" on public.jam_sessions
  for delete to authenticated using (host_id = auth.uid());

-- jam participants
drop policy if exists "jam participants session read" on public.jam_participants;
create policy "jam participants session read" on public.jam_participants
  for select to authenticated using (
    exists (
      select 1 from public.jam_participants me
      where me.session_id = session_id and me.user_id = auth.uid()
    )
  );

drop policy if exists "jam participants self join" on public.jam_participants;
create policy "jam participants self join" on public.jam_participants
  for insert to authenticated with check (
    user_id = auth.uid()
    and role = 'guest'
    and exists (select 1 from public.jam_sessions s where s.id = session_id and s.is_active)
  );

drop policy if exists "jam participants self leave" on public.jam_participants;
create policy "jam participants self leave" on public.jam_participants
  for delete to authenticated using (user_id = auth.uid());

-- jam queue
drop policy if exists "jam queue participant read" on public.jam_queue;
create policy "jam queue participant read" on public.jam_queue
  for select to authenticated using (
    exists (
      select 1 from public.jam_participants jp
      where jp.session_id = jam_queue.session_id and jp.user_id = auth.uid()
    )
  );

drop policy if exists "jam queue participant insert" on public.jam_queue;
create policy "jam queue participant insert" on public.jam_queue
  for insert to authenticated with check (
    added_by = auth.uid()
    and exists (
      select 1 from public.jam_participants jp
      where jp.session_id = jam_queue.session_id and jp.user_id = auth.uid()
    )
  );

-- importer
drop policy if exists "import jobs owner read" on public.import_jobs;
create policy "import jobs owner read" on public.import_jobs for select to authenticated using (user_id = auth.uid());

drop policy if exists "import items owner read" on public.import_items;
create policy "import items owner read" on public.import_items
  for select to authenticated using (
    exists (select 1 from public.import_jobs j where j.id = job_id and j.user_id = auth.uid())
  );

-- blends
drop policy if exists "blends member read" on public.blends;
create policy "blends member read" on public.blends
  for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.consume_skip()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tier public.user_tier;
  recent integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select p.tier into tier from public.profiles p where p.id = uid;
  if tier = 'premium' then
    return true;
  end if;

  select count(*) into recent
  from public.skip_events s
  where s.user_id = uid and s.created_at > now() - interval '1 hour';

  if recent >= 6 then
    return false;
  end if;

  insert into public.skip_events (user_id) values (uid);
  return true;
end;
$$;

revoke all on function public.consume_skip() from public;
grant execute on function public.consume_skip() to authenticated;

create or replace function public.seed_demo_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inserted integer := 0;
  already boolean := false;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce((onboarding ->> 'demo_seeded_at') is not null, false)
  into already
  from public.profiles
  where id = uid;

  if already then
    return 0;
  end if;

  with catalog as (
    select id, duration_ms
    from public.tracks
    where is_playable = true and source = 'catalog'
    order by random()
    limit 48
  )
  insert into public.plays (user_id, track_id, context_type, started_at, ended_at, ms_played, completed)
  select
    uid,
    c.id,
    'history',
    now() - (d || ' days')::interval - (random() * interval '10 hours'),
    now() - (d || ' days')::interval - (random() * interval '9 hours'),
    greatest(30000, (c.duration_ms * (0.55 + random() * 0.45))::integer),
    random() < 0.9
  from generate_series(1, 14) as d
  cross join catalog c
  where random() < 0.22;

  get diagnostics inserted = row_count;

  if inserted = 0 then
    return 0;
  end if;

  insert into public.likes (user_id, track_id)
  select uid, id from public.tracks
  where is_playable = true
  order by random()
  limit 12
  on conflict do nothing;

  update public.profiles
  set onboarding = onboarding || jsonb_build_object('demo_seeded_at', now())
  where id = uid;

  return inserted;
end;
$$;

revoke all on function public.seed_demo_history() from public;
grant execute on function public.seed_demo_history() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('artwork', 'artwork', true), ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists "avatars owner write" on storage.objects;
create policy "avatars owner write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "uploads owner read" on storage.objects;
create policy "uploads owner read" on storage.objects
  for select to authenticated using (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "uploads owner write" on storage.objects;
create policy "uploads owner write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "uploads owner delete" on storage.objects;
create policy "uploads owner delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );
