# Product brief

Who Game Release Tracker is for, what problem it solves, what it competes with, and how it would be judged. For how it works, see [How it works](HOW_IT_WORKS.md); for the choices behind it, the [decision records](adr/).

## The problem

People who follow game releases closely keep track of them in places that don't track anything: a spreadsheet, a store wishlist, bookmarks, a notes app. Release dates move constantly. Games slip a few weeks, a "2027" turns into a real day, a quarter becomes a month. A spreadsheet only changes when its owner re-checks every row by hand.

The same people often keep a second record of the games they finish (ratings, notes, dates), usually in another spreadsheet. At the end of the year that record is rich but sits unused.

So there are three jobs nobody does for them:

1. **Tell me when something I care about changes.** Not the whole news cycle; only the games I watch.
2. **Keep my history for me.** What I finished, when, on what, and what I thought of it, without retyping game details.
3. **Show me what it adds up to.** A year of playing, told back in a way worth sharing.

## Who it's for

| Segment | What they want | What the app gives them |
|---|---|---|
| **The planner** follows a handful of publishers and plans purchases around release dates | Know the real date, know when it moves | Upcoming list and calendar, Watchlist, delay history, alerts |
| **The journaller** finishes 20 to 100 games a year and keeps a record | One place for the record, filled in automatically | Completed Library, matched to IGDB for covers and details |
| **The undecided** has a backlog and no idea what to play next | A good suggestion, not the same three games | Randomizer with filters and no repeats |
| **The sharer** enjoys year-end recaps from music and reading apps | The same for games | Year in Review, saved as an image |

The first two are the core. The Randomizer and Year in Review give people a reason to keep the journal up to date.

## Alternatives and how the app is positioned

| Alternative | Strong at | Where it falls short for these users |
|---|---|---|
| A spreadsheet | Total control, free | Nothing updates by itself; no alerts; no artwork; charts are manual work |
| Store wishlists | Built into where people buy | One store only; mostly about price, not date history; no journal |
| Social game-logging sites | Large communities, reviews | Need an account; the record lives on someone else's server |
| Game launchers that collect a library | See installed games across stores | Built around what you own, not what's coming out |

**Positioning:** the private, all-in-one tracker for the player who cares about dates and keeps a record. It works across every store and platform, notices every date change, and keeps everything on the user's own computer with no account.

### Why local-first is the bet

No account and no server ([ADR 1](adr/0001-local-first-desktop-app.md)) means no sign-up friction, no hosting cost, and no user data that could leak. The cost is real: no sync between devices, and no usage data for the product owner. The second cost is discussed under [Measuring success](#measuring-success).

## What it does, by job

| Job | Features | Shipped |
|---|---|---|
| Tell me when something changes | Publisher-based sync, Watchlist, "Delayed from …" on rows, date history per game, desktop alerts, background sync from the tray | 0.6.0 to 0.7.0 |
| Keep my history | Completed Library, automatic IGDB matching, ratings and notes, manual match fixes that survive renames | Before 0.5, kept in the app since schema v18 |
| Show me what it adds up to | Year in Review in five chapters, Game of the Year picker, save as image | Before 0.5 |
| Help me decide | Randomizer across all of IGDB, with filters and recent-pick memory | Before 0.5, works without keys from 0.6.1 |
| Let me try before setting up | Sample library, with every screen working and no keys needed | 0.6.0 |

## Onboarding and time to value

Real use needs free IGDB keys, which takes about five minutes through a Twitch account. That is the biggest drop-off risk, so the product puts value before setup:

- **Try it with sample data** on the welcome screen fills every screen (30 upcoming games, 46 finished games with a full Year in Review, 267 games for the Randomizer) in one click.
- **Add suggested publishers** turns the empty Sync settings into a working list in one click.
- A new library tracks nothing until the user chooses ([ADR 6](adr/0006-the-sync-policy-belongs-to-the-user.md)), so the app never shows someone else's taste.

## Measuring success

The app collects no analytics by design, so these are the measures it *would* be judged by, and how each could be learned without breaking the privacy promise.

| Question | Measure | How it could be learned |
|---|---|---|
| Do people get past setup? | Share of installs that move from sample data to a first real sync | Opt-in, anonymous "setup step reached" counts |
| Does the core job land? | Watched games per active user; alert click-through | Same opt-in counts, no game titles |
| Do people keep the journal? | Games logged per month after the first month | Local only: shown to the user in Year in Review |
| Is the recap worth sharing? | Year in Review saved as an image | Opt-in count |
| Is it reaching people at all? | Downloads per release, GitHub stars, issues opened | Public GitHub data, available today |

A first step that respects ADR 1 would be an **opt-in, off-by-default** setting that sends a short anonymous summary (counts only, never game titles or notes), with the exact payload visible in Settings before it is ever sent. That would be its own decision record.

## Roadmap

Ranked by how much it helps the core jobs against how much it costs to build.

| Next | Why | Size |
|---|---|---|
| **Play time, kept on the device**: import Steam play time, then optionally notice when a linked game is running | Gives Year in Review real hours instead of game counts; a common request from journallers | Medium |
| **Opt-in anonymous usage counts** | Answers the questions above without breaking the privacy promise | Small |
| **More alert types**: "a game from a publisher you follow was just announced" | Extends the core job from watched games to discovery | Small |
| **Export the journal** to CSV | Lowers the risk of trying a local-first app: your data can always leave | Small |
| **Device sync through a folder the user picks** (for example a cloud-drive folder) | The most common complaint about local-first apps, solved without a server | Large |

Deliberately **not** planned: accounts, a hosted backend, social features, and showing prices or store links. Each would change what the product is.

## If it were a business

It is a free, MIT-licensed project today. Options, in order of how well they fit:

1. **Free core, paid extras.** Device sync and extra alert types as a one-time purchase. It fits local-first because there are no servers to pay for.
2. **Store links on release day.** Affiliate links in alerts ("out today: buy on …"). It earns money at the moment of intent, but it needs care so it doesn't turn into ads.
3. **A data product for businesses.** The date-change tracking (delays, moves, vague dates becoming real) is useful to retailers, games media and content creators who plan around release calendars. This would mean a hosted service, a separate product with different trade-offs.
