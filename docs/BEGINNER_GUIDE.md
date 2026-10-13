# Game Release Tracker, from zero

This guide explains the whole project for someone who has never built software. It starts with what the app does, then teaches the few computing ideas you need, then follows the code from the moment you double-click the app to the moment a game appears on screen. The last part prepares you to talk about the project in an interview.

Read it in order the first time. Each part builds on the one before it. File paths like `apps/backend/src/server.ts` point at the real code, so you can open the file and see the thing being described.

Facts in this guide are true for version 0.6.3: about 14,300 lines of TypeScript in `apps/` and `shared/`, about 9,800 lines of tests, and 538 automated tests.

---

## Contents

1. [What the app does](#1-what-the-app-does)
2. [Computing ideas you need first](#2-computing-ideas-you-need-first)
3. [The big picture, one piece at a time](#3-the-big-picture-one-piece-at-a-time)
4. [What happens when you double-click the app](#4-what-happens-when-you-double-click-the-app)
5. [How the window talks to the engine](#5-how-the-window-talks-to-the-engine)
6. [Inside the engine: route, action, store, database](#6-inside-the-engine-route-action-store-database)
7. [The database](#7-the-database)
8. [Feature: Upcoming releases and sync](#8-feature-upcoming-releases-and-sync)
9. [Feature: the Completed Library](#9-feature-the-completed-library)
10. [Feature: the Randomizer](#10-feature-the-randomizer)
11. [Feature: Year in Review](#11-feature-year-in-review)
12. [Feature: the sample library](#12-feature-the-sample-library)
13. [The window in depth: React and the frontend](#13-the-window-in-depth-react-and-the-frontend)
14. [Security and privacy](#14-security-and-privacy)
15. [When things go wrong: errors and logs](#15-when-things-go-wrong-errors-and-logs)
16. [How the code is tested](#16-how-the-code-is-tested)
17. [From source code to an installer](#17-from-source-code-to-an-installer)
18. [Every folder, explained](#18-every-folder-explained)
19. [Why it is built this way](#19-why-it-is-built-this-way)
20. [Interview preparation](#20-interview-preparation)
21. [Glossary](#21-glossary)

---

## 1. What the app does

Game Release Tracker is a desktop app for Windows and Linux. It has four screens that matter:

- **Upcoming.** A list of games that are coming out soon from the publishers you follow, with a countdown to each one. There is also a **Calendar** view of the same list.
- **Completed Library.** A journal of the games you have finished: when you finished, on what system, your rating and your notes.
- **Randomizer.** You can't decide what to play, so it picks a random released game that fits your filters.
- **Year in Review.** A recap of the games you finished in one year, told in five illustrated chapters, which you can save as an image.

There is no account and no server. Everything you type is stored in one file on your own computer. The app goes to the internet only to look up game information on IGDB, the Internet Game Database.

A new user can press **Try it with sample data** on the welcome screen and see every screen filled in, without signing up for anything.

---

## 2. Computing ideas you need first

You need about fifteen ideas to follow the rest of this guide. Each one gets a plain definition, then the part of this project where it shows up.

### Program and process

A **program** is a file of instructions. A **process** is a program that is running. Your computer runs many processes at once: your browser, your music player, this app. Each process has its own memory, and one process can't read another's memory. If one process crashes, the others keep running.

This app runs as several processes that work together. That is the most important fact about how it is built.

### Frontend and backend

The **frontend** is the part you see and click: buttons, lists, pictures. The **backend** is the part that does the work behind the screen: it stores data, talks to the internet and applies rules.

In this app, the frontend lives in `apps/frontend/` and the backend lives in `apps/backend/`.

### JavaScript, TypeScript and Node.js

**JavaScript** is the programming language web pages are written in. **TypeScript** is JavaScript plus **types**. A type says what kind of value something is: a number, a piece of text, a list of games. TypeScript checks the types before the program runs, so a mistake like passing text where a number was expected is caught early. Every `.ts` and `.tsx` file in this project is TypeScript.

JavaScript first ran only inside web browsers. **Node.js** lets it run outside a browser, where it can read files and open network connections. The backend runs on Node.js.

### Electron

**Electron** is a toolkit for building desktop apps out of web technology. It bundles a copy of Chromium (the engine inside Google Chrome) and Node.js into one program. Slack, Discord and Visual Studio Code are built with Electron.

An Electron app always has a **main process**, which controls windows and talks to the operating system, and one or more **renderer processes**, which each draw one window's web page. This app's main process is `apps/desktop/src/main.ts`.

### React

**React** is a library for building screens out of small pieces called **components**. A component is a function that takes some data and returns what should be on screen. When the data changes, React redraws only the parts that changed. Files ending in `.tsx` hold React components. `apps/frontend/src/views/UpcomingView.tsx` is the Upcoming screen.

### HTTP, a server and an API

**HTTP** is the language web browsers and websites use to talk. One side sends a **request** ("give me the list of releases"). The other side sends back a **response** (the list, or an error). Every request has a **method** that says what kind of request it is:

- `GET` reads something.
- `POST` creates something or starts an action.
- `PATCH` changes part of something.
- `PUT` replaces something.
- `DELETE` removes something.

Every response has a **status code**. `200` means it worked. `400` means the request was wrong. `401` means "you are not allowed in". `404` means "not found". `409` means "this conflicts with something that already exists". `500` means the server failed.

A **server** is a program that waits for requests and answers them. An **API** (application programming interface) is the list of requests a server understands, such as `GET /api/releases`. This app's backend is an HTTP server built with **Fastify**, a Node.js library for writing servers.

### localhost and ports

Every computer can talk to itself at the address `127.0.0.1`, also called **localhost**. A **port** is a numbered door on that address. Many programs can run servers on one computer, each behind a different port. This app's backend asks the operating system for any free port each time it starts.

### JSON

**JSON** is a text format for data. It looks like this:

```json
{ "title": "Persona 4 Revival", "platforms": ["PC", "PS5"], "watched": true }
```

The frontend and the backend send each other JSON.

### Database, SQL and SQLite

A **database** stores data in **tables**. A table is like a spreadsheet: each **row** is one thing (one game) and each **column** is one fact about it (title, release date). **SQL** is the language for asking a database questions and changing its data:

```sql
select title from releases where release_date >= '2026-10-01' order by release_date;
```

**SQLite** is a database that lives in a single file and runs inside your program, with no separate database server. This app's whole library is one SQLite file called `game-release-tracker.db`. The backend uses the `better-sqlite3` library to read and write it.

### Transaction

A **transaction** is a group of database changes that either all happen or none happen. If you move money between two bank accounts, you want both the withdrawal and the deposit, or neither. This app wraps every change in a transaction, so a crash halfway through can't leave half a change behind.

### Asynchronous code and promises

Some work takes time: waiting for IGDB to answer, waiting for a file to load. **Asynchronous** code starts that work and carries on with other things while it waits. A **promise** stands for a result that will arrive later. The keyword `await` means "pause this function here until the promise has its result". You will see `async` and `await` everywhere in this codebase.

### IGDB and API keys

**IGDB** (igdb.com) is a public database of video games run by Twitch. It knows each game's release dates, publishers, platforms, cover art, screenshots and trailers. Programs can query it through its API.

To use IGDB's API you need **API keys**: a client ID and a client secret that you get free from Twitch. An API key works like a password for a program. The app sends your keys to Twitch, gets back a short-lived **access token**, and sends that token with every IGDB request.

**SteamGridDB** is a second, optional source of game artwork. It also needs its own key.

### Tests

A **test** is a small program that runs part of the real program and checks the result. For example: "save a game, edit its title, run a sync, and check the title is still the edited one". If someone breaks that behaviour later, the test fails and tells them. This project uses **Vitest** to run its tests.

---

## 3. The big picture, one piece at a time

The app is three programs plus one file. This section adds them one at a time.

### Step 1: the window

The first thing you meet is a window. It is a web page, drawn by Chromium, made of React components.

```text
  ┌──────────────────────────┐
  │  The window (renderer)   │   draws screens, reacts to clicks
  └──────────────────────────┘
```

The window can't read files and can't reach IGDB. It is deliberately powerless. That keeps it safe even though it shows content from the internet, like game covers and YouTube trailers.

### Step 2: add the engine

The window gets all its data by asking a second program, the **backend**. This guide calls it the engine. It is a small HTTP server running on your own computer.

```text
  ┌──────────────────────────┐
  │  The window (renderer)   │
  └────────────┬─────────────┘
               │  HTTP requests: "list the releases", "save this rating"
  ┌────────────▼─────────────┐
  │  The engine (backend)    │   applies rules, stores data
  └──────────────────────────┘
```

### Step 3: add the library file

The engine keeps everything in one SQLite database file in your user folder. On Windows that is `%APPDATA%\Game Release Tracker\game-release-tracker.db`.

```text
  ┌──────────────────────────┐
  │  The window (renderer)   │
  └────────────┬─────────────┘
               │  HTTP
  ┌────────────▼─────────────┐
  │  The engine (backend)    │
  └────────────┬─────────────┘
               │  SQL
  ┌────────────▼─────────────┐
  │  game-release-tracker.db │   your whole library, one file
  └──────────────────────────┘
```

### Step 4: add the internet

When you press **Sync now**, or search for a game to add, the engine asks IGDB. The window never talks to IGDB's API itself.

```text
  ┌──────────────────────────┐
  │  The window (renderer)   │
  └────────────┬─────────────┘
               │  HTTP
  ┌────────────▼─────────────┐        ┌───────────────────────┐
  │  The engine (backend)    ├───────►│ IGDB and SteamGridDB  │
  └────────────┬─────────────┘  HTTPS │ (on the internet)     │
               │  SQL                 └───────────────────────┘
  ┌────────────▼─────────────┐
  │  game-release-tracker.db │
  └──────────────────────────┘
```

### Step 5: add the desktop shell

One more program starts the others and looks after them. This is Electron's main process, `apps/desktop/src/main.ts`. It starts the engine, opens the window, and does the things only a desktop program can do: show a save dialog, pick a wallpaper file, encrypt your API keys with the operating system's protection.

```text
  ┌──────────────────────────────────────────────────────────┐
  │  Desktop shell (Electron main process)                   │
  │  starts the engine, opens the window, dialogs, keys      │
  └───────┬──────────────────────────────────┬───────────────┘
          │ opens                            │ starts
  ┌───────▼──────────────────┐   HTTP   ┌────▼─────────────────┐     ┌──────────────┐
  │  The window (renderer)   ├─────────►│  The engine (backend)├────►│ IGDB         │
  └──────────────────────────┘          └────┬─────────────────┘     └──────────────┘
                                             │
                                        ┌────▼─────────────────┐
                                        │ game-release-tracker │
                                        │ .db                  │
                                        └──────────────────────┘
```

That is the whole app. The rest of this guide zooms into each box.

### Where each box lives in the code

| Box | Folder | Starts in |
|---|---|---|
| Desktop shell | `apps/desktop/src/` | `main.ts` |
| Window | `apps/frontend/src/` | `main.tsx` |
| Engine | `apps/backend/src/` | `child.ts` |
| File locations | `apps/runtime/src/` | `layout.ts` |
| Shapes all three agree on | `shared/` | `types.ts` |

`shared/types.ts` defines the shape of every piece of data that crosses between the window and the engine, such as `ReleaseListItem` and `CompletedGameDetail`. Both sides import the same definitions, so if the engine changes the shape of a release, TypeScript flags every frontend file that reads it the old way.

---

## 4. What happens when you double-click the app

Here is the startup, in order. Each step names the file that does it.

1. **Electron starts the main process.** It runs `apps/desktop/src/main.ts`.

2. **The data folder is chosen.** `main.ts` sets the folder to `Game Release Tracker` inside your app-data folder. It is named after the app, not after the code package, so two different builds of the code can't open each other's library by accident.

3. **Only one copy may run.** `app.requestSingleInstanceLock()` checks for a copy that is already open. If there is one, the new copy quits and the old window comes to the front. Two copies writing to one database file would corrupt it.

4. **A secret is made.** `main.ts` creates a random 64-character token with `randomBytes(32)`. Section 5 explains what it is for. It changes on every launch.

5. **Folders are prepared.** `prepareDesktopRuntime` in `apps/desktop/src/desktopLifecycle.ts` works out every path (database, logs, covers) through `apps/runtime/src/layout.ts`, creates the log folder, and writes a line to `logs/startup.log`.

6. **The encryption key is loaded.** `loadCredentialDataKey` in `apps/desktop/src/credentialKey.ts` reads a key file and decrypts it with the operating system's protection. Section 14 explains this chain.

7. **The engine is started.** `startBackendProcess` in `apps/desktop/src/backendProcess.ts` starts `child.ts` as a separate process with Electron's `utilityProcess.fork`. It passes the data folder, the token and the encryption key through **environment variables**, which are named values a process receives when it starts.

8. **The window is built while the engine starts.** `main.ts` creates the window hidden (`show: false`) before the engine is ready. Starting both at once saves time.

9. **The engine opens the database.** In `apps/backend/src/child.ts`, `openDatabase` opens the SQLite file, and `runMigrations` brings its tables up to date (section 7).

10. **The engine encrypts any old plain-text keys.** `encryptStoredCredentials` finds API keys an older version saved unencrypted and encrypts them.

11. **The engine starts its HTTP server.** `createBackendApp` in `apps/backend/src/server.ts` builds the Fastify server and registers every route. Then `app.listen({ host: "127.0.0.1", port: 0 })` starts it. Port `0` means "any free port". The server listens only on `127.0.0.1`, so other computers on your network can't reach it.

12. **The engine reports its port.** It sends the message `{"type":"ready","port":53412}` (the number varies) back to the main process.

13. **The main process waits for that message.** `waitForBackendReady` in `backendProcess.ts` waits up to 15 seconds. If the engine crashes first, it shows the engine's own error message. If 15 seconds pass, it kills the engine so it can't keep the database file locked.

14. **The window loads the app.** In the installed app, the window loads `app://renderer/`, a private address that `apps/desktop/src/appProtocol.ts` forwards to the engine. In development it loads the Vite development server instead (section 17).

15. **The window is shown.** `mainWindow.show()`.

16. **React starts.** `apps/frontend/src/main.tsx` asks the main process for the engine's address and the token, builds the API client, and draws the `AppShell` component.

17. **The first data arrives.** The Upcoming screen asks the engine for the release list, and the list appears.

18. **Maybe a sync starts.** If you turned auto-sync on and the last successful sync is more than 12 hours old, the engine starts one 3 seconds after startup (`shouldAutoSync` in `apps/backend/src/sync/syncStatus.ts`). The delay lets the window load first.

When you close the app, the reverse happens. The `before-quit` handler in `main.ts` sends the engine a `shutdown` message. The engine stops its server, closes the database cleanly and exits. If it hasn't exited after 3 seconds, the main process kills it.

---

## 5. How the window talks to the engine

### The API client

Every request the window makes goes through one object, the **API client**, in `apps/frontend/src/api/client.ts`. It has one method per request, with names like `listReleases`, `patchRelease` and `spinRandomizer`. Here is the core of it, trimmed:

```ts
const request = async (path, init) => {
  const headers = {
    "Content-Type": "application/json",
    "x-grt-token": apiToken
  };
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return await response.json();
};
```

`fetch` is the browser's built-in way to send an HTTP request. Every request carries the secret token in a header called `x-grt-token`. If the engine answers with an error, the client turns it into a JavaScript error, which the screen shows in a banner.

Because all requests go through one object, tests can swap it for a fake one (section 16).

### Why HTTP and not Electron's own messaging

Electron has its own way for a window to talk to the main process, called **IPC** (inter-process communication). This app uses plain HTTP for data instead. The reason is in `docs/adr/0002-local-api-answers-only-the-app.md`: with HTTP, the same frontend code runs inside the desktop app, in a normal browser during development, and in tests against a fake client. IPC is used only for the few things that must touch the operating system (section 14).

### The problem HTTP creates, and the token that solves it

Any program on your computer can send requests to a port on `127.0.0.1`. So can any website open in your browser. Without protection, a malicious web page could ask the engine to delete your library.

The engine refuses such requests in `apps/backend/src/requestGuard.ts`. It checks two things on every request:

1. **The Host header must be a loopback name** (`127.0.0.1`, `localhost` or `[::1]`). This stops an attack called **DNS rebinding**, where a website makes its own domain name point at `127.0.0.1` to sneak past the browser's rules.
2. **Every `/api` request must carry the token.** The main process created the token at startup (step 4 above). It gives the token only to the app's own window, through the preload script. Other programs and websites never see it, so their requests get `401 Missing or invalid app token`.

The comparison uses `timingSafeEqual`, which takes the same time whether the first wrong character is at the start or the end. A normal comparison stops at the first difference, and an attacker can measure that time to guess the token one character at a time.

A few `GET` requests skip the token: the page itself, its scripts, and images (`/api/covers/...`, the wallpaper). An `<img>` tag can't send a custom header. These routes only return pictures or the app's own code, and a foreign web page can show an image but can't read its pixels.

### How the window gets the token: the preload bridge

The window runs with Node.js turned off (`nodeIntegration: false`), inside Chromium's sandbox (`sandbox: true`), and isolated from Electron's internals (`contextIsolation: true`). So how does it ask the main process for anything?

Electron runs a small **preload script** before the page loads. This app's preload is `apps/desktop/src/preload.ts`, and it is twelve lines long:

```ts
contextBridge.exposeInMainWorld("releaseTracker", {
  getApiBaseUrl: () => ipcRenderer.invoke("api-base-url"),
  getApiToken: () => ipcRenderer.invoke("api-token"),
  chooseWallpaper: () => ipcRenderer.invoke("choose-wallpaper"),
  saveImage: (png, suggestedName) => ipcRenderer.invoke("save-image", png, suggestedName),
  deleteAppData: () => ipcRenderer.invoke("delete-app-data"),
  // ...
});
```

It puts one object, `window.releaseTracker`, on the page. That object offers a short fixed list of functions, and each one sends an IPC message to the main process. The page gets no other access. The main process answers `api-token` only when the asking frame is showing the app itself (`isAppFrame` in `main.ts`), so even a YouTube frame inside the window can't get it.

### The `app://renderer` address

The engine's port changes on every launch. If the window loaded its page from `http://127.0.0.1:53412`, its **origin** (scheme, host and port together) would change every launch too. Browsers keep saved data per origin, so the window would forget its saved settings and its compiled-code cache each time.

`apps/desktop/src/appProtocol.ts` fixes this. It registers a private scheme, `app://`, and serves the page from `app://renderer`, which never changes. Every request to `app://renderer/...` is forwarded to the engine at whatever port it has today.

```text
  window asks for app://renderer/api/releases
         │
         ▼
  appProtocol.ts rewrites it to http://127.0.0.1:53412/api/releases
         │
         ▼
  engine answers
```

---

## 6. Inside the engine: route, action, store, database

The engine is organised in layers. A request passes down through them and the answer comes back up. Each layer has one job.

```text
  HTTP request
       │
  ┌────▼────┐  routes/       reads the request, calls one action, sends the answer
  │  Route  │
  └────┬────┘
  ┌────▼────┐  actions/      the steps of one user task, inside one transaction
  │ Action  │
  └────┬────┘
  ┌────▼────┐  database/, completed/, ...   the only code that writes a set of tables
  │  Store  │
  └────┬────┘
  ┌────▼────┐
  │ SQLite  │
  └─────────┘
```

### A real request, all the way down

You click **Watch** on a game. Here is everything that happens.

**1. The window sends a request.** The detail page calls `api.patchRelease("igdb-501", { watched: true })`. The client sends:

```text
PATCH /api/releases/igdb-501
x-grt-token: 3f9a...
Content-Type: application/json

{"watched":true}
```

**2. The guard checks it.** `requestGuard.ts` checks the Host header and the token.

**3. The route receives it.** In `apps/backend/src/routes/releaseRoutes.ts`:

```ts
app.patch("/api/releases/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  return sendActionResult(reply, await updateRelease(db, id, request.body ?? {}));
});
```

`:id` in the path is a placeholder. Fastify fills `request.params.id` with `igdb-501`. The route does nothing else: it hands the work to an action and sends back the result. Routes are kept this thin on purpose.

**4. The action runs.** `updateRelease` in `apps/backend/src/actions/releaseActions.ts`:

```ts
export function updateRelease(db, id, payload) {
  return runWrite(db, () => updateReleaseNow(db, id, payload));
}
```

`runWrite` (below) queues the work and wraps it in a transaction. Inside, `updateReleaseNow` checks the release exists (`404` if not), checks the input (`400` if the title is empty), then asks the store to make the changes.

**5. The store writes.** `createReleaseStore(db).updateUserState(id, { watched: true })` in `apps/backend/src/database/releaseStore.ts` runs the SQL that sets `watched = 1` in the `user_release_state` table.

**6. The answer goes back up.** The action returns `{ ok: true, value: { ok: true, item: <the updated release> } }`. `sendActionResult` in `routes/actionResult.ts` turns that into a `200` response with the release as JSON. If the action had returned `{ ok: false, statusCode: 404, error: "Release not found" }`, it would send a `404` with that message.

**7. The window updates.** The detail page replaces its copy of the release with the one that came back, and the **Watching** label appears.

### Why actions return results instead of throwing errors

An action returns either `{ ok: true, value }` or `{ ok: false, statusCode, error }`. This type is `ActionResult` in `apps/backend/src/actions/actionResult.ts`. Expected problems, like "that game doesn't exist", are normal answers, not crashes. Only unexpected failures throw, and those become a safe `500` (section 15). This makes every expected outcome visible in the function's type, and TypeScript makes the caller handle both cases.

### The write queue

Two writes at the same moment could interfere: a sync saving a game while you edit the same game. `apps/backend/src/database/writeQueue.ts` prevents that in eighteen lines:

```ts
let tail = Promise.resolve();

export function enqueueWrite(job) {
  const run = tail.then(job, job);
  tail = run.catch(() => undefined);
  return run;
}

export function runWrite(db, job) {
  return enqueueWrite(() => db.transaction(job)());
}
```

`tail` is the last write in line. Each new write is chained to start after it, so writes run one at a time, in the order they arrived, like a queue at a counter. `runWrite` also wraps each job in `db.transaction`, so if the job throws an error halfway, every change it made is rolled back. The `.catch` on `tail` means one failed write doesn't block the writes behind it.

Reads don't go through the queue. SQLite's **WAL mode** (write-ahead logging, turned on in `apps/backend/src/database/db.ts`) lets reads happen while a write is in progress.

### Stores own their tables

Each group of tables has exactly one module that writes to it:

| Store | File | Writes |
|---|---|---|
| Release Store | `database/releaseStore.ts` | `releases` and every `release_*` table, overrides, blocks |
| Completed Library store | `completed/completedGameStore.ts` | `completed_games`, `completed_match_overrides` |
| Settings Store | `settings/settingsStore.ts` | the `settings` table |
| Sync Settings Store | `sync/syncSettingsStore.ts` | tracked publishers and sync choices |
| Pick history | `randomizer/pickHistoryStore.ts` | `randomizer_picks` |
| Year in Review settings | `yearInReview/yearInReviewSettingsStore.ts` | `year_in_review_settings` |

If you want to know every way a completed game can change, you read one file. Rules that must always hold live in that one file too. For example, the Completed Library store makes sure a game's rating text and rating number always agree.

### Read models

Writing and reading are split. A **read model** builds the data a screen needs, and never changes anything. `database/releaseReadModel.ts` builds the release list. It has one detail worth knowing: to show 300 releases with their publishers, platforms and artwork, a simple approach would run one query per release per table, about 1,500 queries. `hydrateListItems` runs one query per table for the whole page instead, then groups the rows in memory. That is five queries.

---

## 7. The database

### Tables

The database has about twenty tables. The ones that matter:

| Table | One row is |
|---|---|
| `releases` | an upcoming game: title, date, date precision, category |
| `release_publishers`, `release_developers`, `release_platforms`, `release_genres` | one name in a release's list |
| `release_artworks`, `release_screenshots`, `release_trailers` | one image or video of a release |
| `user_release_state` | your flags on a release: hidden, watched, released |
| `manual_overrides` | one field you edited on a release, kept so sync doesn't undo it |
| `blocked_releases` | a game you deleted and never want back |
| `releases_fts` | a search index over release titles and names |
| `sync_runs`, `sync_log` | one sync, and one line of what it did |
| `tracked_publishers` | a company you follow |
| `completed_games` | a game you finished |
| `completed_match_overrides` | which IGDB game you linked a finished game to |
| `randomizer_picks` | one Randomizer result |
| `year_in_review_settings` | your Game of the Year choice and theme music for one year |
| `settings` | one named setting, including your encrypted API keys |
| `schema_version` | one number: the version of this table layout |

A release's publishers are in their own table rather than a column, because one game can have several publishers. Each row of `release_publishers` links one release to one publisher. Connecting rows across tables like this is what makes it a **relational** database. The `release_id` column is a **foreign key**: it must match an existing release. The `on delete cascade` rule means deleting a release also deletes its publisher rows.

`releases_fts` is an **FTS** (full-text search) table. SQLite builds an index of every word in it, so searching "persona" finds matching titles instantly without reading every row. The Release Store refreshes a release's search row each time it saves the release.

### Migrations

The table layout has changed twenty times since the first version. Each change is a **migration**: a function that turns layout version N into version N+1. They are all in `apps/backend/src/database/migrations.ts`, in a list from `migrateToV1` to `migrateToV20`.

On every startup, `runMigrations`:

1. reads the number in `schema_version`;
2. **refuses to continue** if that number is higher than the newest migration it knows. A newer version of the app saved this library, and an older app might damage it. The user sees: "This library was saved by a newer version of Game Release Tracker... Update the app to open it; nothing was changed";
3. **makes a backup** if any migration is about to run, using SQLite's `vacuum into` to copy the whole database into a `backups` folder. It keeps the three newest backups;
4. runs each missing migration in order and updates the version number after each one.

A migration is never edited after it ships. A library on version 12 must go through exactly the same steps 13 to 20 as every other library did. To change something, you add migration 21.

### Settings rows

The `settings` table is a simple list of name and value pairs: `UI_PALETTE = abyss-gold`, `SYNC_AUTO = 1`, `IGDB_CLIENT_ID = enc:v1:...`. Values starting `enc:v1:` are encrypted (section 14).

---

## 8. Feature: Upcoming releases and sync

### What "sync" means

**Sync** is the job of asking IGDB for games from the publishers you follow and updating your list to match. One sync is a **Sync Run**. The code is in `apps/backend/src/sync/syncRun.ts`.

You choose what to track on **Settings → Sync**:

- **Tracked publishers**: the companies you follow, stored by their IGDB company ID.
- **Platform families**: PC, Xbox, PlayStation, Nintendo Switch. `PLATFORM_FAMILIES` in `shared/constants.ts` maps each one to IGDB's platform numbers.
- **Track from**: the earliest release date you care about. It defaults to January 1 of this year.
- **Auto-sync**: off by default.

### A Sync Run, step by step

`SyncRun.execute()` does this:

**1. Record the start.** It adds a row to `sync_runs` with status `running`.

**2. Ask IGDB.** `discoverIgdbCandidates` in `sync/igdbCandidateSource.ts` sends queries like this, in IGDB's own query language:

```text
fields id,name,game_type,first_release_date,platforms.id,release_dates.human,...;
where game_type = (0,1,2,4,8,9,10,11)
  & involved_companies.company = (70,112,...)
  & (first_release_date >= 1767225600 | release_dates.y >= 2026);
sort first_release_date asc;
limit 500;
offset 0;
```

That asks for every main game, DLC, expansion, remake, remaster and port that one of your companies was involved in, from your track-from year onward. IGDB returns at most 500 games per request, so the code asks again with `offset 500`, then `1000`, until a page comes back short. It sends at most 25 companies per query to keep queries a sensible size.

**3. Apply your rules.** Each game goes through the **Release Policy**, `createReleasePolicy` in `sync/releasePolicy.ts`. A game is rejected, with a reason, if:

- its type is not one the app tracks;
- its title contains a phrase like "Digital Deluxe", "Season Pass" or "Demo" (`EXCLUDED_TITLE_TERMS` in `shared/constants.ts`). These are editions and add-ons, not games;
- it isn't on one of your platform families;
- none of your companies is credited as its **publisher or developer**. IGDB also lists studios that only helped with a port, and those don't count;
- it has no usable release date;
- its date is before your track-from date.

Every accepted game is converted from IGDB's shape into the app's own shape, a `NormalizedRelease`, by `normalizeIgdbGame`.

**4. Choose the date.** A game often has several release dates: one per platform, and sometimes per region. `chooseBestReleaseDate` takes the earliest date on a platform you track.

Then it works out the date's **precision**. IGDB stores a game announced for "2027" with the timestamp December 31, 2027. If the app trusted that timestamp, it would say "Arrives in 461 days" and put the game on New Year's Eve. So `precisionOfDatedHuman` reads IGDB's human-readable date text instead:

| Text | Precision | Countdown? |
|---|---|---|
| `Oct 21, 2026` | Exact | yes |
| `Oct 2026` | Month | no |
| `Q4 2026`, `Fall 2026`, `Late 2026` | Window | no |
| `2027` | Year | no |
| nothing | TBA | not listed |

Only an Exact date gets a countdown or a calendar square. Everything else shows its words. The timestamp is still kept for sorting, so "Q4 2026" sorts after the exact dates in October. This decision is in `docs/adr/0005-vague-release-dates-keep-their-words.md`.

**5. Find missing artwork.** For accepted games with no artwork beyond IGDB's own, `sync/syncArtworkEnrichment.ts` asks SteamGridDB, if you saved a SteamGridDB key. It runs four lookups at a time, which is faster than one by one without flooding the service.

**6. Save each game separately.** This is the part most worth understanding.

```ts
const saveOne = this.db.transaction(candidate => this.persistCandidate(...));
for (const candidate of candidates) {
  try {
    saveOne(candidate);
  } catch (error) {
    counters.failed++;
    log(this.db, syncRunId, candidate.title, "error", error.message);
  }
}
```

The whole save runs inside one outer transaction from `runWrite`. Each game is saved inside its own inner transaction, which SQLite calls a **savepoint**. If one game fails to save, only that game's changes roll back. The error is written to the sync log and counted, and the loop carries on. The run finishes as `partial` instead of losing every game because of one bad one.

**7. Plan each save.** For each game, `planReleaseSync` in `sync/releaseSyncPlanner.ts` decides what to do. It is a **pure function**: it takes the incoming game and the stored state, and returns a decision without touching the database. Pure functions are easy to test because the same input always gives the same output.

- If the game is **blocked**, skip it.
- If the game was **rejected** by the policy, skip it and log the reason.
- Otherwise, merge it with what is stored, and save.

**8. Respect your edits.** The merge, `mergeReleaseForPersistence` in `sync/releaseMerge.ts`, is how your changes survive. When you edit a release's title or date, the Release Store does two things: it changes the row, and it records the edit in `manual_overrides` with source type `user`. On every sync, the merge re-applies those overrides on top of IGDB's data:

```text
IGDB says:          title = "Persona 4 Revival"
your override:      title = "P4 Revival (my name)"
result saved:       title = "P4 Revival (my name)"
```

There are three kinds of override, ranked: `user` beats `seeded` (curated corrections shipped in `data/source-overrides.json`), which beats `igdb`. Fields you never edited keep following IGDB, so a corrected date from IGDB still arrives.

Artwork you uploaded yourself (`source: "local"`) also stays in place through every sync.

**9. One release per game.** If you added a game by hand from IGDB search, it got an ID like `manual-7c1e...` and remembers its IGDB ID. When sync later finds the same game, `releaseStore.idForIgdbGame` finds your row and updates it instead of adding a duplicate `igdb-501` row. A unique index on `releases.igdb_id` (migration 13) makes a duplicate impossible.

**10. Finish.** The run's row is updated with counts (added, repaired, skipped, failed) and a status of `success` or `partial`. Old log lines are trimmed so only the newest 20 runs keep their logs.

**If anything unexpected goes wrong**, the `catch` in `execute()` marks the run `failed`. A run never stays marked `running` after an error. If you close the app mid-sync, the next startup marks the cut-off run `failed` with the message `interrupted` (`failInterruptedSyncRuns`).

**Only one sync at a time.** `startSync` keeps the current run in a variable called `running`. If you press **Sync now** while a sync is running, you get the same run back instead of starting a second one.

### Talking to IGDB politely

All IGDB traffic goes through one object, the **IGDB Gateway** (`apps/backend/src/igdb/gateway.ts`), which uses `IgdbClient` (`apps/backend/src/igdb/client.ts`). Sync, manual search, completed-game matching, the Randomizer and the **Test credentials** button all share it. So they share one access token and one speed limit. The client:

- **Gets a token from Twitch** with your client ID and secret (`igdb/token.ts`). If several requests need a token at once, they share one token request.
- **Keeps to 4 requests a second** (`IGDB_REQUESTS_PER_SECOND`). Each request reserves the next free time slot before waiting, so requests made at the same moment are spaced out instead of racing.
- **Retries `429 Too Many Requests`** up to three times, waiting a little longer each time.
- **Gets a fresh token once on `401` or `403`**, in case the old token expired.
- **Gives up after 10 seconds** on any request (`AbortSignal.timeout`), so a hung connection can't freeze a sync forever.

### Deleting and blocking

You can delete a release, or **delete and block** it. Blocking adds a row to `blocked_releases` with the game's IGDB ID and normalized title. Every later sync checks `isBlocked` and skips it, so it never comes back.

A **normalized title** is the title lower-cased with punctuation removed: `"Persona 4: Revival!"` becomes `"persona 4 revival"`. `normalizeText` in `apps/backend/src/text/normalizeText.ts` does this. The app uses normalized titles everywhere it compares names, so small differences in spelling don't matter.

### Listing releases

`GET /api/releases` builds its list in `listReleases` (`database/releaseReadModel.ts`). It adds a condition to the SQL for each filter you set: search text, publisher, category, platform, date precision. It hides releases you marked hidden or released unless you ask for them.

Your track-from date is applied here, when the list is read, not when games are saved. So if you move it from 2026 to 2025, the older games show up straight away. Nothing has to be rewritten.

The list is capped at 5,000 rows (`MAX_RELEASE_ROWS`) so a huge library can't freeze the window.

---

## 9. Feature: the Completed Library

### What a completed game is

A row in `completed_games`: title, the platform you played on, your rating, when you finished, notes, and information copied from IGDB (cover, genres, developer, summary, IGDB's rating). The store is `apps/backend/src/completed/completedGameStore.ts`.

### The Identity Key

How does the app know whether a game you add is new, or one you already have? It builds an **Identity Key** from the normalized title and the normalized platform:

```ts
// completed/completedIdentity.ts
export function completedIdentityKey(title, userPlatform = "") {
  return `${normalizeText(title)}|${normalizeText(userPlatform)}`;
}
```

"Hades" on "PC" becomes `hades|pc`. "Hades" on "Switch" becomes `hades|switch`, a separate entry, because finishing it twice on two systems is two journal entries.

Adding a game whose key already exists updates that game instead of making a duplicate. Renaming a game rebuilds its key. If the new key belongs to another game, the rename is refused with `409 Another completed game already has this title and platform`.

A game's **ID** (like `completed-hades-pc`) is set when it is created and never changes, even after a rename. Other things that point at the game, like your Game of the Year choice, use the ID, so a rename never breaks them.

### Matching to IGDB

When you add a finished game, you can search IGDB and pick the right entry. `apps/backend/src/completed/completedIgdbMatcher.ts` ranks IGDB's search results with a simple score:

- **70 points** if the title matches exactly, or **45** if one title contains the other (`matching/titleMatch.ts`);
- **20 points** if the platform matches exactly, or **12** if it partly matches;
- **5 points** if the game came out no later than the year you finished it.

The best match is called confident only if it scores at least 85 and beats the second best by at least 12. Otherwise the app asks you to choose. When you choose, the app fetches the game's full details and saves them together with your choice in one transaction (`applyMatch`). Your choice is kept in `completed_match_overrides`, keyed by the Identity Key, so it follows the game through renames.

### Ratings

You type a rating the way you think of it. `parseRating` in `completed/completedRating.ts` turns it into a score out of 10:

| You type | Score |
|---|---|
| `9/10` | 9 |
| `4/5` | 8 |
| `95%` | 9.5 |
| `85` | 8.5 |
| `8` | 8 |

The text you typed and the number are both stored. Every write of the text also writes the number through `parseRating`, so they can never disagree.

### Finish dates

You might remember the exact day, only the month, or only the year. `parseCompletionDate` in `completed/completedDate.ts` accepts `2026-03-14`, `14/03/2026`, `2026-03`, `March 2026` and `2026`, and stores the parts it can tell with a **precision**: `exact`, `month`, `year` or `none`. Year in Review uses the precision to decide which charts a game can appear in.

---

## 10. Feature: the Randomizer

### What it does

You set filters (genres, themes, platforms, ratings, years, "Made in Japan", "similar to a game") and press **Spin**. It picks one released game from the whole IGDB catalogue that matches, avoiding games it picked recently. It never adds anything to your library. Code: `apps/backend/src/randomizer/` and `apps/backend/src/actions/randomizerActions.ts`.

### Picking fairly from millions of games

IGDB has hundreds of thousands of games. You can't download them all to pick one. `drawRandomGame` in `randomizer/draw.ts` does it in two requests:

1. **Count.** Ask IGDB how many games match: `games/count` with the filters. Say the answer is 12,400.
2. **Fetch one small window.** Pick a random position between 0 and 12,400, and ask for the 9 games starting at that position, sorted by ID. Pick one of those 9 at random. The other 8 become the spinning "reel" of covers you see before the result.

Every game has the same chance of being picked. Pools of 500 games or fewer are fetched whole and picked from exactly.

### The cooldown

The last 50 picks are excluded from every spin, so you don't see the same game twice in a row. But if your filters only match 30 games, excluding 50 leaves nothing. So the window shrinks by halves: 50, 25, 12, 6, 3, 1 (`cooldownWindows`). Before trying all of those, one count with no cooldown at all checks whether the filters can match anything. If they can't, you get a plain reason ("No games match these filters") after one request instead of six. The previous pick only repeats when it is literally the only game that matches.

### Keeping the query safe

The filters arrive from the window as JSON. `parseRandomizerFilters` in `randomizer/queryBuilder.ts` checks every value before it goes into IGDB's query text. Every value that reaches the query must be a number (an IGDB ID, a rating, a year) or a true/false. Text you type, like a game's title, is never put into the query. This prevents **injection**, where someone crafts input that changes the meaning of a query.

### Design choices worth mentioning

- **Made in Japan** searches IGDB's `involved_companies` for Japanese studios credited as *developer*. Filtering games by company country would also match Japanese publishers and translators.
- **Similar to** spins among the games IGDB lists as similar to your chosen game. When none of those is left, it widens to games that at least two of them list as similar. Games listed by only one drift off topic.
- **Filter option lists** (all genres, themes and so on) are fetched with one IGDB `multiquery` and kept in memory for as long as the engine runs.
- **Your filters** are saved in the window's `localStorage` (section 13), not the database. They are a viewing preference, not library data.

---

## 11. Feature: Year in Review

### What it is

A recap of one year of your Completed Library, like Spotify Wrapped. It has five chapters, each drawn as its own illustrated world:

| Chapter | Scene | Shows |
|---|---|---|
| Overview | The Atlas, a sea chart | games per month, busiest month, average rating, first and last finish |
| Taste | The Grimoire, a spellbook | top genres, themes, platforms, favourite developer |
| Ratings | The Forge | how you rate, hot takes against critics, hidden gems, your "player type" |
| Timing and habits | The Astrolabe | day-one finishes, old games you got to late, longest streak |
| Game of the Year | The Throne | your top game, with its own art filling the screen |

### The engine side: one pure function

All the maths is in `buildYearInReview` in `apps/backend/src/yearInReview/buildYearInReview.ts`. It is pure: games in, summary out. It has no database access and doesn't read the clock. Today's date is passed in as an argument. That is why it can be tested with any made-up library and any "today".

Every adjustable number lives in one file, `yearInReview/thresholds.ts`. For example, a "hot take" means your rating is at least 15 points away from the critics' score, and "The Completionist" player type needs at least 24 games.

A few rules:

- **Game of the Year** is the highest-rated finish, with ties going to the later finish. You can override it. The override stores the game's ID, so it survives a rename.
- **Finish order** puts exact dates first, then month-only finishes (as if on the last day of the month), then year-only finishes.
- A game finished in "2026" with no month counts in totals and ratings, but not in month charts. Each chapter's footnote says which games it had to leave out. Charts never guess.
- Year in Review only reads completed games. Its only write is your per-year settings row.

### The window side

`apps/frontend/src/views/YearInReviewView.tsx` and `views/yearInReview/` draw the chapters. The scenes in `RealmScenes.tsx` are SVG drawn in code, so they ship no image files. **SVG** is a format for pictures made of shapes and lines, described in text.

Chapter navigation (scroll past the bottom to carry on into the next chapter) is a **pure reducer** in `yearInReviewNavigation.ts`. A reducer takes the current state and an event ("wheel scrolled down by 120 at time 5000") and returns the new state. Time is passed in as part of the event. So the scrolling rules are tested without a real screen or a real clock.

Animations only run when `canAnimate` allows them. If your system asks for reduced motion, they are skipped.

### Save as image

`views/yearInReview/poster.ts` draws a poster of every game you finished that year onto an HTML **canvas**, a blank image the page can draw on pixel by pixel. There are two layouts: horizontal (1920×1080 for screens) and vertical (tall, for a phone's Reddit feed).

There is a catch. A browser refuses to export a canvas containing images from another website, to stop pages from reading other sites' pixels. Covers come from `images.igdb.com`, which is another website. So covers are loaded through the engine's **cover cache** instead (`apps/backend/src/artwork/coverCache.ts`): `GET /api/covers/co2vvt` downloads that IGDB cover once into `<app data>/covers/`, then serves it from the app's own address. Same website, so the canvas can be exported. A side benefit: covers you have seen keep working offline. The same trick lets a game's detail page read its cover's main colour and tint the page with it (`theme/coverTint.ts`).

The page can't write files, so it sends the finished PNG bytes to the main process through `window.releaseTracker.saveImage`. `apps/desktop/src/saveImageIpc.ts` checks the bytes really are a PNG under 40 MB, cleans the file name so it can't contain folder paths, shows a save dialog and writes the file.

### Theme music

You can paste a YouTube link for a year's theme music. Only the 11-character video ID is stored (`shared/youtubeLink.ts`), never the full link. It plays through YouTube's privacy-enhanced player (`youtube-nocookie.com`), which is loaded invisibly. It starts by itself only if you turned on theme autoplay in Settings.

---

## 12. Feature: the sample library

A new user without IGDB keys sees an empty app. The sample library fixes that. **Try it with sample data** loads 30 upcoming games and 46 finished games, all real games with their real IGDB data, plus made-up ratings, dates and notes. Code: `apps/backend/src/demo/demoLibrary.ts`, data in `demoLibrary.json`.

Three details show care:

- **The dates move with today.** A sample stored with fixed dates would look stale a year later. `shiftedReleases` moves the upcoming dates by whole months so the list starts last month: a game or two just out, the rest still coming. In January it starts this month instead, because the default "from January 1" filter would hide last year's games. Finished games are placed in last year (for a full Year in Review) and this year up to today.
- **It is written through the normal stores**, so it behaves exactly like a real library.
- **It can be removed exactly.** The IDs it created are saved in a settings row called `DEMO_LIBRARY`. **Remove sample data** deletes exactly those rows and nothing you added yourself. Sample releases carry no IGDB ID, so a later real sync adds your own copies instead of taking over the sample's rows.

With the sample loaded and no keys saved, the Randomizer spins among 267 games bundled in `demo/randomizerSample.json` instead of IGDB, using the same `drawRandomGame` with an in-memory data source (`randomizer/sampleCatalog.ts`). This works because the draw takes its data source as a parameter (section 16 explains why that helps).

---

## 13. The window in depth: React and the frontend

### Components, state and hooks

A React component is a function that returns what should be on screen. **State** is data a component remembers between redraws, created with `useState`:

```tsx
const [moreFilters, setMoreFilters] = useState(false);
// later
<button onClick={() => setMoreFilters(value => !value)}>More filters</button>
{moreFilters && <div>...the extra filters...</div>}
```

Clicking the button flips `moreFilters`. React sees the state changed, calls the function again, and the extra filters appear.

A **hook** is a function whose name starts with `use` that adds abilities to a component: `useState` remembers data, `useEffect` runs code after drawing (to load data, or listen for key presses), `useMemo` remembers a calculation until its inputs change. You can write your own hooks by combining these.

### Workflows and views

This frontend splits every screen in two:

- A **workflow** hook owns the data and the actions: what is loaded, what happens on each click, what to do on an error. Example: `useRandomizerWorkflow.ts`.
- A **view** component only draws the workflow's data and calls its actions. Example: `views/RandomizerView.tsx`.

The split means the behaviour can be tested without drawing anything, and the drawing can change without touching the behaviour.

### How the app is assembled

```text
main.tsx
  └─ ErrorBoundary              catches drawing crashes, shows a Reload screen
      └─ AppShell (App.tsx)     top bar and navigation; picks which view to show
          └─ useAppWorkflow     builds every workflow once
              ├─ useAppShell              current view, error banner, dialogs
              ├─ useReleaseWorkspace      Upcoming list, sync, release detail, Add game
              ├─ useCompletedLibraryWorkflow
              ├─ useRandomizerWorkflow
              ├─ useYearInReviewWorkflow
              ├─ useSettingsWorkflow, useSyncSettingsWorkflow
              ├─ useDemoWorkflow
              ├─ usePreferences           colour theme, theme-music autoplay
              └─ useWallpaperWorkflow
```

There is no URL routing. `App.tsx` keeps the current view name in state (`"gallery"`, `"calendar"`, `"completed-library"` and so on) and shows the matching view.

### Shared behaviour, written once

Upcoming and the Completed Library behave alike: search, filters, genre filter, tick boxes to select many, Ctrl+A to select all, bulk delete, and coming back from a detail page to the same scroll position. All of that lives once in `collectionWorkspace.ts`. Each collection only supplies how to load and how to delete. Similarly, `detailSession.ts` runs the detail page for both collections, and `collectionDeletion.ts` runs every delete with the same confirm dialog and error message.

Search waits 250 milliseconds after you stop typing before asking the engine (`api/debounce.ts`). This is called **debouncing**. Without it, typing "persona" would send seven requests.

### Following a sync it didn't start

If auto-sync starts at launch, the window didn't ask for it, so it doesn't know when it ends. `releaseWorkspace.ts` checks the sync status every 3 seconds while it says `running`, then reloads the list once it finishes.

### Loading only what you open

The Randomizer and Year in Review are the largest screens, and many sessions never open them. `App.tsx` loads their code with `lazy(() => import(...))`, so it downloads only on the first visit. The Randomizer's workflow also waits until you open it before asking IGDB for its option lists.

### Look and feel

- **Palettes.** `theme/palettes.ts` defines twelve colour themes, each with eight colours. `usePreferences.ts` applies the chosen one as **CSS variables** (`--c-bg`, `--c-accent` and so on). Every style in `styles.css` refers to those variables, so changing theme changes the whole app at once. The choice is saved in the database. A copy in `localStorage` lets the first frame draw in the right colours before the engine answers.
- **Framed panels.** `ui/FramedPanel.tsx` draws the ornamented corners that give the app its look, borrowed from "HD-2D" games like *Octopath Traveler*.
- **Cover tint.** `theme/coverTint.ts` reads a cover's pixels, skips greys, blacks and whites, and averages the hue of the colourful pixels. The detail page then blends its colours toward that hue.
- **Missing images.** `ui/imageFallback.ts` puts one listener on the whole document. When any image fails to load, it marks the image and CSS hides it, so you see an empty frame instead of a broken-image icon.

### localStorage

`localStorage` is a small store the browser keeps for each website origin. This app uses it only for viewing preferences: Randomizer filters and a copy of the palette. Your library is never stored there. Every read and write is wrapped in `try`, because storage can be unavailable.

---

## 14. Security and privacy

This section collects every protection in one place. In an interview, this is where you show you understand the risks of a desktop app built on web technology.

### The window is powerless

The window shows content from the internet: covers, screenshots, YouTube trailers. If any of that were malicious, it would run inside the window. So the window is given nothing:

- No Node.js (`nodeIntegration: false`), so it can't read files.
- Chromium's sandbox (`sandbox: true`), so it is limited at the operating-system level too.
- Context isolation (`contextIsolation: true`), so page scripts can't reach Electron's internals.
- DevTools turned off in the installed app.
- Every permission request (camera, microphone, location, notifications) refused, except fullscreen for trailers.

### The window only ever shows the app

`apps/desktop/src/windowGuards.ts` decides where every link goes. The app's own pages stay in the window. `http` and `https` links open in your normal browser. Every other kind of address (`file:`, `javascript:`, custom schemes) is refused. The window carries the preload bridge and the token, so it must never display someone else's page.

### Only the app can use the engine

The token and Host header check from section 5. The token is new every launch, compared in constant time, and given only to the app's own frame.

### Content Security Policy

Every response from the engine carries a **Content Security Policy** header (`requestGuard.ts`). It tells Chromium what the page may load: its own scripts only, images only from IGDB, YouTube thumbnails and SteamGridDB, frames only from `youtube-nocookie.com`. Even if an attacker got some text onto the page, a script from anywhere else would be refused.

### Your API keys are encrypted at rest

This is a chain of three keys:

```text
  Your Windows login (or Linux keyring)
        │ protects (Electron safeStorage: DPAPI on Windows)
        ▼
  credential-key.bin: a random 32-byte data key, stored only in encrypted form
        │ encrypts (AES-256-GCM, secretCipher.ts)
        ▼
  your IGDB and SteamGridDB keys, stored as enc:v1:... in the settings table
```

1. On first launch, `credentialKey.ts` makes a random 32-byte **data key**. It encrypts that key with Electron's `safeStorage`, which uses the operating system's own protection (DPAPI on Windows), and saves the result as `credential-key.bin`. Only your user account on your computer can decrypt it.
2. On each launch, the main process decrypts the data key and passes it to the engine in an environment variable. The engine reads it and immediately deletes the variable.
3. The engine encrypts each API key with **AES-256-GCM** (`settings/secretCipher.ts`) before saving it. AES is the standard encryption algorithm. GCM mode also adds a tag that detects tampering. Each value gets a fresh random 12-byte **IV** (initialisation vector), so the same key saved twice looks different each time.

The result: someone who copies your app-data folder to another computer gets only encrypted keys they can't read. After you save keys, the app never shows them again. Settings only shows whether each one is saved.

In the installed app, API keys are read only from Settings. `backendChildEnv` in `backendProcess.ts` removes any `IGDB_*` and `STEAMGRIDDB_*` environment variables before starting the engine, so keys a user happens to have set elsewhere aren't used silently.

### Electron fuses

**Fuses** are switches baked into the Electron program file when it is packaged (`electronFuses` in `package.json`). This app turns off "run as plain Node.js", the `NODE_OPTIONS` variable and the Node debugger flags. Without that, another program could start the app's executable as a general-purpose Node.js and run any code with the app's identity.

### What leaves your computer

The app contacts only: IGDB and Twitch (after you add keys), IGDB's image server (covers), SteamGridDB (only with its key), and YouTube's privacy-enhanced player (only when you press play, or theme autoplay is on). No analytics, no crash reporting, no account. Auto-sync is off until you turn it on.

**Settings → Diagnostics → Delete all app data** (`apps/desktop/src/appDataIpc.ts`) stops the engine so the database is closed, deletes the library, covers, wallpaper, keys, backups and logs, clears the browser storage and restarts the app as new.

### Other small protections

- Uploaded artwork is checked to be an image under 10 MB.
- Cover IDs must match `^[a-z0-9]{1,40}$`, so a request can't name a file outside the covers folder (a **path traversal** attack).
- Asset paths can't contain `..`.
- Downloaded covers are written to a `.part` file and renamed when complete, so a half-written cover is never served.

---

## 15. When things go wrong: errors and logs

### The diagnostics log

Both the main process and the engine write to one file, `logs/game-release-tracker.log`, through `apps/backend/src/diagnostics/logger.ts`. Each line is one JSON object with a time, an event name and details. This format is called **JSON Lines**.

- **Secrets are removed before writing.** Any detail whose name looks like `secret`, `token`, `password` or `api_key` becomes `[redacted]`. Secrets inside text, like `client_secret=...` in a URL or `Bearer ...` in a header, are replaced too.
- **The log can't grow forever.** At 5 MB it is renamed to `.log.1`, older files shift up, and only three old files are kept. This is called **log rotation**.
- **Logging never throws.** If a write fails, it is dropped. A logging problem must never cause a second failure.
- **Only useful requests are logged.** Failed requests and requests slower than one second. Routes are logged by pattern (`/api/releases/:id`), never the real URL, so your search text and IDs stay out of the log.

### Errors at each layer

- **Engine, expected problems**: an action returns `{ ok: false, statusCode, error }`, and the window shows the message.
- **Engine, unexpected problems**: the error handler in `server.ts` logs the full error with its stack, and sends the window only "Something went wrong. Check the diagnostics log for details." Internal details never reach the screen.
- **Window, failed action**: `useAppShell` shows an "Action failed" banner and logs a `ui.operation.failed` event through the engine.
- **Window, drawing crash**: `ErrorBoundary.tsx` catches errors thrown while React draws, logs them, and shows "Something went wrong" with a **Reload** button instead of a blank window.
- **Main process or engine crash**: logged, then shown in a native error dialog. A failed startup always ends the app (`handleStartupFailure`), because a desktop app with no window would otherwise keep running invisibly.

---

## 16. How the code is tested

### Kinds of test

The 538 tests live in `tests/`, in three folders that match the three programs:

- `tests/backend/`: stores, sync, migrations, routes, the Randomizer draw, Year in Review, security checks.
- `tests/desktop/`: the main process's pieces, like startup failure, the navigation guards and saving an image.
- `tests/frontend/`: workflows and whole screens.

`npm test` runs them all with Vitest.

### Testing through the real door

Most backend tests use a real SQLite database in a temporary folder, run the real migrations and call the real functions. Here is the shape of one, from `tests/backend/releaseEdits.test.ts`:

```ts
test("user edits to a synced release survive the next IGDB sync", async () => {
  const db = tempDb();                                   // a fresh real database
  await runSync(db, [igdbGame()], undefined, noArtwork); // sync one fake IGDB game
  await updateRelease(db, "igdb-501", { title: "Persona 4 Revival (my name)" });
  await runSync(db, [igdbGame()], undefined, noArtwork); // sync again
  // check the title is still the edited one
});
```

It tests a behaviour a user cares about, through the same functions the app calls. It doesn't check private details, so the code inside can be rewritten freely as long as the behaviour holds.

### Fakes, and why the code is shaped for them

A test can't call the real IGDB: it would be slow, need keys, and give different answers each day. So code that needs IGDB takes it as a parameter instead of creating it itself. This is called **dependency injection**:

- `createBackendApp({ db, igdb, today, fetchCover })` lets a test pass a fake IGDB gateway, a fixed "today" and a fake cover download.
- `runSync(db, candidates)` lets a test pass the IGDB games directly.
- `drawRandomGame({ io, rng })` takes its data source and its random-number generator, so a test can make the "random" choice predictable.
- On the frontend, `AppShell` accepts an `api` prop. Tests pass `fakeApiClient()` from `tests/frontend/fakeApiClient.ts`, an in-memory API client where every method can be replaced per test. A test can then draw the whole app and click through it with no engine running.

### A fixed calendar

Many features depend on today's date: countdowns, "this year", the default track-from date. A test written in September that expects to see "September" fails in October. That happened on October 1, 2026, and was fixed in version 0.6.3. `tests/setup/suiteClock.ts` now runs the whole suite as if the day were 2026-09-25, with the clock still ticking from there. Results no longer depend on the day the tests run.

### Testing the installed app

Unit tests can't catch packaging mistakes, like a file missing from the installer. `scripts/smoke-packaged.mjs` is a **smoke test**: it starts the real packaged app with a fresh, empty profile, presses **Try it with sample data**, opens every screen, quits, and fails if anything went wrong on the page or in the log. It controls the app through Chromium's DevTools protocol, the same channel Chrome's developer tools use.

### Continuous integration

**CI** (continuous integration) means a server checks every change automatically. `.github/workflows/ci.yml` runs on GitHub for every push and pull request:

1. `npm ci`: install the exact dependency versions from `package-lock.json`.
2. `npm run typecheck`: TypeScript checks every file.
3. `npm test`: all 538 tests.
4. `npm run build`: compile everything.
5. A second job builds the Linux app and runs the smoke test on it, under `xvfb-run`, a fake screen for servers that have no display.

---

## 17. From source code to an installer

### Development

During development, two things run:

- `npm run dev` starts **Vite**, a development server that serves the frontend and reloads the page the moment you save a file.
- The Electron app loads the page from Vite at `http://127.0.0.1:5173` instead of from the engine.

### The build

`npm run build` runs three steps (`package.json`):

1. **`tsc -p tsconfig.build.json`**: the TypeScript compiler checks types and turns TypeScript into plain JavaScript in `dist/`.
2. **`vite build`**: Vite bundles the frontend into a few optimised files in `dist/frontend/`. Each file name contains a hash of its contents, like `index-3f9a1c.js`. Since a changed file gets a new name, the engine can tell the browser to cache these files forever (`frontendRoutes.ts`).
3. **`node scripts/bundle.mjs`**: **esbuild** bundles the main process, the preload and the engine into one file each. The installer then ships three scripts instead of thousands of files from `node_modules`.

### The native module problem

`better-sqlite3` is written partly in C++, not JavaScript. It must be compiled into a **native module**, a `.node` file built for one operating system and one exact version of Node or Electron. The copy built for running tests with Node won't load inside Electron, and the reverse.

So `npm run rebuild` rebuilds it for Electron before packaging. Where a ready-made build exists for the Electron version, it is downloaded. Otherwise it must be compiled, which needs C++ build tools on every machine that packages the app. That is why Electron is kept on a version that has ready-made SQLite builds (Electron 42 today). The decision is in `docs/adr/0004-electron-follows-sqlite-prebuilds.md`.

### Packaging

**electron-builder** (configured under `build` in `package.json`) turns `dist/` into installers:

- Windows: an installer `.exe` (made with NSIS) and a portable `.zip`.
- Linux: a `.deb` for Ubuntu and Linux Mint, and an `.AppImage` that runs without installing.

It packs the app's files into one archive called `app.asar`. `better-sqlite3` stays outside the archive (`asarUnpack`), because the operating system must load its `.node` file directly. `scripts/afterPack.cjs` deletes two Windows DLLs only needed for WebGPU, which the app doesn't use.

The Windows build isn't signed with a paid certificate, which is why Windows shows "Windows protected your PC" on first run.

### Releases

`.github/workflows/release.yml` runs when a version tag like `v0.6.3` is pushed, or when started by hand with a tag. It builds Windows on a Windows machine and Linux on a Linux machine, runs the tests and the smoke test on each, installs the `.deb` the way a user would and smoke-tests it, then publishes all four files as a GitHub release. The release notes are cut from the matching section of `CHANGELOG.md`, and the job fails if the tag doesn't match the version in `package.json`.

---

## 18. Every folder, explained

```text
apps/
  desktop/src/          Electron main process and preload
  backend/src/          the engine
  frontend/src/         the window (React)
  runtime/src/          file paths and app-data files
shared/                 types and constants all three share
tests/                  backend, desktop, frontend, setup
scripts/                build helpers and the smoke test
docs/                   guides, decision records, screenshots
build/                  app icons
data/                   source-overrides.json (curated release corrections)
.github/workflows/      CI and release automation
```

### `apps/desktop/src/`

| File | Does |
|---|---|
| `main.ts` | Starts everything: data folder, single-instance lock, token, engine, window, IPC handlers, quit |
| `preload.ts` | Puts `window.releaseTracker` on the page: the only bridge from page to main process |
| `backendProcess.ts` | Starts the engine, waits for its port, stops it |
| `appProtocol.ts` | The `app://renderer` address, and the YouTube referrer fix |
| `windowGuards.ts` | Where each link may go |
| `credentialKey.ts` | The OS-protected data key |
| `desktopLifecycle.ts` | Startup paths, startup log, startup failure handling |
| `appDataIpc.ts` | Delete all app data, open the log folder |
| `saveImageIpc.ts` | Save the Year in Review poster |
| `wallpaperIpc.ts` | Pick and copy a wallpaper image |

### `apps/backend/src/`

| Folder or file | Does |
|---|---|
| `child.ts` | The engine's entry point: open the database, migrate, start the server, report the port |
| `server.ts` | Builds the Fastify server, the error handler, request logging; registers routes; schedules auto-sync |
| `requestGuard.ts` | Host check, token check, security headers |
| `routes/` | One file per area. Thin: read the request, call an action, send the result |
| `actions/` | One user task each, run through `runWrite` |
| `database/` | Connection, migrations, write queue, Release Store, release read model |
| `sync/` | Sync Run, Release Policy, planner, merge, sync settings, SteamGridDB enrichment, status |
| `igdb/` | The gateway, the rate-limited client, tokens, reading IGDB's data shapes |
| `steamgriddb/` | The SteamGridDB client |
| `completed/` | Completed Library store, read model, Identity Key, matcher, ratings, dates |
| `randomizer/` | Filter checking and query text, the draw, pick history, platform and tag catalog, sample data |
| `yearInReview/` | The pure recap, its thresholds, per-year settings |
| `artwork/` | Uploaded artwork, the cover cache |
| `settings/` | Settings Store, encryption, credential status and testing |
| `demo/` | The sample library and its data |
| `diagnostics/` | The log file |
| `matching/`, `text/` | Title scoring, text normalization |

### `apps/frontend/src/`

| Folder or file | Does |
|---|---|
| `main.tsx` | Gets the address and token, builds the API client, draws the app |
| `App.tsx` | Top bar, navigation, picks the view |
| `useAppWorkflow.ts` | Builds every workflow |
| `appShell.ts` | Current view, error banner, dialogs, UI event logging |
| `api/client.ts` | Every request to the engine |
| `releaseWorkspace.ts`, `collectionWorkspace.ts`, `detailSession.ts` | Upcoming list, shared list behaviour, shared detail behaviour |
| `use*Workflow.ts` | One workflow per screen or task |
| `views/` | One component per screen |
| `views/yearInReview/` | The five chapters, scenes, poster, shelves |
| `ui/` | Small reusable pieces: buttons, fields, panels, countdown text, image fallback |
| `theme/` | Palettes, saved preferences, cover tint |
| `artwork.ts` | The one place that knows IGDB image URL shapes and sizes |
| `styles.css`, `fonts.css` | The look |

### `apps/runtime/src/`

`layout.ts` works out every path from the data folder: database, logs, covers, artwork, wallpaper. It also handles restoring a backup folder on first launch. `wallpaperStorage.ts` copies and serves the wallpaper image.

### `shared/`

`types.ts` (the shapes of all data crossing between programs), `constants.ts` (accepted game types, excluded title phrases, platform families, suggested publishers, limits), and a few tiny rules both sides need: `completedGenres.ts`, `wholeRating.ts`, `youtubeLink.ts`. Nothing in `shared/` may import from `apps/`.

### `docs/`

| File | For |
|---|---|
| `USER_GUIDE.md` | Using every screen |
| `HOW_IT_WORKS.md` | A short non-technical overview |
| `DOCUMENTATION.md` | Full technical reference |
| `CODEBASE_MAP.md` | Which folder owns which feature |
| `REVIEW_GUIDE.md` | A guided tour for code reviewers |
| `YEAR_IN_REVIEW_SPEC.md` | The Year in Review design |
| `adr/` | Six short decision records (section 19) |
| `BEGINNER_GUIDE.md` | This guide |

`CONTEXT.md` at the root is the project's vocabulary: what each domain word (Release, Sync Run, Identity Key, Spin) means exactly.

---

## 19. Why it is built this way

An interviewer cares more about *why* than *what*. These are the decisions that shaped the app, with the trade-off each one accepts.

**Local-first, no account** (`docs/adr/0001`). A personal journal doesn't need a server. No sign-up, no running cost, no server to breach, works offline. The cost: no syncing between devices, and a download instead of a website.

**Three processes.** The window, which shows internet content, is separated from the engine, which holds your files and keys. A crash in one doesn't take down the others. The cost: more moving parts at startup and shutdown, and more memory than one process.

**HTTP between window and engine, protected by a token** (`docs/adr/0002`). The same frontend runs in the app, in a plain browser during development, and in tests with a fake client. The cost: a local port any program can reach, which is why the token, the Host check and the CSP exist.

**SQLite.** One file, no database server to install, transactions, and fast enough for tens of thousands of rows. The cost: a native module that ties the Electron version to available SQLite builds (`docs/adr/0004`).

**Every change in a queued transaction.** Writes can't interleave and can't half-happen. The cost: writes wait in line, which for one user is unnoticeable.

**Each game in a sync saves separately.** One bad game makes the run `partial` instead of failing everything.

**User edits stored as overrides.** Your edits survive every sync, and fields you never touched keep updating from IGDB.

**Vague dates keep their words** (`docs/adr/0005`). The app never promises a day nobody announced.

**The user chooses what to track** (`docs/adr/0006`). Early versions had one person's publishers and platforms built in. The public version starts tracking nothing. The cost: a setup step, which the sample library and **Add suggested publishers** make up for.

**Completed games live only in the app** (`docs/adr/0003`). The journal began as an Excel workbook the app imported. Keeping both in step meant two places to edit the same game. Version 18 of the schema removed the import.

**Pure functions for the logic that matters.** The release policy, the sync planner, the merge, the Randomizer draw, Year in Review and the chapter navigation take inputs and return outputs, with no database, network or clock inside. They are the easiest code to test and to reason about.

---

## 20. Interview preparation

### The 30-second version

> "Game Release Tracker is a cross-platform desktop app I designed for people who play a lot of games. It tracks upcoming releases from publishers you follow, keeps a journal of games you finish, picks something random to play, and builds a yearly recap you can save as an image. It's Electron with a React and TypeScript frontend, a Fastify backend in its own process, and SQLite. Everything stays on the user's computer. It has 538 automated tests, CI on every change, and automated Windows and Linux releases."

### The two-minute walkthrough

Practise saying this with the diagram from section 3 in your head.

> "It's three processes. Electron's main process starts everything and handles the operating system: dialogs, encrypting the API keys. The window is a React app with no file or network access of its own. The backend is a small Fastify server on localhost with the SQLite database.
>
> The window talks to the backend over HTTP, which means the same frontend runs in tests against a fake client. Because any local program can reach a localhost port, every API call needs a random token that changes every launch and only the app's window receives.
>
> Inside the backend there are layers: thin routes, actions that each run one user task inside a queued transaction, and stores that are the only code allowed to write their tables.
>
> The main flow is sync. It asks IGDB for every game from the tracked publishers, filters them through a release policy (platform, game type, publisher actually credited, real date), merges in any edits the user made so those survive, and saves each game in its own savepoint so one bad record doesn't fail the whole run."

### Questions you are likely to get, with answers

**"Why Electron and not a website?"**
The data is personal and the app should work offline with no account. Electron gave me a desktop app while reusing web skills. The trade-off is download size and memory, since every Electron app ships its own Chromium.

**"Why is the backend a separate process?"**
Isolation. The window shows content from the internet, so it gets no access to files or keys. The backend holds the database and secrets and never shows web content. A crash in one doesn't take down the other.

**"How do you stop other programs from using your local API?"**
Three layers. A per-launch random token required on every `/api` call, given only to the app's own frame through the preload bridge and compared in constant time. A Host header check against DNS rebinding. And the server listens only on `127.0.0.1`. On top of that there's a Content Security Policy on every response.

**"How are API keys stored?"**
Encrypted with AES-256-GCM using a random data key. The data key itself is encrypted with the operating system's protection through Electron's safeStorage, which is DPAPI on Windows. A copy of the data folder on another machine can't be decrypted.

**"What happens if the app crashes in the middle of a sync?"**
Every write runs in a transaction, so nothing is half-saved. Each game is its own savepoint, so a bad game rolls back alone and the run is marked partial. A run still marked running at the next startup is marked failed with "interrupted".

**"How do you change the database layout without losing users' data?"**
Numbered migrations that run in order at startup and are never edited once shipped. Before migrating an existing library, the app copies it into a backups folder and keeps the last three. An older app refuses to open a library saved by a newer one instead of damaging it.

**"How do user edits survive syncing?"**
An edit changes the row and is also recorded as a `user` override for that field. Every sync re-applies the overrides on top of IGDB's data. Fields the user never edited keep following IGDB.

**"How does the Randomizer pick fairly from IGDB without downloading everything?"**
It asks IGDB to count the matching games, picks a random offset, and fetches a page of nine games at that offset. That's two requests, and every game has an equal chance. Recent picks are excluded, and that exclusion shrinks by halves if it would empty the pool.

**"How did you test it?"**
538 tests with Vitest. Backend tests use a real SQLite database in a temp folder. Anything external (IGDB, the clock, random numbers, the HTTP client) is passed in as a parameter, so tests use fakes. The whole suite runs on a fixed calendar day. A smoke test starts the real packaged app as a new user and opens every screen, and CI runs everything on every change.

**"Tell me about a bug you fixed."**
On October 1 a test failed because it expected the calendar to show "September". It was written in September. I moved the real clock forward to probe the whole suite and found more tests that would break later (three in 2027, seventeen from 2028), plus a real bug: in January the sample library hid two of its games behind the default "from January 1" filter. The fix was a fixed calendar for the whole suite and a change so the sample starts this month in January. That shipped as 0.6.3.

**"What would you improve?"**
Pick ones you believe. Some honest options:
- Code-sign the Windows build so users don't see the SmartScreen warning.
- Add a macOS build.
- Move the backend out of a separate OS process into a worker thread to save memory. This is already done in the personal version of the app.
- Sync only games that changed since the last run, using IGDB's `updated_at`, instead of re-reading everything.
- Make a library export and import, so users can move between computers.

**"What was hard?"**
Honest dates (IGDB's vague dates disguised as exact timestamps), keeping user edits alive through sync, and making the packaged app's origin stable so saved settings weren't lost every launch.

### Talking about AI assistance

The README says that you designed the app, wrote the specifications, made every product decision, reviewed each change and tested the results, and that AI coding assistants wrote most of the code. Say the same thing in the interview, plainly. Then show you understand the code by explaining it, which this guide prepares you to do. Interviewers increasingly expect AI use. What they want to know is whether you can judge the output, explain it, debug it and make decisions about it.

Be ready to open any file named in this guide and explain what it does. The ones most worth knowing cold:

1. `apps/desktop/src/main.ts`: startup order.
2. `apps/backend/src/requestGuard.ts`: the token and Host check.
3. `apps/backend/src/database/writeQueue.ts`: the write queue, eighteen lines.
4. `apps/backend/src/sync/syncRun.ts`: the Sync Run and savepoints.
5. `apps/backend/src/sync/releasePolicy.ts`: what counts as an upcoming release, and date precision.
6. `apps/backend/src/sync/releaseMerge.ts`: how edits survive.
7. `apps/backend/src/database/migrations.ts`: the first 75 lines (version check and backup).
8. `apps/backend/src/randomizer/draw.ts`: count, offset, cooldown.
9. `apps/frontend/src/api/client.ts`: how the window makes requests.
10. `tests/backend/releaseEdits.test.ts`: what a good test looks like.

### Numbers to remember

| | |
|---|---|
| Version | 0.6.3 |
| Source | about 14,300 lines of TypeScript |
| Tests | 538 tests, about 9,800 lines |
| Platforms | Windows (installer, zip), Linux (.deb, AppImage) |
| Stack | Electron 42, React 19, TypeScript 5.9, Fastify 5, SQLite through better-sqlite3, Vite 7, Vitest 4 |
| Schema | version 20 |
| IGDB | at most 4 requests a second, 10-second timeout, 3 tries on 429 |
| Randomizer | 50-pick cooldown, 9-cover reel, two requests per spin |
| Sample | 30 upcoming, 46 finished, 267 Randomizer games |

---

## 21. Glossary

| Word | Meaning |
|---|---|
| Action | Backend function that runs one user task in a queued transaction (`apps/backend/src/actions/`) |
| ActionResult | `{ ok: true, value }` or `{ ok: false, statusCode, error }` |
| API | The list of requests a server understands |
| API client | The frontend object that sends every request (`api/client.ts`) |
| API key | A password that lets a program use an online service |
| asar | The single archive Electron packs an app's files into |
| Async, await, promise | Code that waits for slow work without freezing everything else |
| Backend, engine | The Fastify server that holds the data (`apps/backend/`) |
| Blocked release | A deleted game that sync never brings back |
| CI | Automatic checks on every change (`.github/workflows/ci.yml`) |
| Component | A React function that returns part of the screen |
| Content Security Policy | A response header listing what a page may load |
| Context isolation, sandbox | Electron settings that keep page code away from the system |
| Cooldown window | The recent Randomizer picks excluded from a spin |
| Cover cache | Covers downloaded once and served from the app's own address |
| Date precision | Exact, Month, Window, Year or TBA |
| Debounce | Waiting until typing stops before acting |
| Dependency injection | Passing a function its collaborators (IGDB, the clock) so tests can pass fakes |
| DPAPI, safeStorage | Windows' and Electron's way to encrypt data for one user account |
| Electron | A toolkit for desktop apps built from Chromium and Node.js |
| esbuild, Vite, tsc | Tools that compile and bundle the code |
| Fastify | A Node.js library for HTTP servers |
| Foreign key | A column that must match a row in another table |
| FTS | Full-text search index in SQLite |
| Fuses | Switches baked into the packaged Electron program |
| Hook | A React function starting with `use` that adds state or effects |
| HTTP, status code | How the window and engine talk, and the number that says how a request went |
| Identity Key | Normalized title plus platform, used to spot duplicate finished games |
| IGDB | The Internet Game Database |
| IGDB Gateway | The one object all IGDB requests go through |
| IPC | Messages between Electron processes |
| JSON, JSON Lines | A text format for data, and one JSON object per line |
| localhost, port | Your own computer's address, and a numbered door on it |
| localStorage | Small per-origin browser storage, used only for view preferences |
| Main process | Electron's controlling process (`apps/desktop/src/main.ts`) |
| Migration | A numbered change to the database layout |
| Native module | Compiled C++ code loaded by Node.js, like better-sqlite3 |
| Normalized title | Lower-case, punctuation-free title used for comparing |
| Origin | Scheme, host and port together; browsers keep saved data per origin |
| Override | A field value that wins over IGDB's during sync |
| Preload | The small script that gives the page `window.releaseTracker` |
| Process | A running program with its own memory |
| Pure function | Output depends only on input; no database, network or clock |
| Read model | Code that builds data for a screen and never writes |
| Reducer | A pure function from state and event to new state |
| Release | An upcoming game in the list |
| Release Policy | The rules that decide which IGDB games become releases |
| Renderer | The process that draws a window's web page |
| Route | A backend function for one URL and method |
| Savepoint | A transaction inside a transaction |
| Schema | The layout of the database's tables |
| Smoke test | Starting the real packaged app and clicking through it |
| SQL, SQLite | The database language, and a database in one file |
| Store | The only module allowed to write a group of tables |
| Sync Run | One sync with IGDB |
| Token | The per-launch secret every `/api` call must carry |
| Transaction | A group of changes that all happen or none do |
| TypeScript | JavaScript with types checked before running |
| WAL | SQLite mode that lets reads happen during a write |
| Workflow | A frontend hook that owns a screen's data and actions |
| Write queue | The line every database write waits in (`writeQueue.ts`) |
