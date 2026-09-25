import { describe, expect, test } from "vitest";
import { computeSortDateAndEligibility, chooseBestReleaseDate, evaluateCandidate, isApprovedCompany, normalizeIgdbGame } from "../../apps/backend/src/sync/releasePolicy";
import { applyFieldPrecedence } from "../../apps/backend/src/sync/releaseMerge";
import type { IgdbGameLike, ReleaseOverride } from "../../shared/types";

const baseGame: IgdbGameLike = {
  id: 1,
  name: "Persona 4 Revival",
  game_type: 8,
  first_release_date: 1802908800,
  release_dates: [
    { human: "Feb 18, 2027", date: 1802908800, platform: { id: 6, slug: "win", abbreviation: "PC", name: "PC" } }
  ],
  platforms: [{ id: 6, slug: "win", abbreviation: "PC", name: "PC" }, { id: 167, slug: "ps5", abbreviation: "PS5", name: "PlayStation 5" }],
  genres: [{ name: "Role-playing (RPG)" }],
  involved_companies: [{ company: { name: "Atlus" }, developer: true, publisher: true }],
  hypes: 50,
  total_rating_count: 0,
  url: "https://www.igdb.com/games/persona-4-revival",
  slug: "persona-4-revival",
  updated_at: 1800000000
};

describe("release eligibility and sort dates", () => {
  test("computes eligibility and effective sort dates from exact, year, window, and TBA values", () => {
    expect(computeSortDateAndEligibility({ dateText: "Jan 1, 2026", releaseDate: "2026-01-01", datePrecision: "Exact", releaseWindow: null })).toMatchObject({
      eligible: true,
      effectiveSortDate: "2026-01-01"
    });
    expect(computeSortDateAndEligibility({ dateText: "2027", releaseDate: null, datePrecision: "Year", releaseWindow: "2027" })).toMatchObject({
      eligible: true,
      effectiveSortDate: "2027-01-01"
    });
    expect(computeSortDateAndEligibility({ dateText: "Early 2027", releaseDate: null, datePrecision: "Window", releaseWindow: "Early 2027" })).toMatchObject({
      eligible: true,
      effectiveSortDate: "2027-01-01"
    });
    expect(computeSortDateAndEligibility({ dateText: "TBA", releaseDate: null, datePrecision: "TBA", releaseWindow: null })).toMatchObject({
      eligible: false,
      effectiveSortDate: null
    });
  });

  test("rejects releases before the fixed 2026 cutoff", () => {
    expect(computeSortDateAndEligibility({ dateText: "Dec 31, 2025", releaseDate: "2025-12-31", datePrecision: "Exact", releaseWindow: null }).eligible).toBe(false);
    expect(computeSortDateAndEligibility({ dateText: "Late 2025", releaseDate: null, datePrecision: "Window", releaseWindow: "Late 2025" }).eligible).toBe(false);
  });
});

describe("IGDB candidate rules", () => {
  test("includes DLC, expansions, remakes, remasters, expanded games, and ports", () => {
    for (const gameType of [0, 1, 2, 4, 8, 9, 10, 11]) {
      const result = evaluateCandidate({ ...baseGame, game_type: gameType });
      expect(result.accepted, `game_type ${gameType}`).toBe(true);
    }
  });

  test("rejects sports, demos, deluxe editions, season passes, and platform exclusives", () => {
    expect(evaluateCandidate({ ...baseGame, genres: [{ name: "Sports" }] }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, name: "Exodus Demo" }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, name: "Persona 4 Revival Digital Deluxe" }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, name: "Persona 4 Revival Guidebook Edition" }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, name: "Persona 4 Revival Complete Launch Edition" }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, name: "Persona 4 Revival Season Pass" }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, platforms: [{ abbreviation: "PS5", name: "PlayStation 5" }] }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, platforms: [{ abbreviation: "Switch", name: "Nintendo Switch" }] }).accepted).toBe(false);
  });

  test("does not accept incidental involved companies outside developer or publisher roles", () => {
    const result = evaluateCandidate({
      ...baseGame,
      involved_companies: [
        { company: { name: "Atlus" }, developer: false, publisher: false },
        { company: { name: "Small Port Studio" }, developer: true },
        { company: { name: "Unknown Publisher" }, publisher: true }
      ]
    });

    expect(result.accepted).toBe(false);
  });

  test("prefers accepted-platform dates over earlier PlayStation/Switch dates", () => {
    const date = chooseBestReleaseDate({
      ...baseGame,
      release_dates: [
        { human: "Jan 1, 2027", date: 1798761600, platform: { id: 167, slug: "ps5", abbreviation: "PS5", name: "PlayStation 5" } },
        { human: "Mar 3, 2027", date: 1804032000, platform: { id: 169, slug: "series-x-s", abbreviation: "Series X|S", name: "Xbox Series X|S" } }
      ]
    });

    expect(date.dateText).toBe("Mar 3, 2027");
    expect(date.releaseDate).toBe("2027-03-03");
    expect(date.datePrecision).toBe("Exact");
  });

  test("uses accepted-platform release date for 2026 cutoff", () => {
    const result = evaluateCandidate({
      ...baseGame,
      release_dates: [
        { human: "Dec 15, 2025", date: 1765756800, platform: { id: 167, slug: "ps5", abbreviation: "PS5", name: "PlayStation 5" } },
        { human: "Jan 20, 2026", date: 1768867200, platform: { id: 6, slug: "win", abbreviation: "WIN", name: "Windows PC" } }
      ]
    });

    expect(result.accepted).toBe(true);
  });

  test("rejects legacy platform false positives", () => {
    expect(evaluateCandidate({ ...baseGame, platforms: [{ id: 86, slug: "turbografx16--1", abbreviation: "TG16", name: "PC Engine" }] }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, platforms: [{ id: 12, slug: "xbox360", abbreviation: "X360", name: "Xbox 360" }] }).accepted).toBe(false);
    expect(evaluateCandidate({ ...baseGame, platforms: [{ abbreviation: "PC", name: "PC" }] }).accepted).toBe(false);
  });

  test("accepts canonical publisher aliases and Xbox Series platform slugs", () => {
    const result = evaluateCandidate({
      ...baseGame,
      involved_companies: [{ company: { name: "Ryu Ga Gotoku Studio" }, developer: true, publisher: false }, { company: { name: "Sega" }, publisher: true }],
      platforms: [{ id: 169, slug: "series-x-s", abbreviation: "Series X|S", name: "Xbox Series X|S" }],
      release_dates: [{ human: "Apr 2, 2027", date: 1806624000, platform: { id: 169, slug: "series-x-s", abbreviation: "Series X|S", name: "Xbox Series X|S" } }]
    });

    expect(result.accepted).toBe(true);
  });

  test("normalizes a repair seed with stale TBA into sourced release data", () => {
    const release = normalizeIgdbGame(baseGame);
    expect(release.title).toBe("Persona 4 Revival");
    expect(release.releaseDate).toBe("2027-02-18");
    expect(release.category).toBe("Remake");
  });

  test("normalizes IGDB artworks and keeps cover available for gallery capsules", () => {
    const release = normalizeIgdbGame({
      ...baseGame,
      cover: { image_id: "cover-only" },
      artworks: [{ image_id: "art-a" }, { image_id: "art-b" }]
    });

    expect(release.artworks).toEqual([
      { imageId: "art-a", source: "artwork" },
      { imageId: "art-b", source: "artwork" },
      { imageId: "cover-only", source: "cover" }
    ]);
  });

  test("normalizes one primary YouTube trailer using gameplay, announcement, then generic trailer priority", () => {
    const release = normalizeIgdbGame({
      ...baseGame,
      videos: [
        { video_id: "", name: "Broken Gameplay" },
        { video_id: "generic12345", name: "Overview Trailer" },
        { video_id: "announce123", name: "Announcement Trailer" },
        { video_id: "gameplay123", name: "Gameplay Trailer" }
      ]
    });

    expect(release.trailers).toEqual([{ videoId: "gameplay123", name: "Gameplay Trailer", provider: "youtube" }]);

    expect(normalizeIgdbGame({
      ...baseGame,
      videos: [
        { video_id: "overview123", name: "Overview Trailer" },
        { video_id: "announce123", name: "Announcement Trailer" }
      ]
    }).trailers).toEqual([{ videoId: "announce123", name: "Announcement Trailer", provider: "youtube" }]);

    expect(normalizeIgdbGame({
      ...baseGame,
      videos: [{ video_id: "overview123", name: "Overview Trailer" }]
    }).trailers).toEqual([{ videoId: "overview123", name: "Overview Trailer", provider: "youtube" }]);
  });

  test("uses cover image as fallback when artworks are missing", () => {
    const release = normalizeIgdbGame({
      ...baseGame,
      cover: { image_id: "cover-only" },
      artworks: []
    });

    expect(release.artworks).toEqual([{ imageId: "cover-only", source: "cover" }]);
  });

  test("accepts Bandai Namco games regardless of Inc./Ltd. suffix on the IGDB company name", () => {
    const echoesOfAincrad: IgdbGameLike = {
      id: 393932,
      name: "Echoes of Aincrad",
      game_type: 0,
      first_release_date: 1783641600,
      release_dates: [{ human: "Jul 10, 2026", date: 1783641600, platform: { id: 6, slug: "win", abbreviation: "PC", name: "PC (Microsoft Windows)" } }],
      platforms: [
        { id: 169, slug: "series-x-s", abbreviation: "Series X|S", name: "Xbox Series X|S" },
        { id: 6, slug: "win", abbreviation: "PC", name: "PC (Microsoft Windows)" },
        { id: 167, slug: "ps5", abbreviation: "PS5", name: "PlayStation 5" }
      ],
      genres: [{ name: "Role-playing (RPG)" }],
      involved_companies: [
        { company: { name: "Bandai Namco Entertainment Inc." }, publisher: true },
        { company: { name: "Game Studio Inc." }, developer: true }
      ],
      url: "https://www.igdb.com/games/echoes-of-aincrad",
      slug: "echoes-of-aincrad"
    };

    expect(evaluateCandidate(echoesOfAincrad).accepted).toBe(true);
  });

  test("isApprovedCompany matches via token subset for multi-token terms and exact-only for single-token terms", () => {
    expect(isApprovedCompany("Bandai Namco Entertainment")).toBe(true);
    expect(isApprovedCompany("Bandai Namco Entertainment Inc.")).toBe(true);
    expect(isApprovedCompany("Bandai Namco Entertainment Asia")).toBe(true);
    expect(isApprovedCompany("BANDAI NAMCO Games Asia Pte Ltd")).toBe(true);
    expect(isApprovedCompany("Bandai Namco Studios")).toBe(true);
    expect(isApprovedCompany("Bandai Namco Studios Malaysia")).toBe(true);
    expect(isApprovedCompany("Ryu Ga Gotoku Studio")).toBe(true);
    expect(isApprovedCompany("Electronic Arts")).toBe(true);
    expect(isApprovedCompany("Electronic Arts Originals")).toBe(true);
    expect(isApprovedCompany("Ubisoft Montreal")).toBe(true);
    expect(isApprovedCompany("Microsoft Gaming")).toBe(true);
    expect(isApprovedCompany("Square Enix Creative Studio")).toBe(true);
    expect(isApprovedCompany("Xbox Game Studios")).toBe(true);
    expect(isApprovedCompany("Wizards of the Coast")).toBe(true);
    expect(isApprovedCompany("Game Studio Inc.")).toBe(false);
    expect(isApprovedCompany("Unknown Publisher")).toBe(false);
    expect(isApprovedCompany("Kadokawa Corporation")).toBe(false);
    expect(isApprovedCompany("")).toBe(false);
    expect(isApprovedCompany("Sega")).toBe(true);
    expect(isApprovedCompany("Xbox")).toBe(true);
    expect(isApprovedCompany("EA")).toBe(true);
    expect(isApprovedCompany("Some EA Partner Studio")).toBe(false);
    expect(isApprovedCompany("Sega Sammy Holdings")).toBe(false);
    expect(isApprovedCompany("Sega Corporation")).toBe(true);
    expect(isApprovedCompany("Xbox Game Studios Publishing")).toBe(true);
  });
});

describe("override precedence", () => {
  test("applies user PATCH over seeded override over IGDB sync", () => {
    const igdb = { field: "dateText", value: "TBA", sourceType: "igdb" } satisfies ReleaseOverride;
    const seeded = { field: "dateText", value: "Jul 9, 2026", sourceType: "seeded", sourceUrl: "https://source.test", sourceName: "Source" } satisfies ReleaseOverride;
    const user = { field: "dateText", value: "Jul 10, 2026", sourceType: "user", sourceUrl: "https://user.test", sourceName: "Manual" } satisfies ReleaseOverride;

    expect(applyFieldPrecedence([igdb, seeded, user])).toBe("Jul 10, 2026");
    expect(applyFieldPrecedence([igdb, seeded])).toBe("Jul 9, 2026");
    expect(applyFieldPrecedence([igdb])).toBe("TBA");
  });
});
