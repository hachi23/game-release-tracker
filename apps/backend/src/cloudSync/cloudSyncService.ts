import type { CloudSyncConfigPatch, CloudSyncRunResult, CloudSyncStatus } from "../../../../shared/types";
import type { TrackerDatabase } from "../database/db";
import { runWrite } from "../database/writeQueue";
import { fetchWithTimeout } from "../igdb/token";
import { createCloudSyncStore } from "./cloudSyncStore";
import { CLOUD_SYNC_FILENAME, mergeAndApplySnapshot, parseRemoteSnapshot, type CloudSyncSnapshot } from "./gistSnapshot";

const GIST_API_BASE = "https://api.github.com/gists";
const GIST_DESCRIPTION = "Game Release Tracker — Cloud Sync Library";
const CLOUD_SYNC_TIMEOUT_MS = 15_000;
const activeCloudSyncByDb = new WeakMap<TrackerDatabase, Promise<CloudSyncRunResult>>();

export type CloudSyncFetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface GitHubGistFile {
  filename?: string;
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

interface GitHubGist {
  id: string;
  files?: Record<string, GitHubGistFile>;
}

function githubHeaders(token: string, json = false): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Game-Release-Tracker",
    ...(json ? { "Content-Type": "application/json" } : {})
  };
}

async function readGitHubError(response: Response): Promise<string> {
  if (response.status === 401) return "GitHub rejected the token (401). Check that your Personal Access Token is valid.";
  if (response.status === 403) return "GitHub denied access (403). Make sure your token has the 'gist' permission.";
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed.message) return `GitHub error (${response.status}): ${parsed.message}`;
  } catch {
    // ignore
  }
  return `GitHub error (${response.status} ${response.statusText})`.trim();
}

export function createCloudSyncService(
  db: TrackerDatabase,
  fetcher: CloudSyncFetcher = (url, init) => globalThis.fetch(url, init)
) {
  const store = createCloudSyncStore(db);

  const requestGitHub = (url: string, init: RequestInit) =>
    fetchWithTimeout(
      fetcher as typeof fetch,
      url,
      init,
      CLOUD_SYNC_TIMEOUT_MS,
      `GitHub cloud sync timed out after ${CLOUD_SYNC_TIMEOUT_MS} ms`
    );

  const findExistingGist = async (token: string): Promise<string | null> => {
    const response = await requestGitHub(`${GIST_API_BASE}?per_page=100`, {
      method: "GET",
      headers: githubHeaders(token)
    });
    if (!response.ok) throw new Error(await readGitHubError(response));
    const gists = (await response.json()) as GitHubGist[];
    const match = gists.find(gist => Boolean(gist.files && Object.prototype.hasOwnProperty.call(gist.files, CLOUD_SYNC_FILENAME)));
    return match?.id ?? null;
  };

  const fetchRemoteGist = async (token: string, gistId: string): Promise<{ exists: boolean; snapshot: CloudSyncSnapshot | null }> => {
    const response = await requestGitHub(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`, {
      method: "GET",
      headers: githubHeaders(token)
    });
    if (response.status === 404) return { exists: false, snapshot: null };
    if (!response.ok) throw new Error(await readGitHubError(response));
    const gist = (await response.json()) as GitHubGist;
    const file = gist.files?.[CLOUD_SYNC_FILENAME];
    if (!file) return { exists: true, snapshot: null };
    let content = file.content ?? "";
    if (file.truncated && file.raw_url) {
      const rawRes = await requestGitHub(file.raw_url, { method: "GET", headers: githubHeaders(token) });
      if (!rawRes.ok) throw new Error(await readGitHubError(rawRes));
      content = await rawRes.text();
    }
    return { exists: true, snapshot: parseRemoteSnapshot(content) };
  };

  const pushSnapshot = async (token: string, gistId: string | null, snapshot: CloudSyncSnapshot): Promise<string> => {
    const payload = {
      description: GIST_DESCRIPTION,
      ...(gistId ? {} : { public: false }),
      files: {
        [CLOUD_SYNC_FILENAME]: {
          content: JSON.stringify(snapshot)
        }
      }
    };
    const url = gistId ? `${GIST_API_BASE}/${encodeURIComponent(gistId)}` : GIST_API_BASE;
    const response = await requestGitHub(url, {
      method: gistId ? "PATCH" : "POST",
      headers: githubHeaders(token, true),
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(await readGitHubError(response));
    const saved = (await response.json()) as GitHubGist;
    return saved.id;
  };

  const runSyncOnce = async (): Promise<CloudSyncRunResult> => {
    const token = store.getToken();
    if (!token) {
      const error = "Add a GitHub Personal Access Token (with gist permission) first.";
      return { ok: false, status: store.recordRunError(error), error };
    }

    try {
      let gistId = store.getStatus().gistId;
      if (!gistId) {
        gistId = await findExistingGist(token);
      }

      let remoteSnapshot: CloudSyncSnapshot | null = null;
      if (gistId) {
        const remote = await fetchRemoteGist(token, gistId);
        if (!remote.exists) {
          gistId = null;
          store.setGistId(null);
        } else {
          remoteSnapshot = remote.snapshot;
        }
      }

      const merged = await runWrite(db, () => {
        const result = mergeAndApplySnapshot(db, remoteSnapshot, store.getTombstones());
        store.saveTombstones(result.tombstones);
        return result;
      });

      const finalGistId = await pushSnapshot(token, gistId, merged.snapshot);
      const status = await runWrite(db, () => store.recordRunSuccess(finalGistId, merged.summary));
      return { ok: true, status, summary: merged.summary };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = await runWrite(db, () => store.recordRunError(message));
      return { ok: false, status, error: message };
    }
  };

  return {
    getStatus(): CloudSyncStatus {
      return store.getStatus();
    },

    saveConfig(patch: CloudSyncConfigPatch): CloudSyncStatus {
      return store.saveConfig(patch);
    },

    clearConfig(): CloudSyncStatus {
      return store.clearConfig();
    },

    // Serialized per database so startup auto-sync and manual tap never race or overwrite tombstones.
    syncNow(): Promise<CloudSyncRunResult> {
      const inFlight = activeCloudSyncByDb.get(db);
      if (inFlight) return inFlight;
      const run = runSyncOnce().finally(() => {
        if (activeCloudSyncByDb.get(db) === run) activeCloudSyncByDb.delete(db);
      });
      activeCloudSyncByDb.set(db, run);
      return run;
    }
  };
}
