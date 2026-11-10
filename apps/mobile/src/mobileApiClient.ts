import { createApiClient, type ApiClient } from "../../frontend/src/api/client";
import type { ReleaseAlert } from "../../../shared/types";
import type { TrackerDatabase } from "../../backend/src/database/db";
import { runMigrations } from "../../backend/src/database/migrations";
import { createInAppBackend, type InAppBackendOptions } from "./backend/inAppServer";

// The Android app's ApiClient: the desktop renderer's own client, with requests answered by the in-app
// backend (apps/mobile/src/backend/inAppServer.ts) instead of HTTP to a child process.

export function prepareMobileDatabase(db: TrackerDatabase) {
  db.pragma("foreign_keys = ON");
  runMigrations(db);
}

export interface MobileApiClient extends ApiClient {
  // Release alerts not shown yet; taking them marks them shown. (On the desktop, Electron takes them.)
  takeAlerts(): Promise<ReleaseAlert[]>;
}

export function createMobileApiClient(db: TrackerDatabase, options: Omit<InAppBackendOptions, "db"> = {}): MobileApiClient {
  const backend = createInAppBackend({ db, ...options });
  const api = createApiClient("", undefined, backend.fetch);
  return {
    ...api,
    // The Academy UI has its own backdrop; there is no wallpaper file on Android.
    getWallpaper: async () => ({ hasWallpaper: false, url: null }),
    clearWallpaper: async () => ({ ok: true }),
    async takeAlerts() {
      const response = await backend.fetch("/api/alerts/take", { method: "POST", body: "{}" });
      return ((await response.json()) as { items: ReleaseAlert[] }).items;
    }
  };
}
