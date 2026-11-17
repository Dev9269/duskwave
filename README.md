# Duskwave

A dark, editorial music streaming app — built from scratch as an open-source portfolio project.

Duskwave plays a curated catalog of Creative Commons licensed music, imports your Spotify playlists
as metadata (never audio), hosts realtime Jam listening rooms, and grows pair-based Blend playlists
from shared taste. No copied assets, no proprietary code, no Spotify audio.

**Status:** Milestone M0 (foundation) — in progress.

## Features

- **Catalog & playback** — ~200 CC-licensed tracks, search with genre/mood/BPM filters, queue,
  shuffle/repeat, background playback and lock-screen controls.
- **Playlists & uploads** — create, reorder, like songs, upload your own audio (owner-private).
- **Spotify importer** — OAuth + PKCE metadata import with honest matching: exact, suggested vibe
  match, or clearly labeled placeholder. Your Spotify audio is never touched.
- **Jam** — host-authoritative realtime listening rooms with shared queue, presence, and ±250 ms sync.
- **Blend** — deterministic taste-match playlists for two people, refreshed weekly.
- **History & stats** — scrobbles, weekly minutes, top artists, listening streaks.
- **Premium simulation** — server-enforced skip/upload limits, demo checkout, offline downloads.
- **Demo mode** — one tap loads two weeks of listening history so charts and Blend look alive.

## Architecture

```text
                    ┌───────────────────────────────────────┐
                    │            Expo app (RN)              │
                    │  Expo Router · expo-audio · Zustand   │
                    │  TanStack Query · SecureStore          │
                    └──────────────┬────────────────────────┘
             PKCE auth + RLS data  │  Realtime broadcast/presence
                    ┌──────────────▼────────────────────────┐
                    │               Supabase                │
                    │  Auth · Postgres + RLS · Storage       │
                    │  Realtime · Edge Functions             │
                    │    · spotify-import (token exchange)   │
                    │    · r2-sign (short-lived audio URLs)  │
                    └───────┬───────────────────────┬────────┘
        signed audio URLs   │                       │ metadata import
                    ┌───────▼────────┐      ┌───────▼─────────────┐
                    │ Cloudflare R2  │      │ Spotify Web API     │
                    │ CC audio + art │      │ playlists only      │
                    └────────────────┘      └─────────────────────┘
```

- **App:** Expo SDK 58 / React Native 0.88 / TypeScript strict. Routes live in `src/app/`;
  feature code in `src/features/*`; design tokens and primitives in `src/ui`.
- **Playback:** `expo-audio` (`AudioPlaylist`) with background playback and lock-screen controls,
  configured through the `expo-audio` config plugin. Development builds only.
- **Data:** every table is RLS-protected. Skip limits and demo-history seeding are `security
  definer` RPCs, so the client cannot talk its way past them.
- **Audio delivery:** R2 holds the CC catalog; `r2-sign` issues short-lived signed URLs. Supabase
  Storage is the local/dev fallback.

## Spotify importer, honestly

The importer reads playlist **metadata** through the official Spotify Web API. It never downloads,
streams, or re-hosts Spotify audio.

Matching is four-tier and always labeled in the UI:

1. **Exact** — ISRC match (or normalized title + artist + duration within tolerance).
2. **Suggested** — trigram similarity ≥ 0.85 with duration sanity check.
3. **Vibe match** — genre/mood enrichment via Deezer's public API, marked as a suggestion.
4. **Placeholder** — metadata-only row you can swap later. Clearly marked, never silently faked.

Expected match rates: **≥ 95%** against the curated CC catalog (it is built for this), and roughly
**5–15%** for a typical mainstream Spotify playlist. The import screen reports the real numbers
instead of hiding them.

## Stack

Expo SDK 58 · React Native 0.88 · TypeScript strict · Expo Router · expo-audio · Zustand ·
TanStack Query · Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions) ·
Cloudflare R2 · GitHub Actions + EAS.

## Quickstart

```powershell
# Node 22 LTS is required (see .node-version)
npm.cmd install
Copy-Item .env.example .env.local   # fill in Supabase + R2 + Spotify values
npx.cmd supabase@latest db start    # local Postgres (Docker required)
npx.cmd supabase@latest db reset    # apply migrations
npm.cmd start
```

App config: scheme `duskwave`; Spotify OAuth redirect `duskwave://redirect`; Supabase auth
callback `duskwave://auth-callback`. Testing the deep link once a dev build is installed:

```powershell
adb shell am start -a android.intent.action.VIEW -d "duskwave://redirect?code=test&state=test"
```

Operator setup (Supabase, Spotify dashboard, R2, EAS) lives in [docs/runbook.md](docs/runbook.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run start` | Expo dev server |
| `npm.cmd run typecheck` | TypeScript |
| `npm.cmd run lint` | ESLint |
| `npm.cmd test` | Jest |
| `npx.cmd supabase@latest test db` | pgTAP schema/RLS tests |
| `npm.cmd run seed:catalog -- --dry-run` | Validate catalog manifest |
| `npm.cmd run seed:catalog -- --verify` | Check catalog rows and audio keys |
| `npm.cmd run seed:catalog` | Upload catalog to R2 + Supabase (idempotent) |

## Roadmap

- [x] M0 — Foundation: repo, CI, auth, design system, tab shell, deep links, DB baseline, seeder
- [ ] M1 — Catalog + playback
- [ ] M2 — Playlists + uploads
- [ ] M3 — Spotify importer
- [ ] M4 — Jam
- [ ] M5 — Blend + listening stats
- [ ] M6 — Premium simulation
- [ ] M7 — Polish, E2E, demo video, release APK

## Legal

Catalog audio is Creative Commons licensed; every track ships with license and attribution shown
in-app. Spotify integration uses the official Web API for metadata only, with user-initiated OAuth.
Duskwave is not affiliated with Spotify. Uploaded audio stays private to its owner. The demo catalog
manifest is illustrative (`example.com` URLs) until real CC tracks are sourced.
