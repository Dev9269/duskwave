begin;

select plan(17);

select has_function(
  'public',
  'search_tracks',
  array['text', 'text', 'text', 'integer', 'integer', 'integer', 'integer'],
  'search_tracks(text, text, text, integer, integer, integer, integer) exists'
);

-- ---------------------------------------------------------------------------
-- Fixtures: three playable catalog tracks and one non-playable upload.
-- The upload owner is visible through the auth.users trigger.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
values ('44444444-4444-4444-4444-444444444444', 'uploader@example.com');

insert into public.artists (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Test Artist');

insert into public.tracks (
  id, slug, title, artist_id, duration_ms, audio_key,
  genre, mood, bpm, source, owner_id, is_playable, created_at
)
values
  (
    '33333333-3333-3333-3333-333333333301',
    'midnight-drive',
    'Midnight Drive',
    '11111111-1111-1111-1111-111111111111',
    214000,
    'catalog/midnight-drive.mp3',
    'Electronic',
    'Energetic',
    120,
    'catalog',
    null,
    true,
    now() - interval '3 days'
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    'golden-hour',
    'Golden Hour',
    '11111111-1111-1111-1111-111111111111',
    198000,
    'catalog/golden-hour.mp3',
    'Folk',
    'Chill',
    90,
    'catalog',
    null,
    true,
    now() - interval '2 days'
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    'midnight-runner',
    'Midnight Runner',
    '11111111-1111-1111-1111-111111111111',
    206000,
    'catalog/midnight-runner.mp3',
    'Electronic',
    'Chill',
    150,
    'catalog',
    null,
    true,
    now() - interval '1 day'
  ),
  (
    '33333333-3333-3333-3333-333333333304',
    'midnight-secret',
    'Midnight Secret',
    '11111111-1111-1111-1111-111111111111',
    180000,
    'uploads/midnight-secret.mp3',
    'Electronic',
    'Energetic',
    120,
    'upload',
    '44444444-4444-4444-4444-444444444444',
    false,
    now()
  );

-- Text search matches catalog titles only.
select is(
  (select count(*)::integer from public.search_tracks('midnight')),
  2,
  'text query returns matching catalog tracks'
);

select is(
  (select count(*)::integer from public.search_tracks('secret')),
  0,
  'a non-playable upload never appears in text search'
);

select is(
  (select title from public.search_tracks('midnight') limit 1),
  'Midnight Drive',
  'results order by trigram similarity before recency'
);

-- Filters.
select is(
  (select count(*)::integer from public.search_tracks(null, null, 'chill')),
  2,
  'mood filter matches case-insensitively'
);

select is(
  (select count(*)::integer from public.search_tracks(null, 'electronic', null)),
  2,
  'genre filter matches case-insensitively'
);

select is(
  (select count(*)::integer from public.search_tracks(null, null, null, 120, 120)),
  1,
  'bpm range bounds are inclusive'
);

-- Defaults, blank filters, and paging.
select is(
  (select count(*)::integer from public.search_tracks()),
  3,
  'defaults return every playable catalog track'
);

select is(
  (select count(*)::integer from public.search_tracks('', '', '')),
  3,
  'empty string filters behave as absent'
);

select is(
  (select count(*)::integer from public.search_tracks(null, null, null, null, null, 2)),
  2,
  'limit caps the result count'
);

select is(
  (select count(*)::integer from public.search_tracks(null, null, null, null, null, 0)),
  1,
  'limit below 1 is clamped to 1'
);

select is(
  (select count(*)::integer from public.search_tracks(null, null, null, null, null, null, 2)),
  1,
  'offset skips rows'
);

select is(
  (select count(*)::integer from public.search_tracks(null, null, null, null, null, null, -5)),
  3,
  'negative offset is clamped to 0'
);

-- RLS and the source filter act independently. Anon cannot see the upload at
-- all; the owner can see it, but search still excludes it.
set local role anon;

select is(
  (select count(*)::integer from public.tracks where id = '33333333-3333-3333-3333-333333333304'),
  0,
  'RLS hides the non-playable upload from anon'
);

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select is(
  (select count(*)::integer from public.tracks where id = '33333333-3333-3333-3333-333333333304'),
  1,
  'RLS lets the upload owner read their own row'
);

select is(
  (select count(*)::integer from public.search_tracks() where id = '33333333-3333-3333-3333-333333333304'),
  0,
  'source filter excludes the upload from search despite owner RLS access'
);

select is(
  (select count(*)::integer from public.search_tracks('secret') where id = '33333333-3333-3333-3333-333333333304'),
  0,
  'source filter excludes the upload even when its title matches'
);

reset role;

select * from finish();

rollback;
