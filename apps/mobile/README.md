# Android app

The Android version of Game Release Tracker. It runs the desktop app's backend inside the app, and has
its own interface: the **Magic Academy** notebook, built for phones. The desktop app keeps its own UI.

## How it fits

```text
Desktop:  React renderer ──HTTP──► Fastify child process ─────────────► better-sqlite3 (native)
Android:  Academy UI ──ApiClient──► in-app router (same route modules) ──► SQLite WASM in memory ──► tracker.db
```

- `src/backend/inAppServer.ts`: registers the backend's own route modules (`apps/backend/src/routes`) on a
  small in-page router and answers the desktop `ApiClient`'s requests without a network. Routes that
  serve files from disk (local artwork, cover cache, wallpaper, the built frontend) are not registered and
  answer "This isn't available in the Android app yet."
- `src/wasmDatabase.ts`: the part of better-sqlite3's interface the backend uses, on the official SQLite
  WASM build (FTS5 included; sql.js has none). Statements stay synchronous, so stores and actions run
  unchanged. It reports each committed write.
- `src/libraryFile.ts`: the library is one file, `tracker.db`, in the app's private data folder. It is
  saved shortly after writes settle and when the app leaves the screen (written beside the old copy, then
  renamed over it). In a desktop browser it goes to IndexedDB instead.
- `src/boot.ts`: opens the library, syncs on start and on return when a sync is due, and turns release
  alerts for watched games into Android notifications.
- `src/academy/*`: the Magic Academy UI. `theme.css` holds both looks as tokens; `term.ts` picks one.
- `src/nodeShims/*`: browser stand-ins for `node:crypto`, `node:fs`, `node:path`, `node:os`.
- `android/`: the Capacitor project (`capacitor.config.ts` at the repo root). `CapacitorHttp` sends the
  backend's IGDB and Twitch requests through Android's native HTTP, which CORS doesn't apply to.

`tests/mobile/mobileApiClient.test.ts` runs one user session (sample library, edits, deletes, Completed
Library, Year in Review, settings, sync settings) through the in-app backend and through the real Fastify
backend, and requires the same answers. It also covers saving and reopening the library file.

## The Magic Academy look

The app is an open notebook on a navy uniform with gold trim: parchment pages, ruled lines with a red
margin, handwritten notes, taped polaroid covers, red-circled countdowns, sticky notes. Coloured bookmark
ribbons are the navigation: along the bottom on a phone, down the right edge on a tablet or a phone on
its side, where the notebook opens into a two-page spread.

**Day Term** is parchment in daylight. **Night Study** is the same notebook by candlelight, not a black
theme: midnight-indigo surfaces (never pure black), paper that gets lighter rather than shadowed when it
sits higher, warm cream text (never pure white), lighter and softer inks so they don't vibrate on dark
paper, gilt ruled lines and a faint candle glow at the top of the page. Settings → Look picks Day Term,
Night Study, or Match my phone. Every text colour meets WCAG AA (4.5:1) in both.

An upcoming game's page is the **Spellbook Entry**: the cover in an arched window, an illuminated capital,
a ring of fourteen moons for the last two weeks, the trailer in a round "scrying glass" (mounted only after
Play), and a wax seal to watch it.

Year in Review is the **Yearbook**: an animated cover, then five chapters (Enrolment, Curriculum,
Examinations, Timetable, Commencement). Each chapter change sweeps a ribbon-coloured wipe across the page,
cards rise in, numbers count up and bars grow, with drifting particles per chapter. Months, subjects,
campuses and grades open a shelf of their games; Commencement picks the Game of the Year and plays the
theme song, which keeps playing across chapters. Cards with no data are left out, as on the desktop.

A finished game's page is still a working page; its design (the Diary Entry concept) is being decided.

## Build

```bash
npm run build:mobile   # web bundle to dist/mobile, copied into the Android project
npm run android:apk    # also builds apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

The APK build needs JDK 21 and an Android SDK with platform 36 (`ANDROID_HOME`).

## Not on Android yet

Custom artwork uploads, the cover cache, wallpaper, and syncing in the background while the app is
closed (it syncs when opened). IGDB keys are kept unencrypted in the app's private storage, which other
apps can't read; moving them to the Android Keystore is still to do.
