import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { createLibrarySaver, defaultLibraryStore, exportLibraryCopy } from "./libraryFile";
import { prepareLibraryImport, type PreparedLibrary } from "./libraryImport";
import { createMobileApiClient, prepareMobileDatabase, type MobileApiClient } from "./mobileApiClient";
import { asTrackerDatabase, openWasmDatabase } from "./wasmDatabase";

// Starts the Android app's backend: opens the saved library, saves it after writes and when the app
// leaves the screen, syncs when a sync is due, and turns release alerts into Android notifications.

export interface LibraryTransfer {
  // Checks and upgrades a picked file; changes nothing yet.
  inspect(file: Uint8Array): Promise<PreparedLibrary>;
  // Replaces this phone's library with an inspected one, then restarts the app on it.
  replaceWith(prepared: PreparedLibrary): Promise<void>;
  // Saves a copy of this phone's library; returns where it went.
  exportCopy(): Promise<string>;
}

export interface MobileApp {
  api: MobileApiClient;
  library: LibraryTransfer;
  // Set by the UI: opens a release's page when its notification is tapped.
  onOpenRelease: (releaseId: string) => void;
}

export async function bootMobileApp(): Promise<MobileApp> {
  const store = defaultLibraryStore();
  const saved = await store.load();
  let saver: ReturnType<typeof createLibrarySaver> | undefined;
  const wasm = await openWasmDatabase(saved ?? undefined, () => saver?.changed());
  saver = createLibrarySaver(store, () => wasm.export());
  const db = asTrackerDatabase(wasm);
  prepareMobileDatabase(db);
  const api = createMobileApiClient(db);
  const library: LibraryTransfer = {
    inspect: prepareLibraryImport,
    async replaceWith(prepared) {
      await saver?.flush();
      saver?.stop();
      await store.save(prepared.bytes);
      window.location.reload();
    },
    exportCopy: () => exportLibraryCopy(wasm.export())
  };
  const app: MobileApp = { api, library, onOpenRelease: () => undefined };

  const flush = () => void saver?.flush();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  if (Capacitor.isNativePlatform()) {
    void App.addListener("pause", flush);
    void App.addListener("resume", () => void checkIn(api));
    void LocalNotifications.addListener("localNotificationActionPerformed", event => {
      const releaseId = (event.notification.extra as { releaseId?: string } | undefined)?.releaseId;
      if (releaseId) app.onOpenRelease(releaseId);
    });
  }
  void checkIn(api);
  return app;
}

// On start and each return to the app: sync if due (Settings → Sync automatically), then notify.
async function checkIn(api: MobileApiClient) {
  try {
    const settings = await api.getSettings();
    if (settings.autoSyncDue) await waitForSync(api, await api.syncNow());
    await notifyAlerts(api);
  } catch (error) {
    console.warn("Check-in failed", error);
  }
}

async function waitForSync(api: MobileApiClient, status: Awaited<ReturnType<MobileApiClient["syncNow"]>>) {
  let current = status;
  for (let i = 0; i < 120 && current.status === "running"; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    current = await api.getSyncStatus();
  }
}

async function notifyAlerts(api: MobileApiClient) {
  if (!Capacitor.isNativePlatform()) return;
  const response = await api.takeAlerts();
  if (!response.length) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;
  await LocalNotifications.schedule({
    notifications: response.map((alert, index) => ({
      id: (Date.now() % 1_000_000_000) + index,
      title: alert.title,
      body: alert.body,
      extra: { releaseId: alert.releaseId }
    }))
  });
}
