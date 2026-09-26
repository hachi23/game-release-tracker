import type { NormalizedRelease } from "../../../../shared/types";
import type { CompletedMetadataPatch } from "../completed/completedIgdbMatcher";
import { createCompletedGameStore } from "../completed/completedGameStore";
import type { TrackerDatabase } from "../database/db";
import { createReleaseStore } from "../database/releaseStore";
import { runWrite } from "../database/writeQueue";
import { normalizeText } from "../text/normalizeText";
import { computeSortDateAndEligibility } from "../sync/releasePolicy";
import sample from "./demoLibrary.json";

// The sample library a new user can load to try the app without IGDB keys: real games with their public
// IGDB data (covers, artwork, genres, ratings), and made-up personal data (ratings, finish dates, platforms,
// notes). It is written through the normal stores, so it behaves like any library, and the ids it created
// are remembered so "Remove sample data" takes out exactly those rows.

type SampleRelease = Omit<NormalizedRelease, "id" | "normalizedTitle" | "developers" | "sourceConfidence" | "eligible" | "eligibilityReason" | "effectiveSortDate" | "igdbId"> & { igdbId: number };
interface SampleCompletedGame {
  title: string;
  userPlatform: string;
  ratingRaw: string;
  // Finished `yearsAgo` years before the current one, on this month and day.
  yearsAgo: number;
  month: number;
  day: number;
  notes: string | null;
  metadata: CompletedMetadataPatch;
}

const SAMPLE_KEY = "DEMO_LIBRARY";
const releases = sample.releases as SampleRelease[];
const completedGames = sample.completedGames as SampleCompletedGame[];

interface LoadedSample {
  releaseIds: string[];
  completedIds: string[];
}

export function isDemoLibraryLoaded(db: TrackerDatabase) {
  return Boolean(db.prepare("select 1 from settings where key = ?").get(SAMPLE_KEY));
}

export function createDemoLibrary(db: TrackerDatabase, today: () => Date) {
  const readLoaded = () => {
    const row = db.prepare("select value from settings where key = ?").get(SAMPLE_KEY) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as LoadedSample) : null;
  };

  return {
    isLoaded: () => readLoaded() !== null,

    // Resolves to the counts written, or null when the sample is already loaded.
    load() {
      return runWrite(db, () => {
        if (readLoaded()) return null;
        const now = today();
        const releaseStore = createReleaseStore(db);
        const releaseIds = shiftedReleases(now).map(release => {
          releaseStore.save(release);
          return release.id;
        });
        const completedStore = createCompletedGameStore(db);
        const completedIds = finishedByToday(now).map(({ game, completionDate }) => {
          const saved = completedStore.createManual({ title: game.title, userPlatform: game.userPlatform, ratingRaw: game.ratingRaw, completionDate, notes: game.notes });
          completedStore.applyMatch(saved.id, game.metadata.igdbId!, game.metadata);
          return saved.id;
        });
        db.prepare("insert or replace into settings (key, value, updated_at) values (?, ?, current_timestamp)").run(SAMPLE_KEY, JSON.stringify({ releaseIds, completedIds }));
        return { releases: releaseIds.length, completedGames: completedIds.length };
      });
    },

    remove() {
      return runWrite(db, () => {
        const loaded = readLoaded();
        if (!loaded) return;
        const releaseStore = createReleaseStore(db);
        for (const id of loaded.releaseIds) releaseStore.delete(id);
        const completedStore = createCompletedGameStore(db);
        for (const id of loaded.completedIds) completedStore.deleteById(id);
        db.prepare("delete from settings where key = ?").run(SAMPLE_KEY);
      });
    }
  };
}

// The sample's upcoming dates, moved forward by whole years when needed so none is before this year.
function shiftedReleases(now: Date): NormalizedRelease[] {
  const firstYear = Math.min(...releases.map(release => Number((release.releaseDate ?? release.dateText).match(/\d{4}/)?.[0] ?? now.getUTCFullYear())));
  const shift = Math.max(0, now.getUTCFullYear() - firstYear);
  const move = (text: string | null) => (text ? text.replace(/\b(20\d{2})\b/g, year => String(Number(year) + shift)) : text);
  return releases.map(release => {
    const date = { dateText: move(release.dateText)!, releaseDate: move(release.releaseDate), datePrecision: release.datePrecision, releaseWindow: move(release.releaseWindow) };
    // No IGDB id: a later sync of the same game adds the user's own row instead of taking over the sample's.
    const { igdbId: _igdbId, ...rest } = release;
    return { ...rest, ...date, id: `demo-${release.igdbId}`, normalizedTitle: normalizeText(release.title), developers: [], sourceConfidence: date.releaseDate ? 90 : 60, ...computeSortDateAndEligibility(date) };
  });
}

// Last year's finishes all count; this year's only up to today, so "so far" stays true.
function finishedByToday(now: Date) {
  const todayIso = now.toISOString().slice(0, 10);
  return completedGames
    .map(game => {
      const year = now.getUTCFullYear() - game.yearsAgo;
      return { game, completionDate: `${year}-${String(game.month).padStart(2, "0")}-${String(game.day).padStart(2, "0")}` };
    })
    .filter(({ completionDate }) => completionDate <= todayIso);
}
