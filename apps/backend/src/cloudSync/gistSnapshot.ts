import type {
  CloudSyncSummary,
  DatePrecision,
  GameTrailer,
  PlatformFamily,
  ReleaseArtwork,
  ReleaseCategory,
  ReleaseOverride,
  TrackedPublisher
} from "../../../../shared/types";
import { completedGameId } from "../completed/completedIdentity";
import type { TrackerDatabase } from "../database/db";
import { createReleaseStore } from "../database/releaseStore";
import { nullable, parseJson, toNumberOrNull } from "../database/rowHelpers";
import { createSyncSettingsStore } from "../sync/syncSettingsStore";
import { pruneTombstones, type CloudSyncTombstones } from "./cloudSyncStore";

export const CLOUD_SYNC_SCHEMA_VERSION = 1;
export const CLOUD_SYNC_FILENAME = "grt-library-sync.json";

export interface SyncedCompletedGame {
  id: string;
  title: string;
  normalizedTitle: string;
  userPlatform: string;
  identityKey: string;
  developer: string | null;
  publisher: string | null;
  genresJson: string;
  platformsJson: string;
  ratingRaw: string | null;
  ratingScore: number | null;
  ratingStory: number | null;
  ratingCombat: number | null;
  ratingArt: number | null;
  ratingPacing: number | null;
  completionDate: string | null;
  completionMonth: string | null;
  completionYear: number | null;
  completionPrecision: string;
  notes: string | null;
  verdict: string | null;
  favouriteShot: string | null;
  favouriteCaption: string | null;
  replay: string | null;
  extraJson: string;
  sourceType: string;
  igdbId: number | null;
  coverImageId: string | null;
  igdbReleaseDate: string | null;
  igdbDeveloper: string | null;
  igdbPublisher: string | null;
  igdbGenresJson: string;
  igdbPlatformsJson: string;
  igdbThemesJson: string;
  igdbGameModesJson: string;
  igdbRating: number | null;
  igdbAggregatedRating: number | null;
  igdbTotalRating: number | null;
  igdbTotalRatingCount: number | null;
  summary: string | null;
  screenshotsJson: string;
  matchStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncedRelease {
  id: string;
  igdbId: number | null;
  title: string;
  normalizedTitle: string;
  dateText: string;
  releaseDate: string | null;
  datePrecision: DatePrecision;
  releaseWindow: string | null;
  category: ReleaseCategory;
  sourceConfidence: number;
  igdbUrl: string | null;
  publishers: string[];
  developers: string[];
  platforms: string[];
  genres: string[];
  artworks: ReleaseArtwork[];
  screenshots: ReleaseArtwork[];
  trailers: GameTrailer[];
  overrides: ReleaseOverride[];
  updatedAt: string;
}

export interface SyncedUserReleaseState {
  releaseId: string;
  igdbId: number | null;
  hidden: boolean;
  released: boolean;
  watched: boolean;
  updatedAt: string;
}

export interface SyncedBlockedRelease {
  id: string;
  igdbId: number | null;
  normalizedTitle: string;
  title: string;
  reason: string | null;
  createdAt: string;
}

export interface SyncedSyncSettings {
  publishers: TrackedPublisher[];
  platforms: PlatformFamily[];
  trackFrom: string;
  autoSync: boolean;
  alerts: boolean;
  updatedAt: string;
}

export interface SyncedYearInReviewSetting {
  year: number;
  gotyIdentityKey: string | null;
  musicVideoId: string | null;
  updatedAt: string;
}

export interface CloudSyncSnapshot {
  version: number;
  exportedAt: string;
  completedGames: SyncedCompletedGame[];
  releases: SyncedRelease[];
  userReleaseState: SyncedUserReleaseState[];
  blockedReleases: SyncedBlockedRelease[];
  syncSettings: SyncedSyncSettings;
  yearInReviewSettings: SyncedYearInReviewSetting[];
  tombstones: CloudSyncTombstones;
}

// SQLite current_timestamp returns "YYYY-MM-DD HH:MM:SS" (UTC). Normalize to ISO-8601 UTC ms.
export function parseTimestampMs(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value !== "string" || !value.trim()) return 0;
  const trimmed = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z`
    : trimmed;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dbNowMs(db: TrackerDatabase): number {
  const row = db.prepare("select strftime('%Y-%m-%dT%H:%M:%fZ', 'now') now").get() as { now?: string } | undefined;
  const parsed = row?.now ? Date.parse(row.now) : Number.NaN;
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function toIsoTimestamp(value: unknown): string {
  const ms = parseTimestampMs(value as string | number | null | undefined);
  return ms > 0 ? new Date(ms).toISOString() : new Date(0).toISOString();
}

export function exportLocalSnapshot(db: TrackerDatabase, tombstones: CloudSyncTombstones): CloudSyncSnapshot {
  const completedRows = db.prepare(`
    select * from completed_games
    where id not like 'demo-%'
    order by identity_key
  `).all() as Array<Record<string, unknown>>;

  const completedGames: SyncedCompletedGame[] = completedRows.map(row => ({
    id: String(row.id),
    title: String(row.title),
    normalizedTitle: String(row.normalized_title),
    userPlatform: String(row.user_platform ?? ""),
    identityKey: String(row.identity_key),
    developer: nullable(row.developer),
    publisher: nullable(row.publisher),
    genresJson: String(row.genres_json ?? "[]"),
    platformsJson: String(row.platforms_json ?? "[]"),
    ratingRaw: nullable(row.rating_raw),
    ratingScore: toNumberOrNull(row.rating_score),
    ratingStory: toNumberOrNull(row.rating_story),
    ratingCombat: toNumberOrNull(row.rating_combat),
    ratingArt: toNumberOrNull(row.rating_art),
    ratingPacing: toNumberOrNull(row.rating_pacing),
    completionDate: nullable(row.completion_date),
    completionMonth: nullable(row.completion_month),
    completionYear: toNumberOrNull(row.completion_year),
    completionPrecision: String(row.completion_precision ?? "none"),
    notes: nullable(row.notes),
    verdict: nullable(row.verdict),
    favouriteShot: nullable(row.favourite_shot),
    favouriteCaption: nullable(row.favourite_caption),
    replay: nullable(row.replay),
    extraJson: String(row.extra_json ?? "{}"),
    sourceType: String(row.source_type ?? "manual"),
    igdbId: toNumberOrNull(row.igdb_id),
    coverImageId: nullable(row.cover_image_id),
    igdbReleaseDate: nullable(row.igdb_release_date),
    igdbDeveloper: nullable(row.igdb_developer),
    igdbPublisher: nullable(row.igdb_publisher),
    igdbGenresJson: String(row.igdb_genres_json ?? "[]"),
    igdbPlatformsJson: String(row.igdb_platforms_json ?? "[]"),
    igdbThemesJson: String(row.igdb_themes_json ?? "[]"),
    igdbGameModesJson: String(row.igdb_game_modes_json ?? "[]"),
    igdbRating: toNumberOrNull(row.igdb_rating),
    igdbAggregatedRating: toNumberOrNull(row.igdb_aggregated_rating),
    igdbTotalRating: toNumberOrNull(row.igdb_total_rating),
    igdbTotalRatingCount: toNumberOrNull(row.igdb_total_rating_count),
    summary: nullable(row.summary),
    screenshotsJson: String(row.screenshots_json ?? "[]"),
    matchStatus: String(row.match_status ?? "unmatched"),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at)
  }));

  const releaseRows = db.prepare(`
    select r.*
    from releases r
    left join user_release_state u on u.release_id = r.id
    where r.id not like 'demo-%'
      and r.id not like 'seed-%'
      and (r.eligible = 1 or coalesce(u.watched, 0) = 1 or r.id not like 'igdb-%')
    order by r.id
  `).all() as Array<Record<string, unknown>>;

  const releaseIds = new Set(releaseRows.map(r => String(r.id)));
  const groupText = (table: string, col: string) => {
    const map = new Map<string, string[]>();
    const rows = db.prepare(`select release_id rid, ${col} val from ${table}`).all() as Array<{ rid: string; val: string }>;
    for (const row of rows) {
      if (!releaseIds.has(row.rid)) continue;
      let list = map.get(row.rid);
      if (!list) { list = []; map.set(row.rid, list); }
      list.push(row.val);
    }
    return map;
  };
  const publishersByRelease = groupText("release_publishers", "publisher");
  const developersByRelease = groupText("release_developers", "developer");
  const platformsByRelease = groupText("release_platforms", "platform");
  const genresByRelease = groupText("release_genres", "genre");

  const artworksByRelease = new Map<string, ReleaseArtwork[]>();
  for (const row of db.prepare("select release_id rid, image_id imageId, source, url from release_artworks order by sort_order, image_id").all() as Array<{ rid: string; imageId: string; source: string; url: string | null }>) {
    if (!releaseIds.has(row.rid) || row.source === "local") continue;
    let list = artworksByRelease.get(row.rid);
    if (!list) { list = []; artworksByRelease.set(row.rid, list); }
    list.push({ imageId: row.imageId, source: row.source as ReleaseArtwork["source"], ...(row.url ? { url: row.url } : {}) });
  }

  const screenshotsByRelease = new Map<string, ReleaseArtwork[]>();
  for (const row of db.prepare("select release_id rid, image_id imageId, source from release_screenshots order by sort_order, image_id").all() as Array<{ rid: string; imageId: string; source: string }>) {
    if (!releaseIds.has(row.rid)) continue;
    let list = screenshotsByRelease.get(row.rid);
    if (!list) { list = []; screenshotsByRelease.set(row.rid, list); }
    list.push({ imageId: row.imageId, source: row.source as ReleaseArtwork["source"] });
  }

  const trailersByRelease = new Map<string, GameTrailer[]>();
  for (const row of db.prepare("select release_id rid, video_id videoId, name, provider from release_trailers order by sort_order, video_id").all() as Array<{ rid: string; videoId: string; name: string | null; provider: string }>) {
    if (!releaseIds.has(row.rid)) continue;
    let list = trailersByRelease.get(row.rid);
    if (!list) { list = []; trailersByRelease.set(row.rid, list); }
    list.push({ videoId: row.videoId, name: row.name, provider: row.provider as GameTrailer["provider"] });
  }

  const overridesByRelease = new Map<string, ReleaseOverride[]>();
  for (const row of db.prepare("select release_id rid, field, value, source_type sourceType, source_url sourceUrl, source_name sourceName, updated_at updatedAt from manual_overrides where source_type = 'user'").all() as Array<{ rid: string; field: string; value: string; sourceType: string; sourceUrl: string | null; sourceName: string | null; updatedAt: string }>) {
    if (!releaseIds.has(row.rid)) continue;
    let list = overridesByRelease.get(row.rid);
    if (!list) { list = []; overridesByRelease.set(row.rid, list); }
    list.push({
      field: row.field,
      value: row.value,
      sourceType: "user",
      ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
      ...(row.sourceName ? { sourceName: row.sourceName } : {}),
      updatedAt: toIsoTimestamp(row.updatedAt)
    });
  }

  const releases: SyncedRelease[] = releaseRows.map(row => {
    const id = String(row.id);
    return {
      id,
      igdbId: toNumberOrNull(row.igdb_id),
      title: String(row.title),
      normalizedTitle: String(row.normalized_title),
      dateText: String(row.date_text ?? "TBA"),
      releaseDate: nullable(row.release_date),
      datePrecision: String(row.date_precision ?? "TBA") as DatePrecision,
      releaseWindow: nullable(row.release_window),
      category: String(row.category ?? "Main") as ReleaseCategory,
      sourceConfidence: Number(row.source_confidence ?? 0),
      igdbUrl: nullable(row.igdb_url),
      publishers: publishersByRelease.get(id) ?? [],
      developers: developersByRelease.get(id) ?? [],
      platforms: platformsByRelease.get(id) ?? [],
      genres: genresByRelease.get(id) ?? [],
      artworks: artworksByRelease.get(id) ?? [],
      screenshots: screenshotsByRelease.get(id) ?? [],
      trailers: trailersByRelease.get(id) ?? [],
      overrides: overridesByRelease.get(id) ?? [],
      updatedAt: toIsoTimestamp(row.updated_at ?? row.created_at)
    };
  });

  const userStateRows = db.prepare(`
    select u.release_id releaseId, r.igdb_id igdbId, u.hidden, u.released, u.watched, u.updated_at updatedAt
    from user_release_state u
    left join releases r on r.id = u.release_id
    where u.release_id not like 'demo-%'
  `).all() as Array<{ releaseId: string; igdbId: number | null; hidden: number; released: number; watched: number; updatedAt: string }>;

  const userReleaseState: SyncedUserReleaseState[] = userStateRows.map(row => ({
    releaseId: row.releaseId,
    igdbId: toNumberOrNull(row.igdbId),
    hidden: Boolean(row.hidden),
    released: Boolean(row.released),
    watched: Boolean(row.watched),
    updatedAt: toIsoTimestamp(row.updatedAt)
  }));

  const blockedRows = db.prepare("select id, igdb_id igdbId, normalized_title normalizedTitle, title, reason, created_at createdAt from blocked_releases").all() as Array<Record<string, unknown>>;
  const blockedReleases: SyncedBlockedRelease[] = blockedRows.map(row => ({
    id: String(row.id),
    igdbId: toNumberOrNull(row.igdbId),
    normalizedTitle: String(row.normalizedTitle),
    title: String(row.title),
    reason: nullable(row.reason),
    createdAt: toIsoTimestamp(row.createdAt)
  }));

  const syncSettingsStore = createSyncSettingsStore(db);
  const currentSync = syncSettingsStore.read();
  const syncSettingUpdatedRow = db.prepare(`
    select max(updated_at) latest from settings
    where key in ('SYNC_PLATFORMS', 'SYNC_TRACK_FROM', 'SYNC_AUTO', 'SYNC_ALERTS')
  `).get() as { latest: string | null } | undefined;

  const syncSettings: SyncedSyncSettings = {
    ...currentSync,
    updatedAt: toIsoTimestamp(syncSettingUpdatedRow?.latest)
  };

  const yirRows = db.prepare(`
    select y.year, c.identity_key gotyIdentityKey, y.music_video_id musicVideoId, y.updated_at updatedAt
    from year_in_review_settings y
    left join completed_games c on c.id = y.goty_completed_id
    order by y.year
  `).all() as Array<{ year: number; gotyIdentityKey: string | null; musicVideoId: string | null; updatedAt: string }>;

  const yearInReviewSettings: SyncedYearInReviewSetting[] = yirRows.map(row => ({
    year: Number(row.year),
    gotyIdentityKey: nullable(row.gotyIdentityKey),
    musicVideoId: nullable(row.musicVideoId),
    updatedAt: toIsoTimestamp(row.updatedAt)
  }));

  return {
    version: CLOUD_SYNC_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    completedGames,
    releases,
    userReleaseState,
    blockedReleases,
    syncSettings,
    yearInReviewSettings,
    tombstones: pruneTombstones(tombstones, dbNowMs(db))
  };
}

function mergeTombstoneMaps(a: Record<string, string>, b: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...a };
  for (const [key, iso] of Object.entries(b)) {
    if (!out[key] || parseTimestampMs(iso) > parseTimestampMs(out[key])) out[key] = iso;
  }
  return out;
}

function allocateFreeCompletedId(db: TrackerDatabase, preferredId: string, title: string, userPlatform: string): string {
  const taken = db.prepare("select 1 from completed_games where id = ?");
  if (preferredId && !taken.get(preferredId)) return preferredId;
  const base = completedGameId(title, userPlatform);
  if (!taken.get(base)) return base;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!taken.get(candidate)) return candidate;
  }
}

export function mergeAndApplySnapshot(
  db: TrackerDatabase,
  remote: CloudSyncSnapshot | null,
  localTombstones: CloudSyncTombstones
): { snapshot: CloudSyncSnapshot; summary: CloudSyncSummary; tombstones: CloudSyncTombstones } {
  const summary: CloudSyncSummary = {
    pulledCompleted: 0,
    pushedCompleted: 0,
    deletedCompleted: 0,
    pulledReleases: 0,
    pushedReleases: 0,
    deletedReleases: 0,
    pulledWatchlist: 0,
    pulledPublishers: 0
  };

  const mergedTombstones = pruneTombstones({
    completed: mergeTombstoneMaps(localTombstones.completed, remote?.tombstones?.completed ?? {}),
    releases: mergeTombstoneMaps(localTombstones.releases, remote?.tombstones?.releases ?? {}),
    publishers: mergeTombstoneMaps(localTombstones.publishers, remote?.tombstones?.publishers ?? {})
  }, dbNowMs(db));

  if (!remote) {
    const snapshot = exportLocalSnapshot(db, mergedTombstones);
    summary.pushedCompleted = snapshot.completedGames.length;
    summary.pushedReleases = snapshot.releases.length;
    return { snapshot, summary, tombstones: mergedTombstones };
  }

  const localBefore = exportLocalSnapshot(db, mergedTombstones);
  const localCompletedByKey = new Map(localBefore.completedGames.map(item => [item.identityKey, item]));
  const remoteCompletedByKey = new Map((remote.completedGames ?? []).map(item => [item.identityKey, item]));

  const releaseStore = createReleaseStore(db);
  const syncSettingsStore = createSyncSettingsStore(db);

  db.transaction(() => {
    // 1. Merge completed games + deletions
    const insertCompleted = db.prepare(`
      insert into completed_games (
        id, title, normalized_title, user_platform, identity_key,
        developer, publisher, genres_json, platforms_json,
        rating_raw, rating_score, rating_story, rating_combat, rating_art, rating_pacing,
        completion_date, completion_month, completion_year, completion_precision,
        notes, verdict, favourite_shot, favourite_caption, replay,
        extra_json, source_row_hash, source_type, missing_from_latest_import,
        igdb_id, cover_image_id, igdb_release_date, igdb_developer, igdb_publisher,
        igdb_genres_json, igdb_platforms_json, igdb_themes_json, igdb_game_modes_json,
        igdb_rating, igdb_aggregated_rating, igdb_total_rating, igdb_total_rating_count,
        summary, screenshots_json, match_status, created_at, updated_at
      ) values (
        @id, @title, @normalizedTitle, @userPlatform, @identityKey,
        @developer, @publisher, @genresJson, @platformsJson,
        @ratingRaw, @ratingScore, @ratingStory, @ratingCombat, @ratingArt, @ratingPacing,
        @completionDate, @completionMonth, @completionYear, @completionPrecision,
        @notes, @verdict, @favouriteShot, @favouriteCaption, @replay,
        @extraJson, '', @sourceType, 0,
        @igdbId, @coverImageId, @igdbReleaseDate, @igdbDeveloper, @igdbPublisher,
        @igdbGenresJson, @igdbPlatformsJson, @igdbThemesJson, @igdbGameModesJson,
        @igdbRating, @igdbAggregatedRating, @igdbTotalRating, @igdbTotalRatingCount,
        @summary, @screenshotsJson, @matchStatus, @createdAt, @updatedAt
      )
    `);
    const updateCompleted = db.prepare(`
      update completed_games set
        title = @title,
        normalized_title = @normalizedTitle,
        user_platform = @userPlatform,
        developer = @developer,
        publisher = @publisher,
        genres_json = @genresJson,
        platforms_json = @platformsJson,
        rating_raw = @ratingRaw,
        rating_score = @ratingScore,
        rating_story = @ratingStory,
        rating_combat = @ratingCombat,
        rating_art = @ratingArt,
        rating_pacing = @ratingPacing,
        completion_date = @completionDate,
        completion_month = @completionMonth,
        completion_year = @completionYear,
        completion_precision = @completionPrecision,
        notes = @notes,
        verdict = @verdict,
        favourite_shot = @favouriteShot,
        favourite_caption = @favouriteCaption,
        replay = @replay,
        extra_json = @extraJson,
        igdb_id = @igdbId,
        cover_image_id = @coverImageId,
        igdb_release_date = @igdbReleaseDate,
        igdb_developer = @igdbDeveloper,
        igdb_publisher = @igdbPublisher,
        igdb_genres_json = @igdbGenresJson,
        igdb_platforms_json = @igdbPlatformsJson,
        igdb_themes_json = @igdbThemesJson,
        igdb_game_modes_json = @igdbGameModesJson,
        igdb_rating = @igdbRating,
        igdb_aggregated_rating = @igdbAggregatedRating,
        igdb_total_rating = @igdbTotalRating,
        igdb_total_rating_count = @igdbTotalRatingCount,
        summary = @summary,
        screenshots_json = @screenshotsJson,
        match_status = @matchStatus,
        updated_at = @updatedAt
      where identity_key = @identityKey
    `);
    const deleteCompletedByKey = db.prepare("delete from completed_games where identity_key = ?");

    const allCompletedKeys = new Set([...localCompletedByKey.keys(), ...remoteCompletedByKey.keys()]);
    for (const key of allCompletedKeys) {
      const localItem = localCompletedByKey.get(key);
      const remoteItem = remoteCompletedByKey.get(key);
      const deletedMs = parseTimestampMs(mergedTombstones.completed[key]);

      const localMs = localItem ? parseTimestampMs(localItem.updatedAt) : -1;
      const remoteMs = remoteItem ? parseTimestampMs(remoteItem.updatedAt) : -1;

      if (deletedMs > 0 && deletedMs >= Math.max(localMs, remoteMs)) {
        if (localItem) {
          deleteCompletedByKey.run(key);
          summary.deletedCompleted += 1;
        }
        continue;
      }

      if (remoteItem && !localItem) {
        const allocatedId = allocateFreeCompletedId(db, remoteItem.id, remoteItem.title, remoteItem.userPlatform);
        insertCompleted.run({ ...remoteItem, id: allocatedId });
        summary.pulledCompleted += 1;
      } else if (localItem && !remoteItem) {
        summary.pushedCompleted += 1;
      } else if (localItem && remoteItem) {
        if (remoteMs > localMs) {
          // Preserve local IGDB enrichment if remote hasn't matched yet.
          const merged: SyncedCompletedGame = {
            ...remoteItem,
            igdbId: remoteItem.igdbId ?? localItem.igdbId,
            coverImageId: remoteItem.coverImageId ?? localItem.coverImageId,
            igdbReleaseDate: remoteItem.igdbReleaseDate ?? localItem.igdbReleaseDate,
            igdbDeveloper: remoteItem.igdbDeveloper ?? localItem.igdbDeveloper,
            igdbPublisher: remoteItem.igdbPublisher ?? localItem.igdbPublisher,
            igdbGenresJson: remoteItem.igdbGenresJson !== "[]" ? remoteItem.igdbGenresJson : localItem.igdbGenresJson,
            igdbPlatformsJson: remoteItem.igdbPlatformsJson !== "[]" ? remoteItem.igdbPlatformsJson : localItem.igdbPlatformsJson,
            igdbThemesJson: remoteItem.igdbThemesJson !== "[]" ? remoteItem.igdbThemesJson : localItem.igdbThemesJson,
            igdbGameModesJson: remoteItem.igdbGameModesJson !== "[]" ? remoteItem.igdbGameModesJson : localItem.igdbGameModesJson,
            igdbRating: remoteItem.igdbRating ?? localItem.igdbRating,
            igdbAggregatedRating: remoteItem.igdbAggregatedRating ?? localItem.igdbAggregatedRating,
            igdbTotalRating: remoteItem.igdbTotalRating ?? localItem.igdbTotalRating,
            igdbTotalRatingCount: remoteItem.igdbTotalRatingCount ?? localItem.igdbTotalRatingCount,
            summary: remoteItem.summary ?? localItem.summary,
            screenshotsJson: remoteItem.screenshotsJson !== "[]" ? remoteItem.screenshotsJson : localItem.screenshotsJson,
            matchStatus: remoteItem.igdbId ? remoteItem.matchStatus : localItem.matchStatus
          };
          updateCompleted.run(merged);
          summary.pulledCompleted += 1;
        } else if (localMs > remoteMs) {
          summary.pushedCompleted += 1;
        }
      }
    }

    // 2. Merge blocked releases (union)
    const insertBlocked = db.prepare(`
      insert or ignore into blocked_releases (id, igdb_id, normalized_title, title, reason, created_at)
      values (@id, @igdbId, @normalizedTitle, @title, @reason, @createdAt)
    `);
    for (const blocked of remote.blockedReleases ?? []) {
      const exists = db.prepare(`
        select 1 from blocked_releases
        where (igdb_id is not null and igdb_id = ?) or normalized_title = ?
        limit 1
      `).get(blocked.igdbId ?? -1, blocked.normalizedTitle);
      if (!exists) insertBlocked.run(blocked);
      // Remove any matching release locally so blocked games disappear everywhere.
      const matching = db.prepare(`
        select id from releases
        where (igdb_id is not null and igdb_id = ?) or normalized_title = ?
      `).all(blocked.igdbId ?? -1, blocked.normalizedTitle) as Array<{ id: string }>;
      for (const row of matching) {
        db.prepare("delete from releases where id = ?").run(row.id);
        summary.deletedReleases += 1;
      }
    }

    // 3. Merge upcoming / custom releases + release deletions
    const localReleaseById = new Map(localBefore.releases.map(r => [r.id, r]));
    const localReleaseByIgdb = new Map(localBefore.releases.filter(r => r.igdbId !== null).map(r => [r.igdbId!, r]));
    const remoteReleaseById = new Map((remote.releases ?? []).map(r => [r.id, r]));

    // Apply remote tombstones to local releases.
    for (const localRel of localBefore.releases) {
      const deletedMs = parseTimestampMs(mergedTombstones.releases[localRel.id]);
      if (deletedMs > 0 && deletedMs >= parseTimestampMs(localRel.updatedAt)) {
        db.prepare("delete from releases where id = ?").run(localRel.id);
        summary.deletedReleases += 1;
      }
    }

    const upsertOverride = db.prepare(`
      insert into manual_overrides (release_id, field, value, source_type, source_url, source_name, updated_at)
      values (?, ?, ?, 'user', ?, ?, ?)
      on conflict(release_id, field, source_type) do update set
        value = excluded.value,
        source_url = excluded.source_url,
        source_name = excluded.source_name,
        updated_at = excluded.updated_at
    `);

    for (const remoteRel of remote.releases ?? []) {
      const deletedMs = parseTimestampMs(mergedTombstones.releases[remoteRel.id]);
      const remoteMs = parseTimestampMs(remoteRel.updatedAt);
      if (deletedMs > 0 && deletedMs >= remoteMs) continue;
      if (remoteRel.igdbId && releaseStore.isBlocked(remoteRel.igdbId, remoteRel.title)) continue;

      const localMatch = localReleaseById.get(remoteRel.id) ?? (remoteRel.igdbId ? localReleaseByIgdb.get(remoteRel.igdbId) : undefined);
      const localMs = localMatch ? parseTimestampMs(localMatch.updatedAt) : -1;

      if (!localMatch || remoteMs > localMs) {
        const targetId = localMatch?.id ?? remoteRel.id;
        releaseStore.save({
          id: targetId,
          ...(remoteRel.igdbId !== null ? { igdbId: remoteRel.igdbId } : {}),
          title: remoteRel.title,
          normalizedTitle: remoteRel.normalizedTitle,
          dateText: remoteRel.dateText,
          releaseDate: remoteRel.releaseDate,
          datePrecision: remoteRel.datePrecision,
          releaseWindow: remoteRel.releaseWindow,
          category: remoteRel.category,
          publishers: remoteRel.publishers,
          developers: remoteRel.developers,
          platforms: remoteRel.platforms,
          genres: remoteRel.genres,
          sourceConfidence: remoteRel.sourceConfidence,
          ...(remoteRel.igdbUrl ? { igdbUrl: remoteRel.igdbUrl } : {}),
          artworks: remoteRel.artworks,
          screenshots: remoteRel.screenshots,
          trailers: remoteRel.trailers
        });
        db.prepare("update releases set updated_at = ? where id = ?").run(remoteRel.updatedAt, targetId);
        for (const ov of remoteRel.overrides ?? []) {
          upsertOverride.run(targetId, ov.field, ov.value, ov.sourceUrl ?? null, ov.sourceName ?? null, ov.updatedAt ?? remoteRel.updatedAt);
        }
        summary.pulledReleases += 1;
      } else if (localMs > remoteMs) {
        summary.pushedReleases += 1;
      }
    }

    for (const localRel of localBefore.releases) {
      if (!remoteReleaseById.has(localRel.id)) {
        const deletedMs = parseTimestampMs(mergedTombstones.releases[localRel.id]);
        if (!(deletedMs > 0 && deletedMs >= parseTimestampMs(localRel.updatedAt))) {
          summary.pushedReleases += 1;
        }
      }
    }

    // 4. Merge user_release_state (watchlist / hidden / released)
    const localStateById = new Map(localBefore.userReleaseState.map(s => [s.releaseId, s]));
    const upsertUserState = db.prepare(`
      insert into user_release_state (release_id, hidden, released, watched, updated_at)
      values (?, ?, ?, ?, ?)
      on conflict(release_id) do update set
        hidden = excluded.hidden,
        released = excluded.released,
        watched = excluded.watched,
        updated_at = excluded.updated_at
    `);
    for (const remoteState of remote.userReleaseState ?? []) {
      let targetId = remoteState.releaseId;
      if (!releaseStore.exists(targetId) && remoteState.igdbId) {
        const mapped = releaseStore.findByIgdbId(remoteState.igdbId);
        if (mapped) targetId = mapped;
      }
      const localState = localStateById.get(targetId);
      const remoteMs = parseTimestampMs(remoteState.updatedAt);
      const localMs = localState ? parseTimestampMs(localState.updatedAt) : -1;
      if (!localState || remoteMs > localMs) {
        upsertUserState.run(
          targetId,
          remoteState.hidden ? 1 : 0,
          remoteState.released ? 1 : 0,
          remoteState.watched ? 1 : 0,
          remoteState.updatedAt
        );
        summary.pulledWatchlist += 1;
      }
    }

    // 5. Merge tracked publishers & sync settings
    if (remote.syncSettings) {
      const localPubs = new Map(localBefore.syncSettings.publishers.map(p => [p.id, p]));
      const addedAtById = new Map(
        (db.prepare("select company_id id, added_at addedAt from tracked_publishers").all() as Array<{ id: number; addedAt: string }>)
          .map(r => [r.id, parseTimestampMs(r.addedAt)])
      );
      // Apply remote publisher removals against local publishers
      for (const pub of localBefore.syncSettings.publishers) {
        const removedMs = parseTimestampMs(mergedTombstones.publishers[String(pub.id)]);
        const addedMs = addedAtById.get(pub.id) ?? 0;
        if (removedMs > 0 && removedMs > addedMs) {
          syncSettingsStore.removePublisher(pub.id);
          localPubs.delete(pub.id);
        }
      }
      // Pull remote publishers not removed by a tombstone
      const toAdd: TrackedPublisher[] = [];
      for (const pub of remote.syncSettings.publishers ?? []) {
        if (localPubs.has(pub.id)) continue;
        const removedMs = parseTimestampMs(mergedTombstones.publishers[String(pub.id)]);
        const remoteUpdatedMs = parseTimestampMs(remote.syncSettings.updatedAt);
        if (removedMs > 0 && removedMs >= remoteUpdatedMs) continue;
        toAdd.push(pub);
      }
      if (toAdd.length > 0) {
        syncSettingsStore.addPublishers(toAdd);
        summary.pulledPublishers += toAdd.length;
      }

      if (parseTimestampMs(remote.syncSettings.updatedAt) > parseTimestampMs(localBefore.syncSettings.updatedAt)) {
        syncSettingsStore.update({
          platforms: remote.syncSettings.platforms,
          trackFrom: remote.syncSettings.trackFrom,
          autoSync: remote.syncSettings.autoSync,
          alerts: remote.syncSettings.alerts
        });
      }
    }

    // 6. Merge Year in Review settings
    const localYirByYear = new Map(localBefore.yearInReviewSettings.map(y => [y.year, y]));
    const findCompletedIdByIdentity = db.prepare("select id from completed_games where identity_key = ?");
    const upsertYir = db.prepare(`
      insert into year_in_review_settings (year, goty_completed_id, music_video_id, updated_at)
      values (?, ?, ?, ?)
      on conflict(year) do update set
        goty_completed_id = excluded.goty_completed_id,
        music_video_id = excluded.music_video_id,
        updated_at = excluded.updated_at
    `);
    for (const remoteYir of remote.yearInReviewSettings ?? []) {
      const localYir = localYirByYear.get(remoteYir.year);
      if (!localYir || parseTimestampMs(remoteYir.updatedAt) > parseTimestampMs(localYir.updatedAt)) {
        const gotyId = remoteYir.gotyIdentityKey
          ? ((findCompletedIdByIdentity.get(remoteYir.gotyIdentityKey) as { id: string } | undefined)?.id ?? null)
          : null;
        upsertYir.run(remoteYir.year, gotyId, remoteYir.musicVideoId, remoteYir.updatedAt);
      }
    }
  })();

  const snapshot = exportLocalSnapshot(db, mergedTombstones);
  return { snapshot, summary, tombstones: mergedTombstones };
}

export function parseRemoteSnapshot(raw: string): CloudSyncSnapshot | null {
  const parsed = parseJson<Record<string, unknown> | null>(raw, null);
  if (!parsed || typeof parsed !== "object" || Number(parsed.version) !== CLOUD_SYNC_SCHEMA_VERSION) return null;
  return parsed as unknown as CloudSyncSnapshot;
}
