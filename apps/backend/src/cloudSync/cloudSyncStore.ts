import type { CloudSyncConfigPatch, CloudSyncState, CloudSyncStatus, CloudSyncSummary } from "../../../../shared/types";
import type { TrackerDatabase } from "../database/db";
import { getProcessCipher, isSealed, type SecretCipher } from "../settings/secretCipher";

const TOKEN_KEY = "CLOUD_SYNC_TOKEN";
const GIST_ID_KEY = "CLOUD_SYNC_GIST_ID";
const AUTO_KEY = "CLOUD_SYNC_AUTO";
const LAST_AT_KEY = "CLOUD_SYNC_LAST_AT";
const LAST_STATUS_KEY = "CLOUD_SYNC_LAST_STATUS";
const LAST_SUMMARY_KEY = "CLOUD_SYNC_LAST_SUMMARY";
const LAST_ERROR_KEY = "CLOUD_SYNC_LAST_ERROR";
const TOMBSTONES_KEY = "CLOUD_SYNC_TOMBSTONES";

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface CloudSyncTombstones {
  completed: Record<string, string>;
  releases: Record<string, string>;
  publishers: Record<string, string>;
}

const emptyTombstones = (): CloudSyncTombstones => ({ completed: {}, releases: {}, publishers: {} });

export function pruneTombstones(tombstones: CloudSyncTombstones, nowMs = Date.now()): CloudSyncTombstones {
  const cutoff = nowMs - TOMBSTONE_TTL_MS;
  const keep = (map: Record<string, string> | undefined) => {
    const out: Record<string, string> = {};
    for (const [k, iso] of Object.entries(map ?? {})) {
      const ts = Date.parse(iso);
      if (!Number.isNaN(ts) && ts >= cutoff) out[k] = iso;
    }
    return out;
  };
  return {
    completed: keep(tombstones.completed),
    releases: keep(tombstones.releases),
    publishers: keep(tombstones.publishers)
  };
}

export function createCloudSyncStore(db: TrackerDatabase, cipher: SecretCipher | undefined = getProcessCipher()) {
  const readRaw = (key: string) => {
    const row = db.prepare("select value from settings where key = ? and coalesce(value, '') != ''").get(key) as { value: string } | undefined;
    return row?.value;
  };
  const writeRaw = (key: string, value: string) => {
    db.prepare("insert or replace into settings (key, value, updated_at) values (?, ?, current_timestamp)").run(key, value);
  };
  const removeKeys = (keys: readonly string[]) => {
    const stmt = db.prepare("delete from settings where key = ?");
    for (const key of keys) stmt.run(key);
  };

  const getToken = () => {
    const raw = readRaw(TOKEN_KEY);
    if (!raw) return undefined;
    if (!isSealed(raw)) return raw;
    return cipher?.decrypt(raw);
  };

  const dbNowIso = () => {
    const row = db.prepare("select strftime('%Y-%m-%dT%H:%M:%fZ', 'now') now").get() as { now?: string } | undefined;
    return row?.now ?? new Date().toISOString();
  };
  const dbNowMs = () => {
    const parsed = Date.parse(dbNowIso());
    return Number.isNaN(parsed) ? Date.now() : parsed;
  };

  const getTombstones = (): CloudSyncTombstones => {
    const raw = readRaw(TOMBSTONES_KEY);
    if (!raw) return emptyTombstones();
    try {
      const parsed = JSON.parse(raw) as Partial<CloudSyncTombstones>;
      return pruneTombstones({
        completed: parsed.completed ?? {},
        releases: parsed.releases ?? {},
        publishers: parsed.publishers ?? {}
      }, dbNowMs());
    } catch {
      return emptyTombstones();
    }
  };

  const saveTombstones = (next: CloudSyncTombstones) => {
    writeRaw(TOMBSTONES_KEY, JSON.stringify(pruneTombstones(next, dbNowMs())));
  };

  const getStatus = (): CloudSyncStatus => {
    const configured = Boolean(getToken());
    const lastStatusRaw = readRaw(LAST_STATUS_KEY);
    const lastStatus: CloudSyncState =
      lastStatusRaw === "syncing" || lastStatusRaw === "success" || lastStatusRaw === "error" ? lastStatusRaw : "idle";
    let lastSummary: CloudSyncSummary | null = null;
    const rawSummary = readRaw(LAST_SUMMARY_KEY);
    if (rawSummary) {
      try {
        lastSummary = JSON.parse(rawSummary) as CloudSyncSummary;
      } catch {
        lastSummary = null;
      }
    }
    return {
      configured,
      gistId: readRaw(GIST_ID_KEY) ?? null,
      autoSync: readRaw(AUTO_KEY) !== "0",
      lastSyncedAt: readRaw(LAST_AT_KEY) ?? null,
      lastStatus,
      lastSummary,
      lastError: readRaw(LAST_ERROR_KEY) ?? null
    };
  };

  return {
    getToken,
    getStatus,
    getTombstones,
    saveTombstones,

    saveConfig(patch: CloudSyncConfigPatch) {
      if (typeof patch.token === "string") {
        const trimmed = patch.token.trim();
        if (trimmed) {
          const stored = cipher ? cipher.encrypt(trimmed) : trimmed;
          writeRaw(TOKEN_KEY, stored);
        }
      }
      if (typeof patch.gistId === "string") {
        const trimmed = patch.gistId.trim();
        if (trimmed) writeRaw(GIST_ID_KEY, trimmed);
        else removeKeys([GIST_ID_KEY]);
      }
      if (typeof patch.autoSync === "boolean") {
        writeRaw(AUTO_KEY, patch.autoSync ? "1" : "0");
      }
      return getStatus();
    },

    clearConfig() {
      removeKeys([TOKEN_KEY, GIST_ID_KEY, AUTO_KEY, LAST_AT_KEY, LAST_STATUS_KEY, LAST_SUMMARY_KEY, LAST_ERROR_KEY]);
      return getStatus();
    },

    setGistId(gistId: string | null) {
      if (gistId) writeRaw(GIST_ID_KEY, gistId);
      else removeKeys([GIST_ID_KEY]);
    },

    recordRunSuccess(gistId: string, summary: CloudSyncSummary, syncedAt = new Date().toISOString()) {
      writeRaw(GIST_ID_KEY, gistId);
      writeRaw(LAST_AT_KEY, syncedAt);
      writeRaw(LAST_STATUS_KEY, "success");
      writeRaw(LAST_SUMMARY_KEY, JSON.stringify(summary));
      removeKeys([LAST_ERROR_KEY]);
      return getStatus();
    },

    recordRunError(message: string) {
      writeRaw(LAST_STATUS_KEY, "error");
      writeRaw(LAST_ERROR_KEY, message);
      return getStatus();
    },

    recordCompletedDeletion(identityKey: string, when = dbNowIso()) {
      const current = getTombstones();
      current.completed[identityKey] = when;
      saveTombstones(current);
    },

    recordReleaseDeletion(releaseId: string, when = dbNowIso()) {
      const current = getTombstones();
      current.releases[releaseId] = when;
      saveTombstones(current);
    },

    recordPublisherRemoval(companyId: number, when = dbNowIso()) {
      const current = getTombstones();
      current.publishers[String(companyId)] = when;
      saveTombstones(current);
    },

    clearCompletedDeletion(identityKey: string) {
      const current = getTombstones();
      if (identityKey in current.completed) {
        delete current.completed[identityKey];
        saveTombstones(current);
      }
    },

    clearPublisherRemoval(companyId: number) {
      const current = getTombstones();
      const key = String(companyId);
      if (key in current.publishers) {
        delete current.publishers[key];
        saveTombstones(current);
      }
    }
  };
}

export function recordCompletedTombstone(db: TrackerDatabase, identityKey: string) {
  try {
    createCloudSyncStore(db).recordCompletedDeletion(identityKey);
  } catch {
    // Non-fatal in minimal test databases without settings table.
  }
}

export function recordReleaseTombstone(db: TrackerDatabase, releaseId: string) {
  try {
    createCloudSyncStore(db).recordReleaseDeletion(releaseId);
  } catch {
    // Non-fatal in minimal test databases without settings table.
  }
}

export function recordPublisherTombstone(db: TrackerDatabase, companyId: number) {
  try {
    createCloudSyncStore(db).recordPublisherRemoval(companyId);
  } catch {
    // Non-fatal in minimal test databases without settings table.
  }
}
