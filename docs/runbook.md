# Duskwave runbook

Operator notes for running, testing, and wiring Duskwave. Written for Windows + PowerShell
5.1, where `npm.ps1` is blocked by execution policy — use `npm.cmd` / `npx.cmd`.

## Prerequisites

- Node 22 (`.node-version`). Node 26 also runs the toolchain locally, but CI pins 22.
- Docker Desktop (local Supabase database + Storage).
- Android platform-tools (`adb`) and a physical device, or EAS cloud builds. No emulator or
  Android Studio is required.
- Expo Go will not load this app: it needs a development build because of `expo-dev-client`
  and native config (background audio, splash).

## 1. Environment

```powershell
Copy-Item .env.example .env.local
```

Values:

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` — from `npx.cmd supabase status`
  locally, or the Supabase dashboard for a hosted project.
- `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` — public Client ID from the Spotify dashboard.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only (Edge Functions, seed script). Never expose it
  in the app bundle.
- `SPOTIFY_CLIENT_SECRET` — server-side only, used inside the `spotify-import` Edge Function.
- `R2_*` — Cloudflare R2 credentials for the seed script and the `r2-sign` function.

`src/lib/env.ts` validates the public Supabase values; the app boots into a "not configured"
state when they are missing instead of crashing.

## 2. Local Supabase

```powershell
npx.cmd supabase@latest db start   # Postgres only, enough for migrations + pgTAP
npx.cmd supabase@latest start      # full stack (Auth, Storage, Studio, Inbucket)
npx.cmd supabase@latest db reset   # replay migrations + seed.sql
npx.cmd supabase@latest test db    # pgTAP tests in supabase/tests
```

- Studio: http://127.0.0.1:54323
- API: http://127.0.0.1:54321
- Mail catcher (Inbucket): http://127.0.0.1:54324

The baseline migration lives at `supabase/migrations/20261117000100_init.sql` and creates the
schema, RLS policies, `consume_skip` / `seed_demo_history` RPCs, and the `avatars`, `artwork`,
`uploads` buckets.

## 3. Auth redirect URLs

Supabase dashboard → Authentication → URL Configuration:

- Site URL: `duskwave://` (or your hosted web URL if one exists)
- Additional redirect URLs:
  - `duskwave://auth-callback`
  - `duskwave://redirect`

Locally these are already in `supabase/config.toml` (`auth.additional_redirect_urls`).

## 4. Spotify developer app

1. Create an app at https://developer.spotify.com/dashboard.
2. Add the redirect URI exactly: `duskwave://redirect` (custom schemes are accepted; path is
   required after `//`). Do not add a trailing slash.
3. Request scopes: `playlist-read-private`, `playlist-read-collaborative`. Metadata import only —
   Duskwave never streams Spotify audio.
4. Copy the Client ID to `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`. The Client Secret goes to Supabase
   secrets for the `spotify-import` Edge Function only.
5. Development mode apps allow up to 25 allowlisted Spotify accounts; add testers under
   User Management.

PKCE: the app generates the verifier/challenge and stores `spotify_oauth_state` in SecureStore.
The authorization code is exchanged server-side (Edge Function), so tokens never live in the app.

## 5. Deep-link smoke tests

Android:

```powershell
adb shell am start -a android.intent.action.VIEW -d "duskwave://auth-callback?code=test"
adb shell am start -a android.intent.action.VIEW -d "duskwave://redirect?code=test&state=test"
adb shell am start -a android.intent.action.VIEW -d "duskwave://redirect?error=access_denied"
```

iOS simulator:

```powershell
xcrun simctl openurl booted "duskwave://redirect?code=test&state=test"
```

Expected: `/auth-callback` exchanges a real Supabase code; `/redirect` shows the Spotify success
state, or an explicit `missing_code` / `state_mismatch` error. A wrong `state` (no matching
SecureStore value) shows `state_mismatch`.

## 6. Cloudflare R2

1. Create bucket `duskwave-audio` (private). Playback uses short-lived signed URLs from the
   `r2-sign` Edge Function.
2. Create an API token scoped to the bucket (Object Read & Write).
3. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` in `.env.local`
   for the seed script.
4. CORS for the bucket: allow `GET`/`HEAD` from `*` so `expo-audio` can stream signed URLs.
5. Local fallback: the seed script can target Supabase Storage (`uploads` bucket) when R2 values
   are absent.

## 7. Catalog seeding

```powershell
npm.cmd run seed:catalog -- --dry-run
npm.cmd run seed:catalog -- --limit 25
npm.cmd run seed:catalog -- --force
npm.cmd run seed:catalog -- --verify
```

The script is idempotent: tracks are keyed by slug, artists by name. `--dry-run` prints the plan
without writing. `--verify` re-reads the catalog and reports audio-key gaps. The manifest lives
in `scripts/catalog-manifest.json`; audio licenses stay attached to every track row.

Demo history for a signed-in account: Settings → "Load demo history" (calls
`seed_demo_history()`; one-shot per profile).

## 8. Development builds

```powershell
npx.cmd expo start                          # Metro with dev client
npx.cmd expo run:android                    # local native build (requires SDK/JDK)
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest init                 # writes extra.eas.projectId
npx.cmd eas-cli@latest build --profile development --platform android
adb install -r path\to\duskwave.apk
```

`eas.json` profiles: `development` (dev client, APK), `preview` (APK), `production` (AAB).

## 9. Checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test -- --ci
npx.cmd supabase@latest test db
```

CI runs lint, typecheck, jest, and the pgTAP suite against a fresh local Supabase.

## 10. Troubleshooting

- `npm.ps1 cannot be loaded` — use `npm.cmd` / `npx.cmd`.
- `csstype` install 404 — `package.json` pins `overrides.csstype` to a published version.
- Docker engine not running — start Docker Desktop; `npx.cmd supabase@latest db start` needs it.
- Auth email links land nowhere — confirm the redirect allowlist includes
  `duskwave://auth-callback`; local confirmations are disabled by default.
- Playback silent in the background — rebuild the dev client after changing `expo-audio` config;
  the background-audio plugin only applies at build time.
