# Changelog

What changed in each version, in plain language.

## 0.6.1

**Try the Randomizer without an account.** With the sample library loaded and no IGDB keys saved, the Randomizer now spins among 267 real games that come with the app. Genre, theme, game mode, platform, rating and year filters all work; the filters that search all of IGDB (tags, quick picks, series, similar games, camera view) say they need your own keys.

**Its own data folder.** The app keeps its data in `%APPDATA%\Game Release Tracker`, so it never shares a library with another build.

## 0.6.0

The first public version.

**Your own sync settings.** A new **Sync** tab in Settings: search IGDB for the publishers you follow (or add a suggested set), choose your platforms (PC, Xbox, PlayStation, Nintendo Switch), set how far back to track releases, and turn automatic syncing on or off. These replace rules that used to be built in.

**A new welcome and a sample library.** A first-time user can load a sample library (30 upcoming games and 46 finished games with a full Year in Review) and look around every screen without IGDB keys. **Remove sample data** takes it out again.

**Settings in tabs:** Appearance, API keys, Sync and Diagnostics.

**Privacy.**
- Automatic sync is off until you turn it on.
- Year in Review's theme music waits for a click, unless you choose autoplay in Settings → Appearance.
- The installed app only uses keys saved in Settings, never ones from the computer's environment.
- **Delete all app data** in Settings → Diagnostics removes everything the app stored, after asking.
- **Open log folder** in Settings → Diagnostics.

**A Windows installer** alongside the zip, built automatically on GitHub for every release.

## 0.5.0

A clean-up release.

**Fixes**
- Clearing a game's exact finish date and typing a month no longer loses the month.
- A game's rating text and score can no longer disagree.
- The Upcoming list now refreshes after a sync that partly failed.
- A sync cut off by closing the app no longer leaves the app waiting for it forever.
- The Year in Review poster always draws in the right fonts.
- Keyboard shortcuts and Tab work while Year in Review's intro plays.

**Faster and smaller**
- Settings like Randomizer filters now survive restarting the app.
- The download is 11 MB smaller, the app ships 68 files instead of about 1,500, and the engine starts faster.
- The Completed Library and Settings load when you first open them, not at startup.
- Blurred backgrounds use smaller images.

## Before 0.5

The app grew from an upcoming-releases list into the full journal: the Calendar, the Completed Library with IGDB matching, the Randomizer, and Year in Review with its five illustrated chapters, theme music and shareable posters.
