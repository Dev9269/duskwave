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

## Stack

Expo SDK 58 · React Native 0.88 · TypeScript strict · Expo Router · expo-audio · Zustand ·
TanStack Query · Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions) ·
Cloudflare R2 · GitHub Actions + EAS.

## Quickstart

```powershell
# Node 22 LTS is required (see .node-version)
npm.cmd install
Copy-Item .env.example .env.local   # fill in Supabase + R2 + Spotify values
npm.cmd start
```

App config: scheme `duskwave`; Spotify OAuth redirect `duskwave://redirect`.
Testing the deep link once a dev build is installed:

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
| `npm.cmd run seed:catalog -- --dry-run` | Validate catalog manifest |
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
Duskwave is not affiliated with Spotify. Uploaded audio stays private to its owner.
