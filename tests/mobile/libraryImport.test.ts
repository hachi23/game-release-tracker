import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../../apps/backend/src/database/db";
import { runMigrations } from "../../apps/backend/src/database/migrations";
import { resetWriteQueueForTests } from "../../apps/backend/src/database/writeQueue";
import { createBackendApp } from "../../apps/backend/src/server";
import { LibraryImportError, prepareLibraryImport } from "../../apps/mobile/src/libraryImport";
import { createMobileApiClient } from "../../apps/mobile/src/mobileApiClient";
import { asTrackerDatabase, openWasmDatabase } from "../../apps/mobile/src/wasmDatabase";

let dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  delete process.env.GRT_DATA_DIR;
  resetWriteQueueForTests();
});

// A library as the desktop app leaves it: WAL mode, the sample library, a key sealed with the desktop's key.
async function desktopLibrary(edit?: (db: ReturnType<typeof openDatabase>) => void) {
  const dir = mkdtempSync(join(tmpdir(), "grt-import-"));
  dirs.push(dir);
  process.env.GRT_DATA_DIR = dir;
  const path = join(dir, "game-release-tracker.db");
  const db = openDatabase(path);
  runMigrations(db);
  const app = createBackendApp({ db, autoSync: false, today: () => new Date("2026-09-25T12:00:00Z") });
  await app.inject({ method: "POST", url: "/api/demo" });
  const desktop = { releases: (await app.inject({ method: "GET", url: "/api/releases" })).json().items.length, completed: (await app.inject({ method: "GET", url: "/api/completed-games" })).json().items.length };
  db.prepare("insert or replace into settings (key, value, updated_at) values ('IGDB_CLIENT_ID', 'enc:v1:aaa:bbb:ccc', current_timestamp)").run();
  edit?.(db);
  await app.close();
  db.close();
  return { bytes: new Uint8Array(readFileSync(path)), desktop };
}

describe("importing the desktop library", () => {
  test("opens a WAL-mode desktop library with every game, and flags keys to re-enter", async () => {
    const { bytes, desktop } = await desktopLibrary();
    expect(bytes[18]).toBe(2);
    const prepared = await prepareLibraryImport(bytes);
    expect(prepared.completed).toBe(desktop.completed);
    expect(prepared.upcoming).toBeGreaterThanOrEqual(desktop.releases);
    expect(prepared.keysNeedReentering).toBe(true);

    const phone = await openWasmDatabase(prepared.bytes);
    const api = createMobileApiClient(asTrackerDatabase(phone), { today: () => new Date("2026-09-25T12:00:00Z") });
    expect((await api.listReleases()).items.length).toBe(desktop.releases);
    expect((await api.listCompletedGames()).items.length).toBe(desktop.completed);
    expect((await api.getSettings()).credentials.IGDB_CLIENT_ID).toEqual({ saved: false, unreadable: true });
    phone.close();
  });

  test("refuses a file that isn't a library, and a library from a newer app version", async () => {
    await expect(prepareLibraryImport(new TextEncoder().encode("not a database at all, just text"))).rejects.toBeInstanceOf(LibraryImportError);
    const { bytes } = await desktopLibrary(db => db.prepare("update schema_version set version = 999").run());
    await expect(prepareLibraryImport(bytes)).rejects.toThrow(/newer version/);
  });

  test("upgrades an older library to the current schema", async () => {
    const { bytes } = await desktopLibrary(db => {
      db.exec("alter table completed_games drop column verdict; alter table completed_games drop column favourite_shot; alter table completed_games drop column favourite_caption; alter table completed_games drop column replay; update schema_version set version = 21");
    });
    const prepared = await prepareLibraryImport(bytes);
    const phone = await openWasmDatabase(prepared.bytes);
    expect((phone.prepare("select version from schema_version").get() as { version: number }).version).toBe(22);
    phone.close();
  });
});
