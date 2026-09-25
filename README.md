# Game Calendar — Game Release Tracker

Game Calendar is a personal desktop application for tracking upcoming game releases and maintaining a completed-games journal. It combines an Electron shell, a Fastify backend child process, a React/Vite renderer, and a local SQLite database.

The repository is named **Game Calendar**. The installed product and UI are currently branded **Game Release Tracker**.

## Why this project is worth reviewing

This is a complete local-first desktop product rather than a collection of UI screens. It demonstrates:

- a multi-process Electron design with a privileged desktop shell and isolated backend;
- a typed frontend/backend contract through `shared/`;
- SQLite migrations, read models, repositories, write serialization, and full-text search;
- an IGDB sync pipeline with normalization, planning, merging, blocking, and artwork enrichment;
- a completed-games library you add to in the app, matched to IGDB for covers and details;
- safe error handling, diagnostic logging, renderer recovery, and cross-platform app-data restore logic;
- tests organised around the same module seams used by production callers.

## Product capabilities

- Browse upcoming releases in a featured backdrop and compact date list, or a calendar view.
- Search, filter, watch, hide, edit, delete, or delete-and-block releases.
- View artwork, screenshots, metadata, and optional upcoming-release trailers.
- Add releases manually and search IGDB candidates.
- Add completed games in the app, with your rating, completion date and notes.
- Match completed games to IGDB and correct uncertain matches without losing the override on later syncs.
- Spin the Randomizer for a random released game from IGDB, filtered by genre, theme, platform, rating and year, with a cooldown so picks rarely repeat.
- Look back with Year in Review: a yearly recap of the Completed Library in five chapters (numbers, taste, ratings and player type, timing, Game of the Year with optional YouTube theme music), saved as an image on desktop.
- Store wallpapers and user-owned imports in app data; choose one of 12 locally remembered appearance palettes.
- Inspect redacted diagnostics when backend, renderer, or desktop operations fail.

## Architecture at a glance

```text
Electron main process (apps/desktop)
        │ starts the backend and exposes native IPC
        ▼
Fastify backend child (apps/backend) ───► runtime app-data storage (apps/runtime)
        │                                  ├── SQLite database
        ├── REST routes                    ├── Completed Library
        ├── actions and domain modules     └── wallpaper / diagnostics files
        ├── sync and provider adapters
        └── repositories and read models

React renderer (apps/frontend) ──HTTP──► Fastify routes
        │
        └────────────── shared types/constants (shared)
```

The renderer owns presentation and user intent. The backend owns application behaviour and persistence. The desktop process owns privileged capabilities. Runtime modules own filesystem paths and app-owned files. This keeps each interface small and makes behaviour testable at a stable seam.

## Repository map

Use [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md) for the complete ownership map, dependency direction, feature map, and change rules.

```text
apps/backend/     Fastify process, routes, actions, domain modules, SQLite, providers
apps/desktop/     Electron main process, lifecycle, preload, native IPC
apps/frontend/    React shell, workflows, API client, views, styling
apps/runtime/     App-data paths, restore discovery, wallpaper storage
shared/           Cross-process types and constants
tests/            Backend, desktop, and frontend tests mirroring production seams
docs/             Architecture, product, beginner, planning, and review documentation
build/            Packaging assets
```

For a guided code tour, see [`docs/REVIEW_GUIDE.md`](docs/REVIEW_GUIDE.md).

## Quick start

The project does not need API credentials for installation, tests, or compilation.

```bash
npm install
npm test
npm run build
```

Useful scripts:

| Command | Purpose |
|---|---|
| `npm run test:backend` | Run backend and persistence tests only. |
| `npm run test:frontend` | Run renderer and workflow tests only. |
| `npm run typecheck` | Type-check everything, tests included (the build skips test files). |
| `npm run dev` | Start the Vite renderer development server. |
| `npm run dev:backend` | Start the Fastify backend child directly. |
| `npm run rebuild` | Rebuild `better-sqlite3` for the local Electron runtime. |
| `npm run build` | Type-check/compile the backend, desktop, runtime, shared code, and renderer bundle. |
| `npm run dist` | Build and package platform-specific Electron artifacts. |

The current validation checkpoint passes **30 test files / 165 tests** and the production build.

## Configuration and data

Copy `.env.example` only when environment-based credentials are needed. Live sync requires IGDB credentials; SteamGridDB artwork is optional. The application also supports entering credentials through Settings.

Never commit real credentials, databases, wallpapers, logs, or packaged app data. Local runtime data is deliberately excluded from this repository. Packaged restore input can be supplied separately through `GRT_RESTORE_DIR` when needed.

## Engineering documentation

- [`docs/REVIEW_GUIDE.md`](docs/REVIEW_GUIDE.md) — the fastest route for a technical reviewer.
- [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md) — folder ownership, dependency direction, and safe change seams.
- [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) — detailed architecture, database, API, testing, and packaging reference.
- [`docs/BEGINNERS_GUIDE.md`](docs/BEGINNERS_GUIDE.md) — plain-English product and operation guide.
- [`CONTEXT.md`](CONTEXT.md) — domain vocabulary and decisions that protect behaviour during changes.

## Current scope and honest limitations

- This is a single-user local desktop application, not a hosted multi-user service.
- Windows is the primary packaged target; the source and tests also support Linux development.
- Live release sync depends on third-party IGDB credentials and network access.
- There is no account system, cloud database, or server-side collaboration layer.
- The repository is a private portfolio project and does not currently include an open-source license.

These limits are intentional product scope, not hidden infrastructure.
