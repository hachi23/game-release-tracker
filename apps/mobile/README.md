# Android preview (proof of concept)

Checks whether the desktop app can become an Android app without rewriting it. The answer so far: the
renderer and the backend's stores run unchanged inside a Capacitor WebView.

## How it fits

```text
Desktop:  React renderer ──HTTP──► Fastify child process ──► better-sqlite3 (native)
Android:  React renderer ──calls──► mobileApiClient ────────► wasmDatabase (SQLite WASM, FTS5)
                                    (same backend stores and actions)
```

- `src/wasmDatabase.ts`: the part of better-sqlite3's interface the backend uses (`prepare().get/all/run`,
  `exec`, `pragma`, nested `transaction`), on the official SQLite WASM build. sql.js was ruled out
  because it has no FTS5, which `releases_fts` needs. The library is kept in WebView localStorage
  (kvvfs) so it survives restarts.
- `src/mobileApiClient.ts`: an `ApiClient` that calls backend stores and actions directly, mirroring
  `apps/backend/src/routes`. Ported calls: release list and detail, Completed Library list and
  detail, sample library, settings and sync status (read), preferences. Every other call rejects with
  `NotOnAndroidYet`.
- `src/nodeShims/*`: browser stand-ins for `node:crypto`, `node:fs`, `node:path` and `node:os`, wired up
  in `vite.config.ts`.
- `android/`: the Capacitor project (`capacitor.config.ts` at the repo root).

`tests/mobile/mobileApiClient.test.ts` loads the sample library through both paths and checks that the
in-app client returns exactly what the desktop backend returns over HTTP (ids aside).

## Build

```bash
npm run build:mobile   # web bundle to dist/mobile, copied into the Android project
npm run android:apk    # also builds apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

The APK build needs JDK 21 and an Android SDK with platform 36 (`ANDROID_HOME`).

## Not ported yet

IGDB sync and search (the WebView needs Capacitor's native HTTP to get past CORS), editing and deleting,
custom artwork, wallpaper, cover cache, credential encryption (Android Keystore), release alerts
(local notifications), Randomizer, Year in Review, and a phone layout. Storage should move from
localStorage to the OPFS VFS in a worker before real libraries go in.
