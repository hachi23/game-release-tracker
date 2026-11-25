import type { CompletedGameDetail, CompletedGameFilters, CompletedGameListItem, CompletedRatingBreakdown, ReleaseArtwork } from "../../../../shared/types";
import { completedGenres } from "../../../../shared/completedGenres";
import { hasAnyCategoryRating } from "../../../../shared/completedRatings";
import type { TrackerDatabase } from "../database/db";
import { nullable, parseJson, toNumberOrNull } from "../database/rowHelpers";
import { normalizeText } from "../text/normalizeText";

// Lean column list for Completed list reads: skips large detail-only columns (summary,
// screenshots_json, extra_json, themes/modes) so listing hundreds of games stays fast and light.
const LIST_COLUMNS = `
  id, title, normalized_title, user_platform,
  rating_raw, rating_score, rating_story, rating_combat, rating_art, rating_pacing,
  notes, completion_date, completion_month, completion_year, completion_precision,
  developer, publisher, genres_json, igdb_genres_json, platforms_json,
  cover_image_id, igdb_id, match_status
`;

export function createCompletedReadModel(db: TrackerDatabase) {
  return {
    getByIdentity(identityKey: string) {
      const row = db.prepare("select * from completed_games where identity_key = ?").get(identityKey) as Record<string, unknown> | undefined;
      return row ? rowToDetail(row) : null;
    },

    list(filters: CompletedGameFilters) {
      const params: Record<string, string | number> = {};
      const where: string[] = ["1 = 1"];
      if (filters.search) {
        params.search = `%${normalizeText(filters.search)}%`;
        where.push("(normalized_title like @search or lower(coalesce(developer, '')) like @search or lower(coalesce(publisher, '')) like @search or lower(coalesce(notes, '')) like @search)");
      }
      if (filters.platform) {
        params.platform = filters.platform;
        where.push("user_platform = @platform");
      }
      if (filters.year) {
        params.year = Number(filters.year);
        where.push("completion_year = @year");
      }
      if (filters.month) {
        params.month = filters.month;
        where.push("completion_month = @month");
      }
      if (filters.rating) {
        params.rating = Number(filters.rating);
        where.push("rating_score >= @rating");
      }
      if (filters.dateState === "dated") where.push("completion_precision in ('exact', 'month')");
      if (filters.dateState === "undated") where.push("completion_precision in ('none', 'year')");
      const rows = db.prepare(`
        select ${LIST_COLUMNS} from completed_games
        where ${where.join(" and ")}
        order by coalesce(completion_month, '9999-99'), title
      `).all(params) as Array<Record<string, unknown>>;
      const items = rows.map(rowToListItem);
      return { items, total: items.length };
    },

    getDetail(id: string) {
      const row = db.prepare("select * from completed_games where id = ?").get(id) as Record<string, unknown> | undefined;
      return row ? rowToDetail(row) : null;
    },

    // Everything Year in Review reads for one year: the year's finishes, the genres and platforms of every
    // earlier year (for "Something new"), and the number of finishes per year.
    yearInReviewRows(year: number) {
      const games = (db.prepare("select * from completed_games where completion_year = ?").all(year) as Array<Record<string, unknown>>).map(rowToReviewRow);
      const earlierRows = db.prepare(`
        select genres_json, igdb_genres_json, user_platform from completed_games where completion_year < ?
      `).all(year) as Array<Record<string, unknown>>;
      const genres = new Set<string>();
      const platforms = new Set<string>();
      for (const row of earlierRows) {
        for (const genre of completedGenres({ genres: parseJson(row.genres_json, []), igdbGenres: parseJson(row.igdb_genres_json, []) })) genres.add(genre.trim().toLowerCase());
        platforms.add(String(row.user_platform ?? ""));
      }
      return { games, earlier: { genres: [...genres], platforms: [...platforms] }, years: completionYearCounts() };
    },

    completionYearCounts
  };

  function completionYearCounts() {
    return db.prepare(`
      select completion_year year, count(*) count from completed_games
      where completion_year is not null group by completion_year
    `).all() as Array<{ year: number; count: number }>;
  }
}

// The Year in Review projection of a completed game: the fields its cards use, and nothing heavy
// beyond the screenshots the Game of the Year backdrop needs.
export interface CompletedReviewRow {
  id: string;
  title: string;
  userPlatform: string;
  ratingScore: number | null;
  completionDate: string | null;
  completionMonth: string | null;
  completionYear: number | null;
  completionPrecision: CompletedGameListItem["completionPrecision"];
  genres: string[];
  igdbGenres: string[];
  coverImageId: string | null;
  igdbId: number | null;
  developer: string | null;
  publisher: string | null;
  notes: string | null;
  igdbReleaseDate: string | null;
  igdbDeveloper: string | null;
  igdbPublisher: string | null;
  igdbThemes: string[];
  igdbGameModes: string[];
  igdbAggregatedRating: number | null;
  igdbTotalRatingCount: number | null;
  screenshots: ReleaseArtwork[];
}

function rowToReviewRow(row: Record<string, unknown>): CompletedReviewRow {
  const item = rowToListItem(row);
  return {
    id: item.id,
    title: item.title,
    userPlatform: item.userPlatform,
    ratingScore: item.ratingScore ?? null,
    completionDate: item.completionDate ?? null,
    completionMonth: item.completionMonth ?? null,
    completionYear: item.completionYear ?? null,
    completionPrecision: item.completionPrecision,
    genres: item.genres,
    igdbGenres: item.igdbGenres ?? [],
    coverImageId: item.coverImageId ?? null,
    igdbId: item.igdbId ?? null,
    developer: item.developer ?? null,
    publisher: item.publisher ?? null,
    notes: nullable(row.notes),
    igdbReleaseDate: nullable(row.igdb_release_date),
    igdbDeveloper: nullable(row.igdb_developer),
    igdbPublisher: nullable(row.igdb_publisher),
    igdbThemes: parseJson(row.igdb_themes_json, []),
    igdbGameModes: parseJson(row.igdb_game_modes_json, []),
    igdbAggregatedRating: toNumberOrNull(row.igdb_aggregated_rating),
    igdbTotalRatingCount: toNumberOrNull(row.igdb_total_rating_count),
    screenshots: parseJson(row.screenshots_json, [])
  };
}

function rowToRatingBreakdown(row: Record<string, unknown>): CompletedRatingBreakdown | null {
  const breakdown: CompletedRatingBreakdown = {
    story: toNumberOrNull(row.rating_story),
    combat: toNumberOrNull(row.rating_combat),
    art: toNumberOrNull(row.rating_art),
    pacing: toNumberOrNull(row.rating_pacing)
  };
  return hasAnyCategoryRating(breakdown) ? breakdown : null;
}

function rowToListItem(row: Record<string, unknown>): CompletedGameListItem {
  return {
    id: String(row.id),
    title: String(row.title),
    normalizedTitle: String(row.normalized_title),
    userPlatform: String(row.user_platform ?? ""),
    ratingRaw: nullable(row.rating_raw),
    ratingScore: toNumberOrNull(row.rating_score),
    ratingBreakdown: rowToRatingBreakdown(row),
    notes: nullable(row.notes),
    completionDate: nullable(row.completion_date),
    completionMonth: nullable(row.completion_month),
    completionYear: toNumberOrNull(row.completion_year),
    completionPrecision: row.completion_precision as CompletedGameListItem["completionPrecision"],
    developer: nullable(row.developer),
    publisher: nullable(row.publisher),
    genres: parseJson(row.genres_json, []),
    igdbGenres: parseJson(row.igdb_genres_json, []),
    platforms: parseJson(row.platforms_json, []),
    coverImageId: nullable(row.cover_image_id),
    igdbId: toNumberOrNull(row.igdb_id),
    matchStatus: row.match_status as CompletedGameListItem["matchStatus"]
  };
}

function rowToDetail(row: Record<string, unknown>): CompletedGameDetail {
  return {
    ...rowToListItem(row),
    notes: nullable(row.notes),
    verdict: nullable(row.verdict),
    favouriteShot: nullable(row.favourite_shot),
    favouriteCaption: nullable(row.favourite_caption),
    replay: (nullable(row.replay) as CompletedGameDetail["replay"]) ?? null,
    extra: parseJson(row.extra_json, {}),
    igdbReleaseDate: nullable(row.igdb_release_date),
    igdbDeveloper: nullable(row.igdb_developer),
    igdbPublisher: nullable(row.igdb_publisher),
    igdbPlatforms: parseJson(row.igdb_platforms_json, []),
    igdbThemes: parseJson(row.igdb_themes_json, []),
    igdbGameModes: parseJson(row.igdb_game_modes_json, []),
    igdbRating: toNumberOrNull(row.igdb_rating),
    igdbAggregatedRating: toNumberOrNull(row.igdb_aggregated_rating),
    igdbTotalRating: toNumberOrNull(row.igdb_total_rating),
    summary: nullable(row.summary),
    screenshots: parseJson(row.screenshots_json, []),
    lastSyncedAt: nullable(row.last_synced_at)
  };
}
