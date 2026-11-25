import type { TrackerDatabase } from "../../backend/src/database/db";
import { prepareMobileDatabase } from "./mobileApiClient";
import { asTrackerDatabase, openWasmDatabase } from "./wasmDatabase";

// Bringing the desktop app's library onto the phone: the user picks the desktop's
// game-release-tracker.db. It is checked and upgraded to the current schema in a scratch database first,
// so a file that isn't a Game Release Tracker library (or one from a newer app version) changes nothing.

export interface PreparedLibrary {
  bytes: Uint8Array;
  upcoming: number;
  completed: number;
  // The desktop encrypts saved keys with a key only it has; on the phone they must be entered again.
  keysNeedReentering: boolean;
}

const SQLITE_HEADER = "SQLite format 3\u0000";

export class LibraryImportError extends Error {}

export async function prepareLibraryImport(file: Uint8Array): Promise<PreparedLibrary> {
  const header = new TextDecoder().decode(file.subarray(0, 16));
  if (header !== SQLITE_HEADER) throw new LibraryImportError("That file isn't a Game Release Tracker library. Pick game-release-tracker.db from the desktop app's data folder.");

  const scratch = await openWasmDatabase(file);
  try {
    const db: TrackerDatabase = asTrackerDatabase(scratch);
    const tables = new Set((scratch.prepare("select name from sqlite_master where type = 'table'").all() as Array<{ name: string }>).map(row => row.name));
    if (!tables.has("schema_version") || !tables.has("releases") || !tables.has("completed_games")) {
      throw new LibraryImportError("That file isn't a Game Release Tracker library. Pick game-release-tracker.db from the desktop app's data folder.");
    }
    try {
      prepareMobileDatabase(db);
    } catch (error) {
      throw new LibraryImportError(error instanceof Error ? error.message : String(error));
    }
    const count = (sql: string) => Number((scratch.prepare(sql).get() as { n: number }).n);
    return {
      bytes: scratch.export(),
      upcoming: count("select count(*) n from releases where coalesce(eligible, 0) = 1"),
      completed: count("select count(*) n from completed_games"),
      keysNeedReentering: count("select count(*) n from settings where value like 'enc:v1:%'") > 0
    };
  } finally {
    scratch.close();
  }
}
