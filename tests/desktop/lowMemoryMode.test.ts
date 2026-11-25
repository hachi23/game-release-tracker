import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLowMemoryMode, registerLowMemoryModeIpc, writeLowMemoryMode } from "../../apps/desktop/src/lowMemoryMode";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "grt-lowmem-"));
  dirs.push(dir);
  return dir;
}

describe("low-memory mode desktop preference", () => {
  test("defaults to enabled, persists toggles, and honors GRT_ENABLE_GPU=1 override", () => {
    const dir = tempDir();
    expect(readLowMemoryMode(dir, {})).toBe(true);

    writeLowMemoryMode(dir, false);
    expect(readLowMemoryMode(dir, {})).toBe(false);

    writeLowMemoryMode(dir, true);
    expect(readLowMemoryMode(dir, {})).toBe(true);
    expect(readLowMemoryMode(dir, { GRT_ENABLE_GPU: "1" })).toBe(false);
  });

  test("IPC gets, sets, and relaunches only for app frames", async () => {
    const dir = tempDir();
    const handlers = new Map<string, (event: { senderFrame?: { url?: string } | null }, ...args: unknown[]) => unknown>();
    const relaunch = vi.fn();

    registerLowMemoryModeIpc({
      ipcMain: { handle: (channel, fn) => { handlers.set(channel, fn); } },
      isAppFrame: url => url.startsWith("app://renderer"),
      getUserDataDir: () => dir,
      active: true,
      relaunch
    });

    const appEvent = { senderFrame: { url: "app://renderer/" } };
    const foreignEvent = { senderFrame: { url: "https://example.com/" } };

    expect(handlers.get("get-low-memory-mode")!(foreignEvent)).toEqual({ supported: false, enabled: true, active: true });
    expect(handlers.get("get-low-memory-mode")!(appEvent)).toEqual({ supported: true, enabled: true, active: true });

    expect(handlers.get("set-low-memory-mode")!(appEvent, false)).toEqual({ supported: true, enabled: false, active: true });
    expect(readLowMemoryMode(dir, {})).toBe(false);

    await handlers.get("relaunch-app")!(foreignEvent);
    expect(relaunch).not.toHaveBeenCalled();

    await handlers.get("relaunch-app")!(appEvent);
    expect(relaunch).toHaveBeenCalledOnce();
  });
});
