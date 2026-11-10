import type { ApiClient } from "../../frontend/src/api/client";
import type { ActionResult } from "../../backend/src/actions/actionResult";
import { readPreferences, savePalette, saveThemeAutoplay } from "../../backend/src/actions/preferencesActions";
import { readSyncSettings } from "../../backend/src/actions/syncSettingsActions";
import { createCompletedGameStore } from "../../backend/src/completed/completedGameStore";
import type { TrackerDatabase } from "../../backend/src/database/db";
import { runMigrations } from "../../backend/src/database/migrations";
import { createReleaseStore } from "../../backend/src/database/releaseStore";
import { createDemoLibrary } from "../../backend/src/demo/demoLibrary";
import { readSettingsStatus } from "../../backend/src/settings/settingsCredentialModule";
import { createSyncSettingsStore } from "../../backend/src/sync/syncSettingsStore";
import { getSyncStatus } from "../../backend/src/sync/syncStatus";

// The Android proof of concept's ApiClient: instead of HTTP to the backend child process, it calls the
// backend's stores and actions in the page, on the WASM SQLite database. Each method mirrors its route
// in apps/backend/src/routes. Calls not ported yet reject with a clear message.

export class NotOnAndroidYet extends Error {
  constructor(feature: string) {
    super(`${feature} isn't available in the Android preview yet.`);
  }
}

function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

const flag = (value: unknown) => value === true || value === "true";
const text = (value: unknown) => (value === undefined || value === null || value === "" ? undefined : String(value));

export function prepareMobileDatabase(db: TrackerDatabase) {
  db.pragma("foreign_keys = ON");
  runMigrations(db);
}

export function createMobileApiClient(db: TrackerDatabase, today: () => Date = () => new Date()): ApiClient {
  const releases = createReleaseStore(db);
  const completed = createCompletedGameStore(db);
  const demo = createDemoLibrary(db, today);
  const notYet = (feature: string) => () => Promise.reject(new NotOnAndroidYet(feature));

  return {
    async listReleases(params = {}) {
      return releases.list({
        search: text(params.search),
        publisher: text(params.publisher),
        category: text(params.category),
        platform: text(params.platform),
        datePrecision: text(params.datePrecision),
        includeHidden: flag(params.includeHidden),
        includeReleased: flag(params.includeReleased),
        watchedOnly: flag(params.watchedOnly),
        releasedFrom: createSyncSettingsStore(db).read().trackFrom
      } as Parameters<typeof releases.list>[0]);
    },
    async getRelease(id) {
      const release = releases.getDetail(id);
      if (!release) throw new Error("Release not found");
      return release;
    },
    async listCompletedGames(params = {}) {
      return completed.list({
        search: text(params.search),
        platform: text(params.platform),
        year: text(params.year),
        month: text(params.month),
        rating: text(params.rating),
        dateState: text(params.dateState)
      } as Parameters<typeof completed.list>[0]);
    },
    async getCompletedGame(id) {
      const item = completed.getDetail(id);
      if (!item) throw new Error("Completed game not found");
      return item;
    },
    async getDemo() {
      return { loaded: demo.isLoaded() };
    },
    async loadDemo() {
      const counts = await demo.load();
      if (!counts) throw new Error("The sample library is already loaded");
      return { loaded: true, ...counts };
    },
    async removeDemo() {
      await demo.remove();
      return { loaded: false };
    },
    async getSettings() {
      return readSettingsStatus(db);
    },
    async getSyncStatus() {
      return getSyncStatus(db);
    },
    async getSyncSettings() {
      return readSyncSettings(db);
    },
    async getPreferences() {
      return readPreferences(db);
    },
    async savePalette(palette) {
      return unwrap(await savePalette(db, { palette }));
    },
    async saveThemeAutoplay(themeAutoplay) {
      return unwrap(await saveThemeAutoplay(db, { themeAutoplay }));
    },
    async getWallpaper() {
      return { hasWallpaper: false, url: null };
    },
    async logEvent(event, details) {
      console.info("[app]", event, details ?? {});
      return { ok: true };
    },

    searchManualReleaseCandidates: notYet("Adding games from IGDB"),
    createManualRelease: notYet("Adding games"),
    patchRelease: notYet("Editing releases"),
    deleteRelease: notYet("Deleting releases"),
    uploadLocalArtwork: notYet("Custom artwork"),
    deleteArtwork: notYet("Custom artwork"),
    reorderArtworks: notYet("Custom artwork"),
    syncNow: notYet("IGDB sync"),
    patchSettings: notYet("Saving IGDB keys"),
    clearCredentials: notYet("Saving IGDB keys"),
    testCredentials: notYet("Testing IGDB keys"),
    updateSyncSettings: notYet("Sync settings"),
    searchPublishers: notYet("Publisher search"),
    trackPublisher: notYet("Tracking publishers"),
    untrackPublisher: notYet("Tracking publishers"),
    trackSuggestedPublishers: notYet("Tracking publishers"),
    clearWallpaper: notYet("Wallpaper"),
    searchManualCompletedCandidates: notYet("IGDB matching"),
    createManualCompletedGame: notYet("Adding finished games"),
    deleteCompletedGame: notYet("Deleting finished games"),
    patchCompletedGame: notYet("Editing finished games"),
    getCompletedMatchCandidates: notYet("IGDB matching"),
    saveCompletedMatch: notYet("IGDB matching"),
    randomizerOptions: notYet("The Randomizer"),
    spinRandomizer: notYet("The Randomizer"),
    randomizerHistory: notYet("The Randomizer"),
    clearRandomizerHistory: notYet("The Randomizer"),
    searchRandomizerTags: notYet("The Randomizer"),
    searchRandomizerSeries: notYet("The Randomizer"),
    searchRandomizerGames: notYet("The Randomizer"),
    getYearInReviewYears: notYet("Year in Review"),
    getYearInReview: notYet("Year in Review"),
    saveYearInReviewSettings: notYet("Year in Review")
  };
}
