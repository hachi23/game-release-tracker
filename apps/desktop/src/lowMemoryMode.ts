import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Desktop-only startup preference stored in userData/desktop-prefs.json because Electron requires
// app.disableHardwareAcceleration() before app.whenReady(), before the SQLite database opens.
// Enabled by default so the app runs cleanly on low-RAM (2 GB+) systems; users can toggle it off
// in Settings → Appearance for GPU-accelerated Year in Review / Randomizer animations.

const PREFS_FILE = "desktop-prefs.json";

export interface LowMemoryModeState {
  supported: boolean;
  enabled: boolean;
  active: boolean;
}

export function readLowMemoryMode(userDataDir: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GRT_ENABLE_GPU === "1") return false;
  try {
    const file = join(userDataDir, PREFS_FILE);
    if (!existsSync(file)) return true;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { lowMemoryMode?: unknown };
    return typeof parsed.lowMemoryMode === "boolean" ? parsed.lowMemoryMode : true;
  } catch {
    return true;
  }
}

export function writeLowMemoryMode(userDataDir: string, enabled: boolean): void {
  mkdirSync(userDataDir, { recursive: true });
  const file = join(userDataDir, PREFS_FILE);
  let existing: Record<string, unknown> = {};
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    }
  } catch {
    existing = {};
  }
  writeFileSync(file, JSON.stringify({ ...existing, lowMemoryMode: enabled }, null, 2), "utf8");
}

interface IpcLike {
  handle(channel: string, listener: (event: { senderFrame?: { url?: string } | null }, ...args: unknown[]) => unknown): void;
}

export function registerLowMemoryModeIpc({
  ipcMain,
  isAppFrame,
  getUserDataDir,
  active,
  relaunch
}: {
  ipcMain: IpcLike;
  isAppFrame: (url: string) => boolean;
  getUserDataDir: () => string;
  active: boolean;
  relaunch: () => Promise<void> | void;
}) {
  const fromApp = (event: { senderFrame?: { url?: string } | null }) => isAppFrame(event.senderFrame?.url ?? "");

  ipcMain.handle("get-low-memory-mode", (event): LowMemoryModeState => {
    if (!fromApp(event)) return { supported: false, enabled: true, active };
    return { supported: true, enabled: readLowMemoryMode(getUserDataDir()), active };
  });

  ipcMain.handle("set-low-memory-mode", (event, on): LowMemoryModeState => {
    if (!fromApp(event)) return { supported: false, enabled: true, active };
    const enabled = Boolean(on);
    writeLowMemoryMode(getUserDataDir(), enabled);
    return { supported: true, enabled, active };
  });

  ipcMain.handle("relaunch-app", async event => {
    if (!fromApp(event)) return { ok: false };
    await relaunch();
    return { ok: true };
  });
}
