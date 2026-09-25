import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../../apps/backend/src/database/db";
import { runMigrations } from "../../apps/backend/src/database/migrations";
import {
  buildPublisherGameQuery,
  discoverIgdbCandidates
} from "../../apps/backend/src/sync/igdbCandidateSource";
import type { IgdbGameLike } from "../../shared/types";

let dirs: string[] = [];
let dbs: Array<{ close(): void }> = [];

afterEach(() => {
  for (const db of dbs) db.close();
  dbs = [];
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

function setupDb() {
  const dir = mkdtempSync(join(tmpdir(), "grt-candidates-"));
  dirs.push(dir);
  const db = openDatabase(join(dir, "tracker.db"));
  dbs.push(db);
  runMigrations(db);
  return db;
}

class FakeIgdbClient {
  calls: Array<{ endpoint: string; body: string }> = [];

  async query<T>(endpoint: string, body: string): Promise<T[]> {
    this.calls.push({ endpoint, body });
    if (endpoint === "companies" && body.includes('name = "Atlus"')) {
      return [{ id: 1, name: "Atlus", slug: "atlus" }] as T[];
    }
    if (endpoint === "games" && body.includes("involved_companies.company = (1)")) {
      return [game(101, "Publisher Game")] as T[];
    }
    if (endpoint === "games" && body.includes('search "Trails"')) {
      return [game(101, "Publisher Game"), game(202, "Trails Game")] as T[];
    }
    return [];
  }
}

describe("IGDB candidate source", () => {
  test("publisher lookups are reused on the next sync instead of asking IGDB again", async () => {
    const db = setupDb();
    const first = new FakeIgdbClient();
    await discoverIgdbCandidates(first, db, { searchTerms: ["Atlus"], repairTitles: [], minReleaseDate: "2026-01-01" });
    expect(first.calls.filter(call => call.endpoint === "companies").length).toBeGreaterThan(0);

    const second = new FakeIgdbClient();
    const candidates = await discoverIgdbCandidates(second, db, { searchTerms: ["Atlus"], repairTitles: [], minReleaseDate: "2026-01-01" });

    expect(second.calls.filter(call => call.endpoint === "companies")).toEqual([]);
    expect(candidates.map(item => item.id)).toEqual([101]);
  });

  test("stale publisher lookups (over 30 days) are looked up again", async () => {
    const db = setupDb();
    await discoverIgdbCandidates(new FakeIgdbClient(), db, { searchTerms: ["Atlus"], repairTitles: [], minReleaseDate: "2026-01-01" });
    db.prepare("update publisher_sync_state set updated_at = datetime('now', '-31 days')").run();

    const client = new FakeIgdbClient();
    await discoverIgdbCandidates(client, db, { searchTerms: ["Atlus"], repairTitles: [], minReleaseDate: "2026-01-01" });

    expect(client.calls.filter(call => call.endpoint === "companies").length).toBeGreaterThan(0);
  });

  test("discovers candidates from resolved publishers and repair-title searches", async () => {
    const db = setupDb();
    const client = new FakeIgdbClient();

    const candidates = await discoverIgdbCandidates(client, db, {
      searchTerms: ["Atlus"],
      repairTitles: ["Trails"],
      minReleaseDate: "2026-01-01"
    });

    expect(candidates.map(candidate => candidate.id)).toEqual([101, 202]);
    expect(client.calls.some(call => call.endpoint === "games" && call.body.includes("involved_companies.company = (1)"))).toBe(true);
    expect(client.calls.some(call => call.endpoint === "games" && call.body.includes('search "Trails"'))).toBe(true);
    expect(db.prepare("select company_ids companyIds, company_names companyNames, last_error lastError from publisher_sync_state where approved_term = 'Atlus'").get()).toEqual({
      companyIds: "[1]",
      companyNames: "[\"Atlus\"]",
      lastError: null
    });
  });

  test("throws when no approved publisher or studio terms resolve", async () => {
    await expect(discoverIgdbCandidates(new FakeIgdbClient(), undefined, {
      searchTerms: ["Missing Studio"],
      repairTitles: []
    })).rejects.toThrow("IGDB company resolution returned no approved publisher/studio IDs");
  });

  test("publisher query keeps accepted game types, company ids, 2026+ dates, and metadata fields", () => {
    const query = buildPublisherGameQuery([17, 42], 1767225600, 0);

    expect(query).toContain("involved_companies.company = (17,42)");
    expect(query).toContain("game_type = (0,1,2,4,8,9,10,11)");
    expect(query).toContain("first_release_date >= 1767225600");
    expect(query).toContain("release_dates.y >= 2026");
    expect(query).toContain("artworks.image_id");
    expect(query).toContain("cover.image_id");
    expect(query).toContain("involved_companies.company.name");
  });
});

function game(id: number, name: string): IgdbGameLike {
  return {
    id,
    name,
    game_type: 0,
    first_release_date: 1767225600
  };
}
