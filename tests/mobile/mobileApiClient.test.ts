import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, type TrackerDatabase } from "../../apps/backend/src/database/db";
import { runMigrations } from "../../apps/backend/src/database/migrations";
import { resetWriteQueueForTests } from "../../apps/backend/src/database/writeQueue";
import { createBackendApp } from "../../apps/backend/src/server";
import { asTrackerDatabase, openWasmDatabase, type WasmDatabase } from "../../apps/mobile/src/wasmDatabase";
import { createMobileApiClient, NotOnAndroidYet, prepareMobileDatabase } from "../../apps/mobile/src/mobileApiClient";

const today = new Date("2026-09-25T12:00:00Z");
let cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  delete process.env.GRT_DATA_DIR;
  resetWriteQueueForTests();
});

async function mobileClient() {
  const wasm = await openWasmDatabase(":memory:");
  cleanups.push(() => wasm.close());
  const db = asTrackerDatabase(wasm);
  prepareMobileDatabase(db);
  return { wasm, api: createMobileApiClient(db, () => today) };
}

// The desktop path: the real Fastify backend on better-sqlite3, called over (injected) HTTP.
function desktopApp() {
  const dir = mkdtempSync(join(tmpdir(), "grt-mobile-"));
  process.env.GRT_DATA_DIR = dir;
  const db: TrackerDatabase = openDatabase(join(dir, "tracker.db"));
  runMigrations(db);
  const app = createBackendApp({ db, autoSync: false, today: () => today });
  cleanups.push(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return app;
}

// Ids are random UUIDs, so each side numbers its own in order of appearance before comparing.
function withoutIds(value: unknown) {
  const ids = new Map<string, string>();
  return JSON.parse(JSON.stringify(value), (key, field) => {
    if ((key === "id" || key.endsWith("Id")) && typeof field === "string") {
      if (!ids.has(field)) ids.set(field, `id-${ids.size}`);
      return ids.get(field);
    }
    return field;
  });
}

describe("WASM SQLite adapter", () => {
  test("runs every schema migration, FTS5 included", async () => {
    const { wasm } = await mobileClient();
    const version = wasm.prepare("select version from schema_version").get() as { version: number };
    expect(version.version).toBeGreaterThan(20);
    expect(wasm.prepare("select name from sqlite_master where name = 'releases_fts'").get()).toBeTruthy();
  });

  test("binds named parameters and rolls back nested transactions like better-sqlite3", async () => {
    const wasm: WasmDatabase = await openWasmDatabase(":memory:");
    cleanups.push(() => wasm.close());
    wasm.exec("create table t (k text primary key, v integer)");
    wasm.prepare("insert into t values (@k, @v)").run({ k: "a", v: 1 });
    const outer = wasm.transaction(() => {
      wasm.prepare("insert into t values (?, ?)").run("b", 2);
      expect(() => wasm.transaction(() => {
        wasm.prepare("insert into t values (?, ?)").run(["c", 3]);
        throw new Error("inner fails");
      })()).toThrow("inner fails");
    });
    outer();
    expect(wasm.prepare("select k, v from t order by k").all()).toEqual([{ k: "a", v: 1 }, { k: "b", v: 2 }]);
    expect(wasm.pragma("foreign_keys", { simple: true })).toBe(0);
  });
});

describe("in-app ApiClient", () => {
  test("lists the same Upcoming releases and Completed Library as the desktop backend", async () => {
    const { api } = await mobileClient();
    const app = desktopApp();

    expect(await api.loadDemo()).toEqual((await app.inject({ method: "POST", url: "/api/demo" })).json());

    const desktopReleases = (await app.inject({ method: "GET", url: "/api/releases" })).json();
    const mobileReleases = await api.listReleases();
    expect(mobileReleases.items.length).toBeGreaterThan(0);
    expect(withoutIds(mobileReleases)).toEqual(withoutIds(desktopReleases));

    const search = await api.listReleases({ search: desktopReleases.items[0].title });
    expect(search.items[0].title).toBe(desktopReleases.items[0].title);

    const detail = await api.getRelease(mobileReleases.items[0].id);
    const desktopDetail = (await app.inject({ method: "GET", url: `/api/releases/${desktopReleases.items[0].id}` })).json();
    expect(withoutIds(detail)).toEqual(withoutIds(desktopDetail));

    const desktopCompleted = (await app.inject({ method: "GET", url: "/api/completed-games" })).json();
    expect(withoutIds(await api.listCompletedGames())).toEqual(withoutIds(desktopCompleted));
  });

  test("boots the app shell's start-up calls and names what is not ported yet", async () => {
    const { api } = await mobileClient();
    await expect(api.getSettings()).resolves.toMatchObject({ credentialStatus: { status: "missing" } });
    await expect(api.getSyncStatus()).resolves.toBeTruthy();
    await expect(api.getSyncSettings()).resolves.toBeTruthy();
    await expect(api.savePalette("dusk")).resolves.toEqual({ palette: "dusk" });
    await expect(api.getPreferences()).resolves.toMatchObject({ palette: "dusk" });
    await expect(api.syncNow()).rejects.toBeInstanceOf(NotOnAndroidYet);
  });
});
