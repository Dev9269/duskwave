# Duskwave — Design Spec

**Date:** 2026-11-17
**Status:** Approved
**Owner:** Dev9269
**Repo:** https://github.com/Dev9269/duskwave (public, MIT)

## 1. Overview

Duskwave is a mobile music streaming application built as a flagship open-source portfolio project. It is **not** a commercial product: there is no real billing, no real advertising, and no distribution of unlicensed audio. The goal is to demonstrate end-to-end product engineering — React Native app development, backend design with multi-tenant auth and row-level security, realtime synchronization, third-party API integration (Spotify metadata import), and a deliberate visual identity — with a codebase a reviewer can understand in an afternoon.

The idea space (Jam rooms, Blend playlists, listening history, premium tiers) is inspired by mainstream streaming apps. **No proprietary assets, code, or audio are copied.** Reference apps are studied only for interaction patterns; implementation is original.

## 2. Goals and success criteria

- Android APK available in GitHub Releases, built from CI, installable without a developer machine.
- 60–90 second demo video and screenshots in the README; README skimmable in 60 seconds (architecture diagram, feature list, honest importer statistics).
- CI green: typecheck, lint, unit/component tests, database migration + RLS tests, Maestro smoke flows.
- Playback survives backgrounding and screen lock with working lock-screen controls.
- Jam session keeps two devices within ±250 ms of the host.
- Spotify importer preserves 100% of source metadata and never crashes on real playlists; exact-match rate reported honestly (5–15% expected on mainstream playlists against a CC catalog), with "vibe match" substitutions and metadata-only placeholders for the rest.
- Zero licensing violations: every catalog track has a recorded license and attribution; Spotify is used strictly for metadata via the official Web API.
- Fully open source: MIT for first-party code; all runtime dependencies are MIT/Apache-2.0 compatible.

## 3. Non-goals (explicit YAGNI cuts)

- No real payments (premium is a clearly labeled simulation).
- No real ads (free tier sees branded "upgrade" interstitials, not ad networks).
- No lyrics, podcasts, audiobooks, DMs, social feed, or comments.
- No Spotify audio, downloading, or playback via Spotify APIs.
- No web app version; Android-first with iOS builds possible via EAS.
- No offline downloads for free tier; offline is a premium-simulation feature.
- No pgvector or ML-based similarity; Blend is deterministic SQL.
- No importer re-sync (one-shot import per job).

## 4. Locked technical decisions

| Area | Decision |
| --- | --- |
| App platform | React Native + Expo SDK 58, TypeScript strict, Expo Router (routes under `src/app/`), expo-dev-client development builds from day one |
| State | Zustand for client/player UI state; TanStack Query for server state with optimistic mutations |
| Audio engine | **expo-audio** (`AudioPlaylist`): first-party, MIT, native playlist + background playback + lock-screen controls via `enableBackgroundPlayback` config plugin. RNTP v4 was rejected (no New Architecture support on RN 0.88); RNTP v5 (`@rntp/player`) rejected (commercial license, breaks the fully-open-source goal) |
| Backend | Supabase: Postgres + RLS, Auth, Storage, Realtime, Edge Functions (Deno) |
| Audio hosting | Cloudflare R2 (10 GB free, zero egress) with short-lived presigned URLs; fallback Supabase Storage (1 GB, ~100-track catalog) if R2 billing cannot be enabled |
| Artwork | Supabase Storage public bucket |
| Importer | Spotify Web API authorization-code + PKCE; tokens exchanged server-side inside an Edge Function and never returned to the app; access limited to `playlist-read-private`, `playlist-read-collaborative` |
| Jam | Supabase Realtime broadcast + presence; host-authoritative playback; snapshot + timestamped events; ±250 ms drift correction |
| Blend | Deterministic SQL scoring over shared genres, overlapping top artists, top-played-track overlap, recency-weighted; no vectors |
| Premium | Simulated tier in `profiles.tier`; gates enforced by RPC/table logic, not only UI |
| Design | "Editorial Dark": near-black surfaces, Fraunces display serif + Inter UI, single dusk-ember accent, hairline borders, album art carries color |
| Deep linking | Custom scheme `duskwave://` with Spotify redirect `duskwave://redirect` (verified still supported by Spotify; HTTPS recommended for future hardening) |
| CI/CD | GitHub Actions; EAS Build profiles `development` (APK, dev client) and `preview`/`production`; release APK attached to GitHub Releases |
| License | MIT |

### 4.1 Known environment constraints

- Windows development machine: no iOS simulator; iOS builds only via EAS in the cloud. No TestFlight without a paid Apple developer account — not promised.
- Android SDK present at `%LOCALAPPDATA%\Android\Sdk`; no emulator installed. Device testing via USB (adb) or EAS builds.
- Node 26 is installed system-wide and is not the version Expo tooling is validated against; pin the repo to Node 22 LTS (`.node-version`) via fnm.
- PowerShell execution policy blocks `npm.ps1`; use `npm.cmd`/`npx.cmd` in scripts and docs.
- npm registry currently serves metadata for `csstype@3.2.4` but 404s its tarball; `package.json` pins `overrides: { "csstype": "3.2.3" }`.
- Cloudflare R2 requires a payment method on file even for the free tier; fallback documented above.

## 5. Product scope

### 5.1 Auth, identity, demo readiness

- Email/password and Google sign-in via Supabase Auth; unique username, display name, avatar, short bio.
- Onboarding taste picker (genres/moods, 3–8 selections) seeds Blend and home recommendations.
- Account deletion and data export requests are supported (deletion via Edge Function; export returns JSON).
- **Demo readiness:** Settings → "Load demo history" calls an idempotent security-definer RPC that inserts 14 days of plausible plays/likes for the current user. Sign-in screen additionally offers a "Demo login" for a pre-seeded account. Recruiters must see populated charts, streaks, and Blend scores on first launch.

### 5.2 Catalog and playback

- Curated seed catalog of ~200 Creative Commons licensed tracks (Jamendo / Free Music Archive) with artist, album, artwork, genre, mood, BPM (where known), license name + URL, and attribution text.
- Artist and album pages; a "Licenses" screen listing every track's attribution.
- Search: Postgres full-text search plus trigram fuzzy matching; filters for genre, mood, and BPM range.
- Playback: native queue (expo-audio playlist), play/pause/next/previous, seek, shuffle, repeat (off/all/one), sleep timer, resume-on-launch, audio-focus and interruption handling, background and lock-screen controls with metadata.
- Free tier: 6 skips per rolling hour; 3 personal uploads.
- Premium (simulated): unlimited skips, 50 uploads, crossfade toggle, simulated "Hi-Fi" quality toggle, offline downloads via expo-audio's native caching.
- Uploads: owner-scoped R2 presigned PUT; uploaded tracks are private to the owner by default and may be added to their own playlists.

### 5.3 Spotify Playlist Importer

- OAuth 2.0 authorization code + PKCE initiated from the app (`expo-auth-session`), redirect `duskwave://redirect`.
- App sends the authorization code + PKCE verifier to the `spotify-import` Edge Function; the function exchanges tokens, reads playlists and tracks, performs matching, writes job results, and discards tokens. No Spotify token ever reaches the device.
- Wizard: connect → select playlists → review matches → import.
- Matching cascade (per track):
  1. Exact ISRC match in catalog → **matched** (confidence 1.0).
  2. Normalized title + artist trigram similarity ≥ 0.85, duration within ±3 s as tiebreak → **matched**.
  3. No exact/fuzzy match → **Suggested vibe match**: pick a playable catalog track from the same genre/mood (enriched via Deezer's public API; no key required). Clearly labeled "vibe match", never presented as the same recording.
  4. No enrichment data → **placeholder** row: original title/artist/album metadata preserved, non-playable, with a "find alternative" action.
- Import preserves source order and produces a native playlist of kind `import`.
- Honest metrics: the README reports exact-match rate, vibe-match count, and placeholder count for demo playlists. A curated CC test playlist must hit ≥95% exact matches; mainstream playlists are expected to land at 5–15% exact with the remainder split between vibe matches and placeholders.
- Rate limiting: 429 responses honored with `Retry-After`; import jobs are resumable and record per-item errors.

### 5.4 Jam (realtime listening rooms)

- Premium-only to host; any authenticated user can join.
- Host creates a room with a 6-character code and QR share sheet; guests join by code, link, or QR.
- Presence list with avatars and roles.
- Host is playback authority. Guests can add tracks to the shared queue and send emoji reactions.
- Protocol: typed broadcast events `session:start`, `session:end`, `track:change`, `playback:play|pause|seek`, `queue:add`, `reaction`; playback events carry `positionMs` and `serverTs`.
- Late joiners hydrate state from a snapshot RPC and start at `positionMs + (now − serverTs)`.
- Drift correction: guest corrects when |local − expected| > 250 ms; hard resync (seek + state reload) at > 2 s.
- Host disconnect: 60-second grace period, then host transfer to the earliest-joined guest or session end. Guests see a reconnecting state.
- Events are ephemeral (not persisted); room state and queue live in tables. Ending a session deletes presence and marks the session ended.

### 5.5 Blend

- Pair-based: one user invites another via link; both receive a weekly-regenerated shared playlist with a taste-match percentage and a shared-artists grid.
- Scoring (deterministic SQL, stored per pair so it does not churn):
  - shared genre affinity from likes + plays,
  - overlap of each user's top artists,
  - overlap of top-played tracks,
  - recency weighting (plays in the last 30 days weigh more).
- Regeneration runs weekly via `pg_cron`; track selection is deterministic given the same inputs (stable seed = pair key + ISO week).
- Match percentage = normalized score in [0, 100]; shown in UI with the shared-artists grid.

### 5.6 History and listening stats

- Every playback start and meaningful stop writes a `plays` row (user, track, context, started_at, ended_at, ms_played, completed).
- Screens: recently played, chronological timeline, weekly minutes bar chart, top artists/genres, listening streak.
- Offline-safe: scrobbles queue locally and flush on reconnect.
- Privacy: `history_enabled` toggle stops writes and hidden processing; users can delete their history.

### 5.7 Premium simulation

- `profiles.tier` enum `free | premium`, `premium_since`.
- Fake checkout screen clearly labeled "Demo — no payment is processed"; no card fields are collected. Instant tier flip via RPC.
- Enforced server-side: skip counter RPC for free tier (6/hour), upload quota trigger (3 free / 50 premium), Jam hosting requires premium.
- Client-side premium affordances: crossfade toggle, Hi-Fi toggle (visual only), offline downloads.
- Manage/cancel screen returns the user to free immediately.

## 6. Architecture

### 6.1 Repository layout

```
duskwave/
├─ src/app/                 Expo Router routes
│  ├─ _layout.tsx           providers, fonts, auth gate
│  ├─ (auth)/               welcome, sign-in, sign-up, onboarding
│  ├─ (tabs)/               home, search, library, profile
│  ├─ player.tsx            full-screen player (modal)
│  ├─ playlist/[id].tsx     album/artist/playlist details
│  ├─ jam/                  create + room screens
│  ├─ blend/                pair screen + invite
│  ├─ import/               wizard screens
│  ├─ premium.tsx           simulated checkout
│  ├─ settings/             settings, demo tools, licenses
│  └─ redirect.tsx          Spotify OAuth callback route (duskwave://redirect)
├─ src/ui/                  design tokens + primitives
├─ src/features/            auth, catalog, player, playlists, search, jam, blend, history, premium, importer
├─ src/lib/                 supabase client, query client, audio service, env, formatting
├─ src/types/               generated DB types, shared domain types
├─ supabase/migrations/     SQL migrations (schema, RLS, RPCs, storage policies)
├─ supabase/functions/      spotify-import, r2-sign, account-delete (Deno)
├─ scripts/seed-catalog.ts  idempotent catalog seeder
├─ catalog/manifest.json    curated CC catalog manifest
├─ e2e/                     Maestro flows
├─ docs/                    this spec, runbook, research notes
└─ .github/workflows/       ci.yml, seed-catalog.yml, keepalive.yml
```

### 6.2 Client architecture

- Expo Router with typed routes; route groups enforce auth via a session gate in the root layout.
- Providers: Supabase session context, TanStack Query client, theme, safe-area.
- Audio: a singleton `AudioPlaylist` created outside React (`createAudioPlaylist`) owned by a player service; Zustand store mirrors status events (state machine `idle → loading → playing ⇄ paused → buffering → ended | error`); queue + position snapshot persisted to AsyncStorage for resume.
- Lock-screen metadata updated on every track change; `setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' })`.
- Realtime: one channel per Jam session (`jam:{id}`), typed event union shared between client and Edge Functions.
- Server state via TanStack Query against Supabase; typed with generated `Database` types.

### 6.3 Backend

- Postgres 15+ with extensions `pg_trgm` (search/fuzzy), `pgcrypto`, `pg_cron` (blends, aggregates).
- RLS enabled on every table:
  - catalog (`artists`, `albums`, `tracks`): public read of playable catalog rows; owners can read/write their uploads.
  - `playlists`/`playlist_tracks`: readable when public or owned; writable by owner.
  - `plays`, `likes`: strictly self-scoped; aggregates only through security-definer functions.
  - `jam_sessions`, `jam_participants`, `jam_queue`: participants only; writes role-checked (host vs guest).
  - `import_jobs`, `import_items`: owner only.
- Edge Functions:
  - `spotify-import`: PKCE token exchange, playlist pagination, matching cascade, job persistence, token discard.
  - `r2-sign`: presigned GET for catalog/upload playback and PUT for uploads; verifies Supabase JWT and ownership.
  - `account-delete`: removes user rows and storage objects (service role).
- `pg_cron` jobs: weekly blend regeneration; nightly materialized-view refresh for listening aggregates.
- Free-tier resilience: a weekly GitHub Actions keepalive pings the Supabase project so it never pauses before a demo.

### 6.4 Data model (baseline)

Enums: `user_tier`, `playlist_kind` (`user`, `liked`, `blend`, `import`, `jam`), `playlist_visibility` (`private`, `public`, `unlisted`), `track_source` (`catalog`, `upload`), `play_context` (`album`, `playlist`, `search`, `blend`, `jam`, `liked`, `history`), `import_status`, `import_match_status`, `jam_role`.

Tables (abridged; migrations are the source of truth):

- `profiles(id uuid PK → auth.users, username citext unique, display_name, avatar_url, bio, tier user_tier, premium_since, history_enabled bool, onboarding jsonb, created_at)`
- `artists(id, name, image_url, bio, license, license_url)`
- `albums(id, artist_id, title, cover_url, release_year, license, license_url)`
- `tracks(id, slug unique, title, artist_id, album_id, duration_ms, audio_key, cover_url, isrc, genre, mood, bpm, source track_source, owner_id, is_playable, license, license_url, attribution, created_at)`
- `playlists(id, owner_id, title, description, cover_url, kind, visibility, pair_key unique nullable, created_at, updated_at)`
- `playlist_tracks(id, playlist_id, track_id, position, added_by, added_at)`
- `likes(user_id, track_id, created_at, PK(user_id, track_id))`
- `plays(id bigserial, user_id, track_id, context_type, context_id, started_at, ended_at, ms_played, completed)`
- `skip_events(id bigserial, user_id, created_at)` (rolling-hour skip limit)
- `jam_sessions(id, host_id, code unique, name, is_active, current_track_id, position_ms, is_playing, updated_at, created_at, ended_at)`
- `jam_participants(session_id, user_id, role, joined_at, PK(session_id, user_id))`
- `jam_queue(id, session_id, track_id, added_by, position, created_at)`
- `import_jobs(id, user_id, source_playlist_id, source_name, status, total, matched, vibe_matched, placeholders, error, created_at, finished_at)`
- `import_items(id, job_id, source_track_id, title, artists, album, isrc, duration_ms, matched_track_id, confidence, status, created_at)`
- `blends(id, pair_key unique, user_a, user_b, score, playlist_id, last_generated_at)`

### 6.5 Spotify OAuth flow

1. App creates an authorization URL with PKCE (`code_challenge`, `state`) and opens it via `expo-web-browser`/`expo-auth-session`.
2. User approves; Spotify redirects to `duskwave://redirect?code=…&state=…`.
3. `src/app/redirect.tsx` validates `state`, extracts `code`, and POSTs `{ code, code_verifier, redirect_uri }` to `spotify-import`.
4. Edge Function exchanges the code (server-side), performs the import, stores results, and discards tokens.
5. App opens the review screen for the returned job.

Spotify dashboard setup: client ID, redirect URI `duskwave://redirect` (exact match, lowercase scheme, includes path), Android package `com.dev9269.duskwave`, iOS bundle ID `com.dev9269.duskwave`, scopes `playlist-read-private` and `playlist-read-collaborative`.

### 6.6 Seed pipeline

`npm run seed:catalog` runs `scripts/seed-catalog.ts`:

1. Validate `catalog/manifest.json` with zod; every entry must include license name, license URL, and attribution.
2. Download audio/artwork into `.cache/catalog/` (resumable, rate-limited; skipped if cached and checksum matches).
3. Upload audio to R2 with deterministic keys (`catalog/<slug>.mp3`), `HEAD`-skip when size/hash match; upload artwork to Supabase Storage.
4. Upsert artists, albums, and tracks by `slug` using the service role; never delete rows not in the manifest.
5. Verify: expected vs actual row counts, `HEAD` all audio keys, range-GET one signed URL, and print a JSON summary.
6. Flags: `--dry-run`, `--limit N`, `--force`, `--verify`. Non-zero exit on any verification failure. Same command runs manually via the `seed-catalog` GitHub workflow.

### 6.7 Error handling

- Global error boundary + toast surface; TanStack Query retry with exponential backoff for transient network failures.
- Player errors auto-advance to the next track after marking the current one unplayable and logging to a local ring buffer.
- Importer: resumable job rows, per-item error capture, user-visible summary, Spotify 429 handling.
- Jam: host disconnect grace + transfer; guest reconnecting UI; stale sessions reaped by a cron function.
- Offline: scrobbles and likes queued locally, flushed on reconnect; catalog reads served from TanStack cache.

## 7. Design system — Editorial Dark

- **Color:** ink `#0B0B0F`, surface `#14141A`, raised `#1B1B22`, hairline `#23232B`, text `#F4F1EA`, muted `#9A97A3`, accent dusk ember `#E4A853`, success `#4FA77B`, danger `#D96565`.
- **Typography:** Fraunces (display) + Inter (UI); display 40/34, title 24, body 16, caption 12; tight leading on display, relaxed on body.
- **Layout:** 4 pt spacing grid; radii 8/12/24; hairline borders instead of shadows; album art is the primary color source.
- **Components:** Screen, Text, Button (primary/secondary/ghost), Card, SectionHeader, TrackRow, MediaCard, Pill, Sheet, Scrubber, QueueItem, MatchBadge, EmptyState, Skeleton, AvatarStack, Toast, MiniPlayer, TabBar.
- **Motion:** Reanimated shared-element album art → player, spring sheets, haptics on transport controls; respect reduced motion.
- **Accessibility:** AA contrast, 44 pt targets, screen-reader labels on all controls, dynamic type support.
- **Identity:** "Duskwave" wordmark with a crescent glyph formed from a waveform; app icon, adaptive icon, splash, and favicon generated from SVG sources committed under `assets/brand/`.

## 8. Testing and delivery

- **Unit/component:** Jest + jest-expo + React Native Testing Library. Pure logic (matching cascade, queue reducer, blend score formatting, seed manifest validation) has direct unit tests.
- **Database:** SQL test scripts executed in CI against a local Supabase instance (schema, RLS policies, skip-limit RPC, demo-history idempotency).
- **E2E:** Maestro flows on Android for auth, browse → play → like, playlist creation, demo-history population, importer wizard against a mocked job, and Jam single-device host flow. Two-device Jam verified manually and documented in the runbook.
- **CI (GitHub Actions):** typecheck → lint → format check → Jest → Supabase migration/RLS tests → Maestro smoke on an Android emulator; EAS `preview` build on `main`; release APK attached to GitHub Releases on tag; weekly keepalive ping.
- **Release:** tag `v0.x.y` → `eas build --profile production --platform android` → attach APK to the release with screenshots and changelog.

## 9. Milestones

| # | Milestone | Delivers | Acceptance |
| --- | --- | --- | --- |
| M0 | Foundation | Repo, CI, dev-build pipeline, Supabase baseline (schema/RLS/RPCs), auth, UI kit, tab shell, deep-link handler, seed script skeleton, runbook | Dev-client APK installs; email/Google sign-in works; `duskwave://redirect` opens the app; CI green; `seed:catalog --dry-run --limit 5` passes |
| M1 | Catalog + playback | 200-track seeded catalog, search/filters, home/library, full player, queue, resume, lock-screen, scrobbles, licenses screen | Audio plays with screen locked; search returns expected results; plays recorded |
| M2 | Playlists + uploads | Playlist CRUD/reorder, liked songs, uploads with quota, profile | Reorder persists; upload appears only for owner; quota enforced |
| M3 | Importer | OAuth PKCE, edge function, 3-tier matching, wizard, curated test playlist | 100% metadata preserved; ≥95% exact on curated playlist; honest stats displayed |
| M4 | Jam | Sessions, QR/code join, presence, shared queue, drift correction, host failover | Two devices stay within ±250 ms; failover works |
| M5 | Blend + stats | Deterministic SQL blend, pair invites, charts/streaks, demo-history RPC | Blend regenerates weekly; demo button populates charts instantly |
| M6 | Premium sim | Tiers, RPC-enforced gates, fake checkout, offline downloads, manage/cancel | Free limits enforced server-side; downloads play offline |
| M7 | Polish | Maestro suite, perf pass, screenshots/video, README, release APK | CI green, APK in Releases, demo video published |

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Spotify API policy changes | Importer breaks | Feature isolated behind one Edge Function; metadata always preserved; README documents the constraint; feature flag can hide the importer |
| R2 billing requirement | Audio hosting blocked | Fallback to Supabase Storage with a 100-track catalog; documented switch in runbook |
| Supabase free-tier pausing | Demo offline | Weekly keepalive workflow; runbook includes a wake-up step before demos |
| Expo/audio engine regressions | Playback instability | Pin SDK versions; first-party `expo-audio`; smoke tests on every CI run |
| Android build tooling on Windows | Slow local iteration | EAS cloud builds for release; local SDK already present for debug builds |
| Node 26 incompatibility | Scaffolding/tooling failures | Repo pinned to Node 22 LTS via fnm and `.node-version` |
| Trademark/name collision ("Duskwave") | Repo rename later | Collision check before public launch; name only in config/brand assets, cheap to change |
| Scope creep | Never ships | Explicit non-goals; milestone gates; YAGNI reviews at each milestone |

## 11. Legal and ethical guardrails

- Audio: only CC-licensed or public-domain recordings; license and attribution stored in DB and displayed in-app.
- Spotify: official Web API only, user-initiative OAuth, metadata only; no scraping, no audio download, no re-hosting of Spotify content; a disclaimer notes the project is unaffiliated with Spotify.
- Reference study: open-source players may be inspected under their licenses; behavior of commercial apps may be observed, but their binaries are not decompiled and their assets are never copied.
- Uploads: users may upload audio they own; the app states this in the upload flow and Terms screen. No public redistribution of uploads.
- Trademarks: no Spotify/Apple/other logos in the app or marketing materials.

## 12. Open questions

None blocking. Post-MVP considerations (explicitly deferred): HTTPS App/Universal Links for Spotify redirect hardening, iOS TestFlight distribution, importer re-sync, collaborative playlists beyond Jam queue, waveform visualizations.
