# Duskwave M0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable Expo dev-build foundation for Duskwave: auth, design system, tab shell, deep links, Supabase baseline, idempotent catalog seeder skeleton, and CI — everything later milestones build on.

**Architecture:** Expo SDK 58 app (`src/app` routes) with Supabase as the backend (Auth, Postgres+RLS, Storage, Realtime). Audio is `expo-audio` (`AudioPlaylist`) with background playback configured from day one. A single idempotent Node/TypeScript seeder populates Cloudflare R2 + Supabase.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript 6 strict, Expo Router, Zustand, TanStack Query, expo-audio, Supabase JS v2, Jest + jest-expo, Maestro (M7), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-17-duskwave-design.md`

## Global Constraints

- Repo: `Dev9269/duskwave`, MIT, public.
- App scheme `duskwave`; Spotify OAuth redirect exactly `duskwave://redirect`; Android package + iOS bundle ID `com.dev9269.duskwave`.
- No Spotify audio, no proprietary assets, no copied code. All catalog tracks carry license + attribution.
- `expo-audio` only (no react-native-track-player). Background playback plugin enabled in app config.
- TypeScript strict; `npm.cmd run typecheck` clean; `expo lint` clean.
- Node 22 LTS pinned via `.node-version` (system Node 26 is unsupported for Expo tooling).
- Use `npm.cmd`/`npx.cmd` in PowerShell (execution policy blocks `.ps1` shims).
- `csstype` overridden to `3.2.3` in `package.json` (registry tarball for 3.2.4 is broken).
- No secrets committed; public config only via `EXPO_PUBLIC_*`; server secrets live in Supabase function env / CI secrets.

---

### Task 1: Project hygiene and app configuration

**Files:**
- Delete: `app.json`, `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`, `src/app/explore.tsx`
- Create: `app.config.ts`, `eas.json`, `.env.example`, `.node-version`, `prettier.config.mjs`
- Modify: `package.json` (scripts, engines), `README.md`, `LICENSE`, `.gitignore`, `tsconfig.json`, `AGENTS.md`

**Interfaces:**
- Produces: config constants consumed by later tasks — `extra.supabaseUrl`/`extra.supabaseAnonKey` read from `EXPO_PUBLIC_*`; EAS profiles `development` (APK + dev client), `preview` (APK), `production` (AAB).

- [ ] **Step 1:** Delete `app.json`, template tab components, and `explore.tsx`.
- [ ] **Step 2:** Add `app.config.ts`:

```ts
import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Duskwave',
  slug: 'duskwave',
  version: '0.1.0',
  scheme: 'duskwave',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0B0F',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.dev9269.duskwave',
  },
  android: {
    package: 'com.dev9269.duskwave',
    adaptiveIcon: {
      backgroundColor: '#0B0B0F',
      foregroundImage: './assets/images/android-icon-foreground.png',
    },
    predictiveBackGestureEnabled: true,
  },
  web: { output: 'static', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-dev-client',
    ['expo-audio', { enableBackgroundPlayback: true, recordAudioAndroid: false, microphonePermission: false }],
    'expo-secure-store',
    ['expo-splash-screen', { backgroundColor: '#0B0B0F', image: './assets/images/splash-icon.png', imageWidth: 120 }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
});
```

- [ ] **Step 3:** Add `eas.json` with `development` (developmentClient, internal, APK), `preview` (APK), `production` (AAB). Add `.node-version` = `22`. Add `.env.example` with every variable from the spec.
- [ ] **Step 4:** `npm.cmd run typecheck` → expect pass after task 2 files exist; config alone does not typecheck app code.
- [ ] **Step 5:** Commit: `chore: configure app identity, dev builds, and env template`.

---

### Task 2: Design system foundation

**Files:**
- Create: `src/ui/tokens.ts`, `src/ui/typography.ts`, `src/ui/primitives/text.tsx`, `button.tsx`, `card.tsx`, `screen.tsx`, `section-header.tsx`, `track-row.tsx`, `skeleton.tsx`, `empty-state.tsx`, `pill.tsx`, `index.ts`
- Test: `src/ui/__tests__/format.test.ts` + `src/lib/format.test.ts` (pure helpers)

**Interfaces:**
- Produces: `colors`, `spacing`, `radii`, `fontFamily`; components `Text`, `Button`, `Card`, `Screen`, `SectionHeader`, `TrackRow`, `Skeleton`, `EmptyState`, `Pill` with typed props; `formatDuration(ms: number): string`, `formatCount(n: number): string`.

- [ ] **Step 1:** Write failing test for `formatDuration(245000) === '4:05'` and `formatCount(1234) === '1.2K'`.
- [ ] **Step 2:** Run `npm.cmd test` → FAIL (module not found).
- [ ] **Step 3:** Implement tokens + primitives + `src/lib/format.ts`.
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit: `feat(ui): add Editorial Dark tokens and primitives`.

---

### Task 3: Supabase client, env, and typed contracts

**Files:**
- Create: `src/lib/env.ts`, `src/lib/supabase.ts`, `src/lib/query-client.ts`, `src/types/database.ts`
- Test: `src/lib/env.test.ts` (URL validation + configured flag)

**Interfaces:**
- Produces: `isSupabaseConfigured: boolean`, `supabase: SupabaseClient<Database> | null`, `getSupabase(): SupabaseClient<Database>` (throws a clear error when unconfigured), `queryClient`.

- [ ] **Step 1:** Write failing tests for `parseSupabaseEnv({ url: 'https://x.supabase.co', anonKey: 'k' })` returning configured true and rejecting non-https URLs.
- [ ] **Step 2:** Implement `env.ts` + `supabase.ts` (AsyncStorage auth storage, `autoRefreshToken`, AppState auto-refresh hook wiring) + baseline `Database` type for `profiles`, `tracks`, `playlists`, `playlist_tracks`, `plays`, `skip_events`, `jam_*`, `import_*`.
- [ ] **Step 3:** Tests PASS; `npm.cmd run typecheck` PASS.
- [ ] **Step 4:** Commit: `feat: add Supabase client and typed contracts`.

---

### Task 4: Database baseline migration, RLS, RPCs, storage

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20261117000100_init.sql`, `supabase/tests/0001_rls.sql`, `supabase/seed.sql`
- Test: SQL assertions in `0001_rls.sql` (pgTAP)

**Interfaces:**
- Produces: enums and tables from spec §6.4; `handle_new_user()` trigger; `seed_demo_history()` (idempotent, security definer, returns inserted count); `consume_skip()` (returns boolean, free tier limit 6/hour); `touch_updated_at()` trigger; storage buckets `avatars`, `artwork`, `uploads` with owner-scoped upload policies.

- [ ] **Step 1:** Write the migration with tables, indexes (`tracks.slug`, `plays(user_id, started_at)`, `skip_events(user_id, created_at)`, `jam_sessions.code`), RLS enabled everywhere, and policies per spec.
- [ ] **Step 2:** Write pgTAP tests: anonymous cannot read others' plays; owner can insert own plays; `seed_demo_history` twice yields no duplicates; `consume_skip` returns false after 6 calls in an hour.
- [ ] **Step 3:** Run locally if Docker is up: `npx.cmd supabase start` → `npx.cmd supabase db reset` → `npx.cmd supabase test db`. If Docker is unavailable, document that CI runs this job and do not claim local success.
- [ ] **Step 4:** Commit: `feat(db): baseline schema, RLS, RPCs, storage policies`.

---

### Task 5: Authentication and route protection

**Files:**
- Create: `src/features/auth/session-provider.tsx`, `src/features/auth/use-session.ts`, `src/features/auth/oauth.ts`, `src/features/auth/username.ts`, `src/features/auth/__tests__/username.test.ts`
- Modify: `src/app/_layout.tsx`
- Create routes: `src/app/index.tsx`, `src/app/(auth)/_layout.tsx`, `welcome.tsx`, `sign-in.tsx`, `sign-up.tsx`, `onboarding.tsx`, `src/app/auth-callback.tsx`

**Interfaces:**
- Produces: `SessionProvider` (session + `loading`), `useSession()`, `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `signOut`, `isValidUsername(name): boolean`, `normalizeUsername(raw): string`.

- [ ] **Step 1:** Failing test: `normalizeUsername('  Jainam M. ') === 'jainam-m'`; `isValidUsername('a') === false`; `isValidUsername('dusk_wave') === true`.
- [ ] **Step 2:** Implement username helpers → tests PASS.
- [ ] **Step 3:** Root layout: load fonts (Fraunces + Inter), SplashScreen hide, providers, `Stack` with `Stack.Protected guard={!!session}` for `(tabs)` and inverse for `(auth)`, modal `player`, `settings`.
- [ ] **Step 4:** Sign-in/sign-up screens with email/password, Google button (disabled + notice when Supabase is unconfigured), friendly errors.
- [ ] **Step 5:** `auth-callback.tsx` exchanges the Supabase OAuth code for a session.
- [ ] **Step 6:** Commit: `feat(auth): sessions, email/password, Google OAuth, protected routes`.

---

### Task 6: Tab shell, screens, mini-player placeholder

**Files:**
- Create: `src/app/(tabs)/_layout.tsx`, `index.tsx` (Home), `search.tsx`, `library.tsx`, `profile.tsx`, `src/app/player.tsx`, `src/app/settings/index.tsx`
- Create: `src/ui/player-bar.tsx`

**Interfaces:**
- Produces: four-tab shell (Home/Search/Library/Profile), mini-player bar with disabled transport and "Nothing playing", Settings screen with demo-history RPC call wired (no-op until catalog exists) and sign-out.

- [ ] **Step 1:** Implement tab layout using `Tabs` from `expo-router/js-tabs` with tokens styling.
- [ ] **Step 2:** Home shows greetings + empty-state sections; Search shows a search field stub; Library shows playlist/liked placeholders; Profile shows user identity + links to Settings.
- [ ] **Step 3:** Settings: "Load demo history" button calls `supabase.rpc('seed_demo_history')`, toasts the inserted count; sign-out button.
- [ ] **Step 4:** `npm.cmd run typecheck` + `npm.cmd run lint` → PASS.
- [ ] **Step 5:** Commit: `feat(app): tab shell, screens, mini-player placeholder`.

---

### Task 7: Deep links and Spotify auth helper

**Files:**
- Create: `src/features/importer/spotify-auth.ts`, `src/features/importer/__tests__/spotify-auth.test.ts`
- Create: `src/app/redirect.tsx`
- Create: `docs/runbook.md`

**Interfaces:**
- Produces: `SPOTIFY_REDIRECT_URI = 'duskwave://redirect'`, `createSpotifyAuthUrl({ clientId, state, codeChallenge })` returning a URL with `response_type=code`, `code_challenge_method=S256`, exact redirect and scopes; `redirect.tsx` route that validates `state` and forwards `code` (stub for M3 import call).

- [ ] **Step 1:** Failing test asserts the generated URL contains `redirect_uri=duskwave%3A%2F%2Fredirect`, `code_challenge_method=S256`, and both playlist scopes.
- [ ] **Step 2:** Implement helper → test PASS.
- [ ] **Step 3:** Implement `redirect.tsx` with error states (`missing_code`, `state_mismatch`) and a success screen.
- [ ] **Step 4:** Runbook documents: adb deep-link test, Spotify dashboard values, Supabase redirect allowlist (`duskwave://auth-callback`, `duskwave://redirect`), env setup, R2 setup, seed commands, EAS login/build, Node pin, npm.cmd note.
- [ ] **Step 5:** Commit: `feat(importer): deep-link redirect and Spotify auth URL helper`.

---

### Task 8: Catalog seeder skeleton

**Files:**
- Create: `scripts/seed-catalog.ts`, `catalog/manifest.example.json`, `src/types/catalog-manifest.ts` (zod schema shared), `src/features/catalog/__tests__/manifest.test.ts`
- Modify: `package.json` scripts

**Interfaces:**
- Produces: `CatalogManifestSchema` (zod) with required `slug, title, artist, album, genre, mood, durationMs, audioUrl, artworkUrl, license, licenseUrl, attribution`; CLI flags `--dry-run`, `--limit`, `--force`, `--verify`; exit code 1 on validation/verification failure.

- [ ] **Step 1:** Failing test: manifest missing `attribution` fails validation; valid fixture passes.
- [ ] **Step 2:** Implement schema + tests PASS.
- [ ] **Step 3:** Implement CLI: validate → optional download/upload/upsert → verify summary. Dry-run performs validation + prints the planned operations only.
- [ ] **Step 4:** `npm.cmd run seed:catalog -- --dry-run --limit 5` → PASS (prints 5 planned entries).
- [ ] **Step 5:** Commit: `feat(seed): idempotent catalog seeder with dry-run`.

---

### Task 9: CI, keepalive, and documentation

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/seed-catalog.yml`, `.github/workflows/keepalive.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: CI jobs `app` (typecheck, lint, jest) and `db` (Supabase CLI migrate + pgTAP); manual seed workflow; weekly keepalive.

- [ ] **Step 1:** `ci.yml` on push/PR: Node 22, `npm ci`, typecheck, lint, test; db job with `supabase/setup-cli-action`, `supabase start`, `supabase db reset`, `supabase test db`.
- [ ] **Step 2:** `seed-catalog.yml` (`workflow_dispatch`) with R2/Supabase secrets calling `npm run seed:catalog -- --verify`.
- [ ] **Step 3:** `keepalive.yml` weekly curl to `${SUPABASE_URL}/rest/v1/` with anon key secret.
- [ ] **Step 4:** README: pitch, feature list, architecture diagram (ASCII), quickstart, roadmap (M0 checked, M1–M7 listed), licenses/legal section, honest importer metrics statement.
- [ ] **Step 5:** Commit: `ci: add app and database pipelines, keepalive, and README`.

---

### Task 10: Final verification and repository publication

**Files:**
- Modify: plan checkboxes, `CONTRIBUTIONS.md` untouched.

- [ ] **Step 1:** `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test -- --ci`, `npm.cmd run seed:catalog -- --dry-run --limit 5` all green.
- [ ] **Step 2:** `npx.cmd expo config --type public` shows scheme `duskwave`, package/bundle IDs, and the expo-audio background plugin.
- [ ] **Step 3:** `npx.cmd expo-doctor` reported and documented (warnings acceptable only if explained).
- [ ] **Step 4:** Commit all, then `gh repo create Dev9269/duskwave --public --source . --remote origin --push` (or push existing remote).
- [ ] **Step 5:** Record M0 completion status in the README roadmap.

## Self-Review

- Spec coverage: M0 items from spec §9 map to Tasks 1–10 (repo/config), 2 (design system), 4 (DB), 5 (auth), 6 (shell), 7 (deep link + runbook), 8 (seed), 9 (CI/docs). M1+ features are intentionally out of this plan.
- Placeholders: none; all code paths and commands are explicit. Environment-dependent steps (Supabase project creation, EAS login, Spotify dashboard, R2 credentials) are documented as operator steps in the runbook rather than faked.
- Type consistency: `SessionProvider`/`useSession`, `getSupabase()`, `CatalogManifestSchema`, `SPOTIFY_REDIRECT_URI`, and `formatDuration` are named identically across tasks.

## Progress log

- 2026-11-17: Tasks 1-10 implemented. typecheck/lint/jest green (18 tests); pgTAP 12/12 pass against local Supabase; seed:catalog --dry-run --limit 5 prints 5 planned entries; expo config shows scheme, IDs, and the expo-audio background plugin; expo-doctor 20/20.
- Deviations: npm run lint calls ESLint directly (expo lint rejected ESLint 9.39 here); tsconfig includes jest+node types; added expo-asset peer for expo-audio; js-tabs resolved through the expo-router exports map.
