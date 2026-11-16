# Case study: when a release date isn't a date

How one data-quality problem led to a product rule, a decision record, and a feature: the app went from showing wrong countdowns to warning users when a game they watch gets delayed.

## The situation

The Upcoming list shows each game's release date and counts down to the next one. Its data comes from IGDB, a public games database.

## The problem

Users saw promises the app couldn't keep: **"Arrives in 461 days"** for a game whose publisher had only said "2027", and the same game sitting on the calendar on **December 31**.

The cause was in the data, not the screen. IGDB stores a vague date ("2027", "Q4 2026", "Dec 2026") as a timestamp at the end of that period. The app read that timestamp as the release day. Every game with an unconfirmed date showed false precision, and those are exactly the games people are waiting on.

## Options considered

| Option | Upside | Downside |
|---|---|---|
| Hide games without an exact day | Simple | Hides the games people care about most |
| Keep the timestamp and add a disclaimer | Small change | The countdown is still wrong; a disclaimer doesn't fix a false number |
| **Keep what the publisher actually said**, and count down only to a real day | Honest; the list still sorts correctly | Needs a "precision" concept across sync, sorting, calendar and display |

## The decision

A date's displayed text decides its precision (Exact, Month, Window or Year), and **only an Exact date gets a countdown or a calendar cell**. The timestamp is still kept for sorting, so "2027" sorts after every real date in 2027. The rule is written down as [ADR 5](adr/0005-vague-release-dates-keep-their-words.md) so it can't be quietly undone later. It shipped in 0.6.2, and the next sync corrected games already in users' lists.

## What it led to

Once the app knew how precise each date was, it could tell *how* a date changed, not just that it changed:

- **Delayed**: the date moved later.
- **Moved up**: the date moved earlier.
- **Announced**: a vague date became a real day.

That became 0.7.0's main feature:

- **Delays at a glance.** Rows say "Delayed from Mar 14, 2027"; each game's page shows its full date history.
- **Watchlist.** Users mark the games they care about.
- **Alerts.** A desktop notification when a watched game comes out, or a sync finds it delayed, moved up or given a real date. Only changes after the user started watching count, so nobody gets a flood of old news.
- **Background sync.** With auto-sync on, the app syncs every 12 hours from the system tray, so alerts arrive without opening it.

A display bug turned into the product's main reason to exist: **know when a date moves, without re-checking**.

## How the quality was held

- The rule became a domain term in [CONTEXT.md](../CONTEXT.md), so every later spec and every AI-written change uses the same words.
- Tests cover each precision and each kind of change. Every change on GitHub builds the app, starts it as a new user and opens every screen.
- A fix found during the 0.7.0 work went out in the same release: changing a date by hand to a vague one now drops the old day, instead of counting down to it until the next sync.
- Date history needed a new database table (schema v21). The upgrade backs up the library first, as every upgrade does.

## What I'd do differently

- **Test with data that looks like real data from the start.** The bug only showed up with real IGDB data. The sample library now includes vague dates ("2027", "Q4 2026"), so every new user and every packaged-app check sees them.
- **Measure it.** With no analytics I can't tell how many users saw a false countdown or how many now use alerts. The [product brief](PRODUCT_BRIEF.md#measuring-success) describes an opt-in way to find out without giving up the privacy promise.

## In interview form

> **Situation:** A release tracker that counted down to dates the publisher never announced.
> **Task:** Make the dates honest without hiding the games people wait for most.
> **Action:** Traced it to how the data source stores vague dates, compared three options, picked "keep the publisher's words", wrote it down as a decision record, and specified the change for AI coding agents with tests for every case.
> **Result:** Correct countdowns and calendar from 0.6.2. That groundwork made 0.7.0's delay tracking, watchlist and alerts possible, which is now the app's main value.
