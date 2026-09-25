# Game Release Tracker — Beginner's Guide

This document explains the project in plain English for someone who isn't a developer. No jargon, no code, just what the app does and how the pieces fit together.

---

## What is this app?

Game Release Tracker is a **desktop application** — a program you install on your Windows PC (like Steam or Spotify). It does four things:

1. **Tracks upcoming game releases** — shows you a list of games that haven't come out yet, with their release dates, publishers, platforms, and cover art. It pulls this data automatically from IGDB (a games database, like IMDb but for games).

2. **Tracks games you've already completed** — a personal library of games you've finished, with your ratings, completion dates, and personal notes. You add them in the app.

3. **Suggests something to play** — the Randomizer picks a random released game from the whole of IGDB, narrowed by filters you choose.

4. **Recaps your year** — Year in Review turns the games you finished in a year into a short story: how many, your tastes, your ratings, your habits, and your Game of the Year with its theme music.

Think of it as a personal diary + calendar for video games.

---

## How do I use it?

### Installing
- Download `Game Release Tracker Setup 0.6.0.exe` and run it (installer), OR
- Download `Game Release Tracker-0.6.0-win.zip`, extract it, and run `Game Release Tracker.exe` (no install needed)

### First time setup
New packages carry no personal library, wallpaper, or API keys. To restore a backup, set `GRT_RESTORE_DIR` to the backup folder before starting the app; an existing database is never overwritten.

1. Open the app — you'll see a top bar with tabs: Upcoming, Calendar, Completed Library, Randomizer, Year in Review, Settings. Upcoming and Completed Library both have a Genre dropdown to show only one genre
2. Go to **Settings** and enter your IGDB API credentials (free at api.igdb.com — sign up, create an app, get a client ID and secret)
3. Optionally add a SteamGridDB API key for nicer cover art
4. Click **Save** then **Test credentials** to verify

### Viewing upcoming releases
- **Upcoming** tab: shows games grouped by month/quarter/year. Each game is a compact row. Click a row to feature it over a large backdrop; double-click or press Enter for details.
- **Calendar** tab: shows a month grid with game release dates highlighted. Each event has a small cover thumbnail you can click to see details.
- Open details from the feature card or double-click a release row to see its full detail page (hero artwork, metadata, screenshots). Every detail page, upcoming or completed, sits on a soft blur of the game's cover, and its colours lean toward the cover's colour. Covers are saved on your computer the first time they're shown.

### Syncing with IGDB
- Click **Sync now** (top right) — the app contacts IGDB, fetches new releases, and updates existing ones.
- The sync is smart: it only adds games from publishers you care about, skips blocked games, and doesn't re-download data it already has.

### Managing completed games
- **Completed Library** tab: shows finished games in a compact cover grid, grouped by completion month. Ratings of 9 or above have gold frames.
- To add a game: click **Add completed game**, search IGDB for it, and fill in your rating (like 8.5/10), completion date and notes. Edit any of these later on the game's page.
- The app auto-matches your games to IGDB for cover art, screenshots, and metadata. If the match is wrong, click **Fix match** on the detail page and pick the right one.

### Picking a random game
- **Randomizer** tab: set filters on the left if you like, then press **Spin**. **Quick picks** give one-click JRPG, Anime and Made in Japan (made by a Japanese studio). You can also pick PlayStation, Xbox, Nintendo or PC consoles (the Randomizer only ever suggests games on those), include or exclude genres, themes and tags (search any tag by name), choose a camera view, and set rating and ratings-count ranges and release years. **Series** finds a franchise like Final Fantasy or Persona by name. **Similar to** (or **More like this** on a pick) only suggests games IGDB considers similar to one game. Most IGDB games have no rating yet, so they are hidden unless you tick **Include unrated games**. Many of them are obscure, so it works best together with other filters. A reel of covers spins, slows down like a slot machine and stops on one game, which lights up and grows into a card with its cover, year, genres, platforms, IGDB rating, summary and an IGDB link.
- Press **Spin again** for another game. You won't get the same game twice in a row, and recent picks are kept out of later spins so repeats are rare.
- Games in your Completed Library are hidden by default. You can also hide games in Upcoming.
- If nothing matches your filters, the app says why instead of showing an error.
- **Recent picks** shows your last picks. **Clear history** forgets them.
- The Randomizer needs IGDB credentials. It only reads from IGDB and never changes your Upcoming list or Completed Library.

### Looking back on your year
- **Year in Review** tab: it fills the whole window and opens with a short intro of your year (click or press any key to skip it). Pick a year at the top right (the current year is marked "so far"); it opens on the latest year you finished something in. Press Escape or **✕ Leave** to go back.
- Each chapter has its own look: a sea chart for Overview, a spellbook for Taste, a forge for Ratings, a brass astrolabe for Timing & Habits, and your Game of the Year's own art for the finale.
- Five chapters: **Overview** (how many games, your busiest month, average rating, first and last finish), **Taste** (top genres and themes, platforms, favourite developer, solo or together, something new), **Ratings** (your player type, rating spread, a hot take where you and the critics disagreed, a hidden gem), **Timing & Habits** (day-one finishes, the game you were most "late to the party" for, oldest and newest games, your longest monthly streak) and **Game of the Year**.
- Click a tab, use the ← and → keys, or just keep scrolling: scrolling on past the bottom of a chapter carries on into the next one.
- Click any game (a row, a cover, the Game of the Year) to open its Completed Library page; **← back to Year in Review** brings you back where you were.
- Click a month or rating bar, a genre, theme or platform, "rated 9 or higher" or **See all** on the day-one card to see the games in it, shown as covers with their name and (platform) under the cards. Click it again, press **Close** or Escape to put them away.
- **Game of the Year** is your highest-rated finish of the year, shown over its own art with its cover beside the name (click the cover to open the game). The rest of your year's games are shown under it as covers with their name and (platform). **Choose my GOTY** picks a different one; **Use automatic pick** goes back. Your note on that game is quoted.
- **Set theme music**: paste a YouTube link for the game's music. Only the video id is saved. Press **▶ Play theme** to play it in the background, with a small **Theme music · Stop** tag in the corner. To have it start by itself whenever you open that year, turn on **Play a year's theme music automatically** in Settings → Appearance. It keeps playing while you look through the chapters and stops when you leave Year in Review. **Stop** (or **■ Stop theme**) turns it off; **▶ Play theme** brings it back.
- **Save as image** makes a poster of every game you finished that year, with each cover, its name, platform and your rating, and your Game of the Year crowned. Pick **Horizontal** (a grid of covers for a screen) or **Vertical** (for posting on Reddit from a phone: about a phone screen tall, 6–7 covers a row, each with its name and platform big enough to read in the feed without opening the picture). It asks where to save the PNG.
- Games need a completion date to count. Games with only a year count in the totals but not in month charts. Themes, critic scores and release dates come from the IGDB match, so unmatched games leave some cards out; each chapter says so at the bottom.
- Year in Review only reads your Completed Library. The one thing it saves is your GOTY choice and theme music for each year.

### Editing games
- On any detail page, click **Edit title** to rename a game.
- Click **Edit details** to change publishers, developers, platforms, dates, ratings, notes, etc.
- Changes save immediately to the database.

### Deleting games
- On a detail page, click **Delete** (removes the game) or **Delete + block** (removes it AND prevents it from coming back on the next sync).

### Wallpaper
- Open **Settings → Wallpaper** to choose a backdrop image. **Settings → Appearance** offers 12 palettes; the app remembers your choice, even after you close and reopen it.

### If something goes wrong
- Open **Settings → Diagnostics** to see the location of the app's diagnostic log and open it in Windows.
- Backend errors show a short, readable message in the app while the detailed error is saved to that log.
- If the screen itself crashes, the app shows a **Something went wrong** page with a **Reload** button.
- Secret-like values such as API keys and tokens are redacted before they are written to the log.

---

## What's with the HD-2D look?

Abyss Gold is the default dark palette. The app uses thin double frames and corner ornaments over game artwork, with Marcellus headings and Alegreya Sans text. Upcoming puts a selected release in focus; Completed Library keeps covers small so a month of games fits together. You can choose another palette in Settings.

---

## How does the app work under the hood?

Don't worry — you don't need to understand this to use the app. But if you're curious:

### Three parts working together

Think of the app like a restaurant:

1. **The dining room (Frontend)** — what you see on screen. Built with React (a popular tool for making user interfaces). This is the buttons, lists, cards, forms, and the HD-2D styling. Everything you click and type happens here.

2. **The kitchen (Backend)** — does the actual work behind the scenes. Built with Fastify (a web server). When you click "Sync now," the frontend sends a message to the backend, which contacts IGDB, downloads game data, and saves it to the database. The backend runs as a hidden process inside the app.

3. **The pantry (Database)** — where everything is permanently stored. A SQLite database (a single file on your computer). Every game, every setting, every piece of artwork is stored here. When you close the app and reopen it, everything is still there.

### How they talk to each other

The frontend and backend communicate using a "REST API" — think of it like a menu of requests:
- "Give me the list of upcoming releases" → backend responds with the list
- "Save this game's new title" → backend updates the database
- "Sync with IGDB" → backend contacts IGDB, processes the results, saves them

### Where does the data come from?

- **IGDB** (Internet Game Database): the source for upcoming releases. It's like IMDb but for games. The app queries it for games by publisher, release date, platforms, etc. You need free API credentials from api.igdb.com.
- **SteamGridDB**: optional, for higher-quality cover art. Community-sourced images, often nicer than IGDB's defaults.
- **You**: completed games are the ones you add in the app.

### What happens when I sync?

**Upcoming releases sync:**
1. App contacts IGDB and asks "what games are upcoming from publishers I track?"
2. IGDB responds with a list of games
3. For each game, the app decides: is this new? Should I add it? Is it already in my database? Should I update it? Is it on my block list? Should I skip it?
4. New games get saved with their artwork. Existing games might get updated data.
5. The app also tries SteamGridDB for better cover art.

### The "identity key" thing

Each completed game has an "identity key" — a unique fingerprint made from its title + platform. This is how the app knows two entries are the same game. If you rename a game, the app updates the identity key so everything stays linked. (This was a bug we fixed — renaming used to break IGDB matching because the old key was left behind.)

---

## Common questions

**Q: Do I need an internet connection?**
A: Only for syncing (fetching from IGDB/SteamGridDB). Once data is downloaded, you can browse your library offline.

**Q: Where is my data stored?**
A: In a SQLite database file in your app data directory. It's a single file. Your wallpaper is stored nearby.

**Q: Will I lose my data if I update the app?**
A: No. The database is separate from the app executable. Updating the app replaces the program but keeps your data.

**Q: How do I get IGDB credentials?**
A: Go to api.igdb.com, sign up for a free account, create a new application, and you'll get a Client ID and Client Secret. Paste them into the app's Settings page.

**Q: Can I use this on Mac or Linux?**
A: The app is currently built for Windows only. The codebase is cross-platform (Electron + Node), but the build pipeline only produces Windows exes.

**Q: Why do some games say "needs review"?**
A: The auto-matcher wasn't confident enough to pick a match. It may have filled in its best guess, so check that the cover and details are right. Go to that game's detail page, click "Fix match," and choose the correct IGDB game from the list of candidates.

**Q: Can the Randomizer show the same game again?**
A: Not straight after itself. Your last 50 picks are skipped. If your filters are so narrow that skipping them would leave nothing, the app skips fewer and tells you that you've seen most of these. **Clear history** starts fresh.

**Q: Why is a Year in Review card missing?**
A: A card only shows when it has something to say. For example, the hot take needs a game where your rating and the critics' differ by 15 points or more, and timing cards need finish months and IGDB release dates. The note at the bottom of each chapter says how many games it couldn't use.

**Q: Where should I look when an action fails?**
A: Start with the message shown in the app. Then open **Settings → Diagnostics** and share the diagnostic log if you need help. It automatically redacts secret-like values.

---

## Development commands (if you want to modify the app)

| Command | What it does |
|---|---|
| `npm install` | Install all dependencies (first time only) |
| `npm run dev` | Start the dev server — opens the app in your browser at 127.0.0.1:5173 |
| `npm run test` | Run all tests |
| `npm run test:frontend` | Run only frontend tests |
| `npm run test:backend` | Run only backend tests |
| `npm run build` | Compile everything to `dist/` |
| `npm run dist` | Full build + package as Windows exe → `dist/*.exe` |

---

## Glossary

| Term | Meaning |
|---|---|
| **Electron** | A tool that lets you build desktop apps using web technologies (HTML, CSS, JavaScript). Discord, VS Code, and Slack are all Electron apps. |
| **Frontend** | The part of the app you see and interact with. |
| **Backend** | The part that runs in the background and does the heavy lifting. |
| **API** | A way for programs to talk to each other. Like a restaurant menu — you request something, you get a response. |
| **IGDB** | Internet Game Database. Like IMDb but for games. The app uses it to fetch release dates, cover art, etc. |
| **SteamGridDB** | A site with community-sourced game cover art. Optional, for nicer images. |
| **SQLite** | A lightweight database that stores everything in a single file. No server needed. |
| **Sync** | The process of fetching new data from IGDB and updating the local database. |
| **Randomizer** | The tab that picks a random released game from IGDB. One press of Spin is a *spin*; the game it lands on is a *pick*. |
| **Cooldown window** | Your most recent Randomizer picks, which are skipped so games don't repeat soon. |
| **Year in Review** | The tab that recaps one year of your Completed Library, chapter by chapter. |
| **GOTY** | Game of the Year: your highest-rated finish of the year, or the one you chose. |
| **Player type** | A fun title Year in Review gives you from your year's stats, like "The Explorer" for playing many genres. |
| **Identity key** | A unique identifier for a completed game, made from its title + platform. Used to tell whether two entries are the same game. |
| **FTS** | Full-Text Search. A SQLite feature that makes searching titles fast. |
| **Schema migration** | When the database structure changes (new columns, new tables), a migration updates old databases to the new structure automatically. |
| **REST API** | A style of building APIs where you use HTTP methods (GET, POST, PATCH, DELETE) on URLs. |
| **Vite** | A build tool that compiles the React frontend into static files. |
| **Fastify** | A fast web server framework for Node.js. Runs the backend. |
| **React** | A JavaScript library for building user interfaces. Powers the frontend. |
| **TypeScript** | A version of JavaScript with types. The entire codebase is written in TypeScript. |
