-- R14: allow scrobble progress/completion updates on the caller's own play rows.
drop policy if exists "plays self update" on public.plays;
create policy "plays self update" on public.plays
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
