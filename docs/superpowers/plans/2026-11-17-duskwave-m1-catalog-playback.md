# Duskwave M1 — Catalog + Playback

**Milestone:** M1 (from `docs/superpowers/specs/2026-11-17-duskwave-design.md` §9)
**Acceptance:** Audio plays with the screen locked; search returns expected results; plays are recorded.
**Builds on:** M0 foundation (auth, Supabase baseline, UI kit, tab shell, seeder, CI).

## Ground rules

- Use `expo-audio` SDK 58 APIs as documented for v58: `useAudioPlaylist`, `useAudioPlaylistStatus`,
  `createAudioPlaylist`, `setAudioModeAsync`, `setActiveForLockScreen`. Do not use `expo-av`.
- Lock screen requires `interruptionMode: 'doNotMix'` (or `doNotMixPersistent`) and metadata passed
  through `setActiveForLockScreen(true, metadata)`.
- Android sustained background playback requires the `AudioControlsService` / foreground service
  already configured by the `expo-audio` plugin (`enableBackgroundPlayback: true`).
- No Spotify/SoundCloud audio. Catalog audio is CC licensed and stored in R2 (dev fallback:
  Supabase Storage `uploads` bucket, signed URLs).
- Commit per task. Every task ends with `npm.cmd run lint`, `npm.cmd run typecheck`,
  `npm.cmd test -- --ci` green.

## Task 1: Jamendo catalog fetch script

**Files:** `scripts/fetch-catalog.ts`, `src/features/catalog/jamendo.ts`,
`src/features/catalog/__tests__/jamendo.test.ts`, update `package.json` (`fetch:catalog`).

**Interfaces:** `mapJamendoTrack(raw): CatalogTrack | null`, CLI `npm run fetch:catalog -- --limit 200
--out catalog/manifest.json` using `JAMENDO_CLIENT_ID` and `https://api.jamendo.com/v3.0/tracks/`
(`format=json`, `include=musicinfo`, `audioformat=mp32`, `license_ccurl`).

- [ ] Step 1: Failing tests: mapping keeps attribution/license, skips entries without a playable
  mp3 URL or duration, slugifies deterministically, dedupes by slug.
- [ ] Step 2: Implement mapper until green. CLI validates output with `CatalogManifestSchema`
  before writing.
- [ ] Step 3: Document operator step (free Jamendo client ID) in runbook.
- [ ] Step 4: Commit `feat(catalog): Jamendo manifest fetcher`.

## Task 2: Search and shelf queries

**Files:** `supabase/migrations/20261117000200_search.sql`,
`supabase/tests/0002_search_test.sql`, `src/features/catalog/api.ts`,
`src/features/catalog/hooks.ts`, `src/features/catalog/__tests__/filters.test.ts`.

**Interfaces:**
`search_tracks(q text, genre text, mood text, bpm_min int, bpm_max int, lim int, off int)
returns setof public.tracks` ordered by trigram similarity then recency; RLS unchanged
(security invoker).

- [ ] Step 1: pgTAP test inserts three tracks, asserts text match, mood filter, BPM range, and that
  an unauthenticated/other-owner upload is excluded.
- [ ] Step 2: Migration + indexes (`pg_trgm` exists; add `tracks_bpm_idx` if needed).
- [ ] Step 3: `searchTracks()` / `getRecentlyPlayed()` / `getFreshTracks()` / `getMoodShelf()`
  with TanStack Query hooks; pure query-key + param builders tested with jest.
- [ ] Step 4: Commit `feat(catalog): search RPC and query hooks`.

## Task 3: Playback source resolution

**Files:** `supabase/functions/r2-sign/index.ts`, `src/features/player/audio-source.ts`,
`src/features/player/__tests__/audio-source.test.ts`.

**Interfaces:** `resolveAudioUrl(track): Promise<string>` — if `audio_key` starts with `http`,
use it; else invoke `r2-sign` with `{ key }` (returns `{ url, expiresIn }`), fall back to
`storage.from('uploads').createSignedUrl(audio_key, 3600)`. Cache signed URLs per key for
`expiresIn - 60s`.

- [ ] Step 1: Test the pure branch/caching logic with a fake invoker.
- [ ] Step 2: Implement edge function (Deno + aws4fetch, R2 env: `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`), CORS + JSON errors.
- [ ] Step 3: `supabase functions serve r2-sign` documented; commit
  `feat(player): signed audio source resolution`.

## Task 4: Playback engine and queue store

**Files:** `src/features/player/player-store.ts`, `src/features/player/engine.ts`,
`src/features/player/__tests__/queue.test.ts`, `jest.setup.js` (mock `expo-audio`).

**Interfaces:** Zustand store `{ queue: Track[], index, context, isPlaying, positionMs, durationMs,
currentTrack }`; actions `playQueue(tracks, index, context)`, `toggle()`, `next()`, `previous()`,
`seek(ms)`, `appendToQueue(track)`; engine wraps a module-level `createAudioPlaylist` and forwards
status events; configures `setAudioModeAsync` once and lock-screen metadata per track change.

- [ ] Step 1: Pure queue reducers tested (next/previous/loop/end, queue replacement, index clamp).
- [ ] Step 2: Engine with strict cleanup, error surfaced into store (`error` field).
- [ ] Step 3: Commit `feat(player): queue store and expo-audio engine`.

## Task 5: Scrobbles

**Files:** `src/features/player/scrobble.ts`, `src/features/player/__tests__/scrobble.test.ts`.

**Interfaces:** `isCompleted(msPlayed, durationMs)` (≥ 50% or ≥ 30 s); `startScrobble(track,
context)` inserts a play row; throttled `updateScrobble` every 10 s and on pause/next/app-background.
Offline failures queue rows in AsyncStorage and flush on next launch.

- [ ] Step 1: Completion-rule tests.
- [ ] Step 2: Wire into engine events; never block playback on network.
- [ ] Step 3: Commit `feat(player): scrobble recording with offline buffer`.

## Task 6: Live mini-player and full player

**Files:** `src/ui/player-bar.tsx` (replace placeholder), `src/app/player.tsx`,
`src/components/player/*` or `src/features/player/components/*`, add
`@react-native-community/slider` via `npx expo install`.

**Interfaces:** mini-player shows artwork/title/artist, progress hairline, play/pause/next, opens
full player; full player has large artwork, scrubber, transport, like toggle, queue sheet, license
chip (opens the track's `licenseUrl`).

- [ ] Step 1: Wire mini-player to the store; disabled state only when the queue is empty.
- [ ] Step 2: Full player + queue sheet + like toggle (optimistic `likes` insert/delete).
- [ ] Step 3: Commit `feat(player): mini-player and full player UI`.

## Task 7: Search, Home, Library

**Files:** `src/app/(tabs)/search.tsx`, `src/app/(tabs)/index.tsx`,
`src/app/(tabs)/library.tsx`, `src/features/catalog/components/*`.

**Interfaces:** search screen with 300 ms debounce, genre/mood pills and BPM range chips; results
are `TrackRow` → `playQueue(results, index, 'search')`. Home: greeting, Recently played,
Fresh in the catalog, a mood shelf. Library: Liked songs list (from `likes` + tracks) and a
disabled playlist placeholder until M2.

- [ ] Step 1: Hooks wired; loading skeletons and empty states.
- [ ] Step 2: Manual acceptance: query returns only catalog tracks; tapping plays.
- [ ] Step 3: Commit `feat(app): catalog search, home shelves, and liked songs`.

## Task 8: Licenses screen

**Files:** `src/app/licenses.tsx`, link from Settings.

**Interfaces:** grouped list of catalog tracks with title, artist, license name, attribution, and
a pressable license URL. Reads only `license`, `license_url`, `attribution`.

- [ ] Step 1: Implement + empty state.
- [ ] Step 2: Commit `feat(app): license attributions screen`.

## Task 9: Resume and polish

**Files:** `src/features/player/persistence.ts`, root layout bootstrap.

**Interfaces:** persist `{ trackIds, index, positionMs }` (AsyncStorage) on pause/background/every
30 s; on launch, restore the queue paused with position; mini-player shows it. Audio interruption
(pause on call) handled by the OS; app restores focus state.

- [ ] Step 1: Persistence tests (round-trip, stale ids dropped).
- [ ] Step 2: Bootstrap restore in provider; no autoplay.
- [ ] Step 3: Commit `feat(player): resume last queue paused`.

## Task 10: Verification, seed, docs

- [ ] Run `npm.cmd run fetch:catalog` with a real Jamendo key, `seed:catalog`, then
  `seed:catalog -- --verify` (expect ~200 rows, zero missing audio keys).
- [ ] Device test: play with screen locked (Android), verify notification/lock-screen controls,
  background for 5+ minutes; confirm `plays` rows update.
- [ ] Update README roadmap (M1 checked) and runbook (Jamendo key, `r2-sign` deploy, scrobble rule,
  offline buffer).
- [ ] Full checks + push; confirm CI green.
- [ ] Commit `chore: complete M1 catalog and playback`.

## Risks for this milestone

- **Jamendo track availability** — API may return tracks without mp3; mapper skips them and logs
  counts; target 200 after dedupe, fallback to a smaller verified set (never fake rows).
- **expo-audio playlist API drift** — pin SDK 58; verify against versioned docs before coding.
- **Signed URL expiry during long plays** — cache 60 s before expiry; playlist sources are resolved
  when the track starts, matching a 1 h expiry.
- **Lint React-Compiler rules** — avoid ref reads during render (see M0 skeleton fix).

## Approval gate

This plan is proposed, not executed. Review the scope (especially real-catalog sourcing and the
Jamendo dependency) before implementation starts.
