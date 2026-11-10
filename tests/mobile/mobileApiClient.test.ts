import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApiClient, type ApiClient } from "../../apps/frontend/src/api/client";
import { openDatabase, type TrackerDatabase } from "../../apps/backend/src/database/db";
import { runMigrations } from "../../apps/backend/src/database/migrations";
import { resetWriteQueueForTests } from "../../apps/backend/src/database/writeQueue";
import { createBackendApp } from "../../apps/backend/src/server";
import { asTrackerDatabase, openWasmDatabase, type WasmDatabase } from "../../apps/mobile/src/wasmDatabase";
import { createMobileApiClient, prepareMobileDatabase } from "../../apps/mobile/src/mobileApiClient";

const today = new Date("2026-09-25T12:00:00Z");
let cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  delete process.env.GRT_DATA_DIR;
  resetWriteQueueForTests();
});

async function mobileClient() {
  const wasm = await openWasmDatabase();
  cleanups.push(() => wasm.close());
  const db = asTrackerDatabase(wasm);
  prepareMobileDatabase(db);
  return { wasm, api: createMobileApiClient(db, { today: () => today }) };
}

// The desktop path: the real Fastify backend on better-sqlite3, called through the same ApiClient.
function desktopClient(): ApiClient {
  const dir = mkdtempSync(join(tmpdir(), "grt-mobile-"));
  process.env.GRT_DATA_DIR = dir;
  const db: TrackerDatabase = openDatabase(join(dir, "tracker.db"));
  runMigrations(db);
  const app = createBackendApp({ db, autoSync: false, today: () => today });
  cleanups.push(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const inject: typeof fetch = async (input, init) => {
    const response = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url: String(input),
      payload: init?.body as string | undefined,
      headers: init?.body === undefined ? {} : { "content-type": "application/json" }
    });
    return new Response(response.body || null, { status: response.statusCode });
  };
  return createApiClient("", undefined, inject);
}

// Ids are random UUIDs, so each side numbers its own in order of appearance before comparing.
function withoutIds(value: unknown) {
  const ids = new Map<string, string>();
  return JSON.parse(JSON.stringify(value), (key, field) => {
    if ((key === "id" || key.endsWith("Id")) && typeof field === "string") {
      if (!ids.has(field)) ids.set(field, `id-${ids.size}`);
      return ids.get(field);
    }
    if (/(At|_at)$/.test(key) && typeof field === "string") return "<time>";
    return field;
  });
}

// One user session, run the same way against any ApiClient; returns every answer, or the error text.
async function session(api: ApiClient) {
  const answers: unknown[] = [];
  const step = async (call: () => Promise<unknown>) => {
    try {
      answers.push(await call());
    } catch (error) {
      answers.push({ failed: (error as Error).message });
    }
  };
  await step(() => api.loadDemo());
  const releases = await api.listReleases();
  answers.push(releases);
  const first = releases.items[0];
  await step(() => api.getRelease(first.id));
  await step(() => api.patchRelease(first.id, { watched: true }));
  await step(() => api.listReleases({ watchedOnly: true }));
  await step(() => api.patchRelease(first.id, { title: "Renamed by the test" }));
  await step(() => api.deleteRelease(releases.items[1].id));
  await step(() => api.listReleases({ search: "Renamed" }));
  const completed = await api.listCompletedGames();
  answers.push(completed);
  await step(() => api.getCompletedGame(completed.items[0].id));
  await step(() => api.patchCompletedGame(completed.items[0].id, { ratingRaw: "7.5", notes: "From the test" }));
  await step(() => api.listCompletedGames({ search: completed.items[1].title }));
  const years = await api.getYearInReviewYears();
  answers.push(years);
  if (years.years[0]) {
    await step(() => api.getYearInReview(years.years[0].year));
    await step(() => api.saveYearInReviewSettings(years.years[0].year, { gotyCompletedId: completed.items[0].id }));
  }
  await step(() => api.randomizerHistory(5));
  await step(() => api.getSettings());
  await step(() => api.patchSettings({ IGDB_CLIENT_ID: "client", IGDB_CLIENT_SECRET: "secret" }));
  await step(() => api.getSyncSettings());
  await step(() => api.updateSyncSettings({ autoSync: false }));
  await step(() => api.savePalette("dusk"));
  await step(() => api.getPreferences());
  await step(() => api.getRelease("no-such-release"));
  await step(() => api.removeDemo());
  await step(() => api.listReleases());
  return answers;
}

describe("WASM SQLite adapter", () => {
  test("runs every schema migration, FTS5 included", async () => {
    const { wasm } = await mobileClient();
    const version = wasm.prepare("select version from schema_version").get() as { version: number };
    expect(version.version).toBeGreaterThan(20);
    expect(wasm.prepare("select name from sqlite_master where name = 'releases_fts'").get()).toBeTruthy();
  });

  test("binds named parameters and rolls back nested transactions like better-sqlite3", async () => {
    const wasm: WasmDatabase = await openWasmDatabase();
    cleanups.push(() => wasm.close());
    wasm.exec("create table t (k text primary key, v integer)");
    wasm.prepare("insert into t values (@k, @v)").run({ k: "a", v: 1 });
    wasm.transaction(() => {
      wasm.prepare("insert into t values (?, ?)").run("b", 2);
      expect(() => wasm.transaction(() => {
        wasm.prepare("insert into t values (?, ?)").run(["c", 3]);
        throw new Error("inner fails");
      })()).toThrow("inner fails");
    })();
    expect(wasm.prepare("select k, v from t order by k").all()).toEqual([{ k: "a", v: 1 }, { k: "b", v: 2 }]);
  });

  test("exports the library and opens it again from the bytes", async () => {
    const wasm = await openWasmDatabase();
    wasm.exec("create table t (v text); insert into t values ('kept')");
    const bytes = wasm.export();
    wasm.close();
    const reopened = await openWasmDatabase(bytes);
    cleanups.push(() => reopened.close());
    expect(reopened.prepare("select v from t").get()).toEqual({ v: "kept" });
  });

  test("reports each committed write so the library can be saved", async () => {
    const changes: number[] = [];
    const wasm = await openWasmDatabase(undefined, () => changes.push(1));
    cleanups.push(() => wasm.close());
    wasm.exec("create table t (v integer)");
    wasm.prepare("insert into t values (1)").run();
    wasm.transaction(() => {
      wasm.prepare("insert into t values (2)").run();
      wasm.prepare("insert into t values (3)").run();
    })();
    wasm.prepare("select * from t").all();
    expect(changes.length).toBe(3);
  });
});

describe("in-app backend", () => {
  test("answers a whole session exactly as the desktop backend does", async () => {
    const { api } = await mobileClient();
    const mobile = await session(api);
    const desktop = await session(desktopClient());
    expect((mobile[1] as { items: unknown[] }).items.length).toBeGreaterThan(0);
    expect(withoutIds(mobile)).toEqual(withoutIds(desktop));
  });

  test("routes that serve files from disk say they aren't on Android yet", async () => {
    const { api } = await mobileClient();
    await expect(api.uploadLocalArtwork("x", { fileName: "a.png", mimeType: "image/png", dataBase64: "" })).rejects.toThrow("isn't available in the Android app yet");
    await expect(api.getWallpaper()).resolves.toEqual({ hasWallpaper: false, url: null });
  });
});

describe("library file", () => {
  test("saves once after a burst of writes, and right away on flush", async () => {
    const { createLibrarySaver } = await import("../../apps/mobile/src/libraryFile");
    const saved: Uint8Array[] = [];
    let version = 0;
    const saver = createLibrarySaver({ load: async () => null, save: async bytes => void saved.push(bytes) }, () => new Uint8Array([++version]), 20);
    saver.changed();
    saver.changed();
    saver.changed();
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(saved).toEqual([new Uint8Array([1])]);
    saver.changed();
    await saver.flush();
    expect(saved.length).toBe(2);
    await saver.flush();
    expect(saved.length).toBe(2);
  });

  test("a reopened library keeps what the app wrote", async () => {
    let file: Uint8Array | null = null;
    const { createLibrarySaver } = await import("../../apps/mobile/src/libraryFile");
    let saver: ReturnType<typeof createLibrarySaver> | undefined;
    const wasm = await openWasmDatabase(undefined, () => saver?.changed());
    saver = createLibrarySaver({ load: async () => file, save: async bytes => void (file = bytes) }, () => wasm.export(), 5);
    const db = asTrackerDatabase(wasm);
    prepareMobileDatabase(db);
    await createMobileApiClient(db, { today: () => today }).loadDemo();
    await saver.flush();
    wasm.close();
    const reopened = await openWasmDatabase(file!);
    cleanups.push(() => reopened.close());
    const again = asTrackerDatabase(reopened);
    prepareMobileDatabase(again);
    expect((await createMobileApiClient(again).listReleases()).items.length).toBeGreaterThan(0);
  });
});
