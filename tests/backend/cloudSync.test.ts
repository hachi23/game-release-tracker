import { describe, expect, test } from "vitest";
import { openDatabase } from "../../apps/backend/src/database/db";
import { runMigrations } from "../../apps/backend/src/database/migrations";
import { createCompletedGameStore } from "../../apps/backend/src/completed/completedGameStore";
import { createReleaseStore } from "../../apps/backend/src/database/releaseStore";
import { createSyncSettingsStore } from "../../apps/backend/src/sync/syncSettingsStore";
import { createCloudSyncService, type CloudSyncFetcher } from "../../apps/backend/src/cloudSync/cloudSyncService";
import { CLOUD_SYNC_FILENAME } from "../../apps/backend/src/cloudSync/gistSnapshot";

function freshDb() {
  const db = openDatabase(":memory:");
  runMigrations(db);
  return db;
}

function createFakeGitHubGistServer({ truncateOver = Number.POSITIVE_INFINITY } = {}) {
  const gists = new Map<string, { id: string; files: Record<string, string> }>();
  let nextId = 1;

  const fetcher: CloudSyncFetcher = async (url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    if (auth !== "Bearer ghp_test_token") {
      return new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 });
    }

    if (url.startsWith("https://raw.fake/")) {
      const id = url.slice("https://raw.fake/".length);
      const gist = gists.get(id);
      return new Response(gist?.files[CLOUD_SYNC_FILENAME] ?? "", { status: 200 });
    }

    if (method === "GET" && url.startsWith("https://api.github.com/gists?")) {
      const list = [...gists.values()].map(g => ({
        id: g.id,
        files: Object.fromEntries(Object.keys(g.files).map(name => [name, { filename: name }]))
      }));
      return new Response(JSON.stringify(list), { status: 200 });
    }

    if (method === "POST" && url === "https://api.github.com/gists") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { files: Record<string, { content: string }> };
      const id = `gist-${nextId++}`;
      gists.set(id, {
        id,
        files: Object.fromEntries(Object.entries(body.files).map(([k, v]) => [k, v.content]))
      });
      return new Response(JSON.stringify({ id }), { status: 201 });
    }

    const match = /^https:\/\/api\.github\.com\/gists\/([^/?]+)$/.exec(url);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if (method === "GET") {
        const gist = gists.get(id);
        if (!gist) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
        const content = gist.files[CLOUD_SYNC_FILENAME] ?? "";
        const truncated = content.length > truncateOver;
        return new Response(JSON.stringify({
          id,
          files: {
            [CLOUD_SYNC_FILENAME]: truncated
              ? { filename: CLOUD_SYNC_FILENAME, content: content.slice(0, 10), truncated: true, raw_url: `https://raw.fake/${id}` }
              : { filename: CLOUD_SYNC_FILENAME, content, truncated: false }
          }
        }), { status: 200 });
      }
      if (method === "PATCH") {
        const gist = gists.get(id);
        if (!gist) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
        const body = JSON.parse(String(init?.body ?? "{}")) as { files: Record<string, { content: string }> };
        for (const [k, v] of Object.entries(body.files)) gist.files[k] = v.content;
        return new Response(JSON.stringify({ id }), { status: 200 });
      }
    }

    return new Response("Not Found", { status: 404 });
  };

  return { fetcher, gists };
}

describe("GitHub Gist two-way cloud sync", () => {
  test("auto-creates secret gist on Desktop, auto-discovers on Android by token alone, and merges two-way changes + deletions", async () => {
    const github = createFakeGitHubGistServer();
    const desktopDb = freshDb();
    const androidDb = freshDb();

    // Seed Desktop with completed game (4-category ratings), custom release + watch state, and tracked publisher
    const desktopCompleted = createCompletedGameStore(desktopDb);
    const desktopReleases = createReleaseStore(desktopDb);
    const desktopSyncSettings = createSyncSettingsStore(desktopDb);

    const ff = desktopCompleted.createManual({
      title: "Final Fantasy Resonance",
      userPlatform: "PC",
      completionDate: "2026-11-25",
      ratingBreakdown: { story: 9.5, combat: 9, art: 9.5, pacing: 8 },
      notes: "Loved the ending."
    });
    desktopReleases.save({
      id: "manual-silksong",
      title: "Hollow Knight: Silksong",
      normalizedTitle: "hollow knight silksong",
      dateText: "2027-06-01",
      releaseDate: "2027-06-01",
      datePrecision: "Exact",
      releaseWindow: null,
      category: "Main",
      publishers: ["Team Cherry"],
      developers: ["Team Cherry"],
      platforms: ["PC", "Switch"],
      genres: ["Platform"],
      sourceConfidence: 90,
      artworks: []
    });
    desktopReleases.updateUserState("manual-silksong", { watched: true });
    desktopSyncSettings.addPublishers([{ id: 37, name: "Capcom" }]);

    // Desktop syncs first — creates gist-1
    const desktopCloud = createCloudSyncService(desktopDb, github.fetcher);
    desktopCloud.saveConfig({ token: "ghp_test_token" });
    const firstRun = await desktopCloud.syncNow();
    expect(firstRun.ok).toBe(true);
    expect(firstRun.status.gistId).toBe("gist-1");
    expect(github.gists.size).toBe(1);

    // Android connects with ONLY the same token (no gistId) and adds its own completed game
    const androidCompleted = createCompletedGameStore(androidDb);
    androidCompleted.createManual({
      title: "Phantom Blade Zero",
      userPlatform: "PS5",
      completionDate: "2026-11-10",
      ratingRaw: "9.5"
    });

    const androidCloud = createCloudSyncService(androidDb, github.fetcher);
    androidCloud.saveConfig({ token: "ghp_test_token" });
    const secondRun = await androidCloud.syncNow();
    expect(secondRun.ok).toBe(true);
    expect(secondRun.status.gistId).toBe("gist-1");
    expect(secondRun.summary?.pulledCompleted).toBe(1);
    expect(secondRun.summary?.pulledReleases).toBe(1);
    expect(secondRun.summary?.pulledPublishers).toBe(1);

    // Android now has BOTH completed games, the custom release (watched), and Capcom tracked
    expect(androidCompleted.list({}).total).toBe(2);
    const syncedFf = androidCompleted.getDetail(ff.id);
    expect(syncedFf?.ratingBreakdown).toEqual({ story: 9.5, combat: 9, art: 9.5, pacing: 8 });
    expect(createReleaseStore(androidDb).getDetail("manual-silksong")?.watched).toBe(true);
    expect(createSyncSettingsStore(androidDb).read().publishers).toEqual([{ id: 37, name: "Capcom" }]);

    // Android deletes Final Fantasy Resonance and edits timestamp slightly later; syncs -> Desktop pulls Phantom Blade Zero AND removes Final Fantasy Resonance
    androidDb.prepare("update completed_games set updated_at = '2026-11-25 10:00:00' where id = ?").run(ff.id);
    desktopDb.prepare("update completed_games set updated_at = '2026-11-25 10:00:00' where id = ?").run(ff.id);
    expect(androidCompleted.deleteById(ff.id)).toBe(true);
    const thirdRun = await androidCloud.syncNow();
    expect(thirdRun.ok).toBe(true);
    const snapAfterThird = JSON.parse(github.gists.get("gist-1")!.files[CLOUD_SYNC_FILENAME]);
    expect(snapAfterThird.completedGames.map((g: { title: string }) => g.title)).toEqual(["Phantom Blade Zero"]);

    const fourthRun = await desktopCloud.syncNow();
    expect(fourthRun.ok).toBe(true);
    expect(fourthRun.summary).toMatchObject({ pulledCompleted: 1, deletedCompleted: 1 });
    const desktopList = desktopCompleted.list({}).items.map(i => i.title);
    expect(desktopList).toEqual(["Phantom Blade Zero"]);
  });

  test("handles truncated (>1MB) GitHub Gist files via raw_url fallback", async () => {
    const github = createFakeGitHubGistServer({ truncateOver: 50 });
    const dbA = freshDb();
    const dbB = freshDb();

    createCompletedGameStore(dbA).createManual({ title: "Chrono Trigger", userPlatform: "SNES", ratingRaw: "10" });
    const syncA = createCloudSyncService(dbA, github.fetcher);
    syncA.saveConfig({ token: "ghp_test_token" });
    await syncA.syncNow();

    const syncB = createCloudSyncService(dbB, github.fetcher);
    syncB.saveConfig({ token: "ghp_test_token" });
    const res = await syncB.syncNow();
    expect(res.ok).toBe(true);
    expect(createCompletedGameStore(dbB).list({}).items.map(i => i.title)).toEqual(["Chrono Trigger"]);
  });
});
