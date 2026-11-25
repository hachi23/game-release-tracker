import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

export type TrackerDatabase = Database.Database;

export function openDatabase(path: string): TrackerDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  // Cap SQLite's page cache at ~2 MB and keep temp sort tables on disk for low-RAM systems.
  db.pragma("cache_size = -2000");
  db.pragma("temp_store = FILE");
  return db;
}
