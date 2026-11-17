begin;

select plan(12);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'tracks', 'tracks table exists');
select has_table('public', 'playlists', 'playlists table exists');
select has_table('public', 'plays', 'plays table exists');
select has_table('public', 'jam_sessions', 'jam_sessions table exists');
select has_table('public', 'import_jobs', 'import_jobs table exists');

select has_function('public', 'seed_demo_history', 'seed_demo_history exists');
select has_function('public', 'consume_skip', 'consume_skip exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.tracks'::regclass),
  true,
  'RLS enabled on tracks'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'RLS enabled on profiles'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'playlists'),
  4,
  'playlists has 4 policies'
);

select is(
  (select public from storage.buckets where id = 'uploads'),
  false,
  'uploads bucket is private'
);

select * from finish();

rollback;
