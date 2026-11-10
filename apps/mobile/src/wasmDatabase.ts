import sqlite3InitModule, { type Database as WasmDb, type Sqlite3Static } from "@sqlite.org/sqlite-wasm";
import type { TrackerDatabase } from "../../backend/src/database/db";

// The part of better-sqlite3's interface the backend uses, on top of the official SQLite WASM build
// (which, unlike sql.js, includes FTS5). Statements run synchronously, as they do on the desktop, so
// backend stores and actions run unchanged.

type Params = unknown[];

export interface WasmDatabase {
  readonly name: string;
  readonly memory: boolean;
  readonly inTransaction: boolean;
  exec(sql: string): WasmDatabase;
  prepare(sql: string): WasmStatement;
  pragma(source: string, options?: { simple?: boolean }): unknown;
  transaction<F extends (...args: never[]) => unknown>(fn: F): F;
  close(): void;
}

interface WasmStatement {
  get(...params: Params): unknown;
  all(...params: Params): unknown[];
  run(...params: Params): { changes: number; lastInsertRowid: number | bigint };
}

let sqlite3: Promise<Sqlite3Static> | null = null;
export const loadSqlite = () => (sqlite3 ??= sqlite3InitModule());

// "local" keeps the library in the WebView's localStorage (kvvfs), which survives restarts; ":memory:" is for tests.
export async function openWasmDatabase(storage: "local" | ":memory:"): Promise<WasmDatabase> {
  const s = await loadSqlite();
  const JsStorageDb = (s.oo1 as { JsStorageDb?: new (name: string) => WasmDb }).JsStorageDb;
  const db = storage === "local" && JsStorageDb ? new JsStorageDb("local") : new s.oo1.DB(":memory:");
  return wrapDatabase(s, db, storage === "local" && Boolean(JsStorageDb));
}

// Converts better-sqlite3 arguments to a sqlite-wasm binding. better-sqlite3 takes positional values
// (spread or in arrays) or one object of named values keyed without the @ / : / $ prefix.
function binding(sql: string, params: Params): unknown[] | Record<string, unknown> | undefined {
  if (params.length === 1 && isNamedObject(params[0])) {
    const named: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params[0])) {
      for (const prefix of ["@", ":", "$"]) {
        if (new RegExp(`\\${prefix}${key}\\b`).test(sql)) named[prefix + key] = bindValue(value);
      }
    }
    // better-sqlite3 ignores named values the statement doesn't use; sqlite-wasm refuses to bind none.
    return Object.keys(named).length ? named : undefined;
  }
  const flat = params.flat().map(bindValue);
  return flat.length ? flat : undefined;
}

function isNamedObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
}

function bindValue(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function wrapDatabase(s: Sqlite3Static, db: WasmDb, persistent: boolean): WasmDatabase {
  let depth = 0;

  const withStatement = <T>(sql: string, params: Params, use: (stmt: ReturnType<WasmDb["prepare"]>) => T): T => {
    const stmt = db.prepare(sql);
    try {
      const bound = binding(sql, params);
      if (bound !== undefined) stmt.bind(bound as never);
      return use(stmt);
    } finally {
      stmt.finalize();
    }
  };

  const wrapped: WasmDatabase = {
    name: persistent ? "local" : "",
    memory: !persistent,
    get inTransaction() {
      return depth > 0;
    },
    exec(sql) {
      db.exec(sql);
      return wrapped;
    },
    prepare(sql) {
      return {
        get: (...params) => withStatement(sql, params, stmt => (stmt.step() ? stmt.get({}) : undefined)),
        all: (...params) => withStatement(sql, params, stmt => {
          const rows: unknown[] = [];
          while (stmt.step()) rows.push(stmt.get({}));
          return rows;
        }),
        run: (...params) => withStatement(sql, params, stmt => {
          stmt.step();
          return {
            changes: db.changes(),
            lastInsertRowid: Number(s.capi.sqlite3_last_insert_rowid(db))
          };
        })
      };
    },
    pragma(source, options) {
      // WAL and busy timeouts mean nothing for a single in-page connection.
      if (/^\s*(journal_mode|busy_timeout)\b/i.test(source)) return options?.simple ? undefined : [];
      const rows = wrapped.prepare(`pragma ${source}`).all() as Record<string, unknown>[];
      return options?.simple ? (rows[0] ? Object.values(rows[0])[0] : undefined) : rows;
    },
    // Nested transactions become savepoints, as in better-sqlite3.
    transaction(fn) {
      return ((...args: never[]) => {
        const savepoint = `tx${depth}`;
        db.exec(depth === 0 ? "begin" : `savepoint ${savepoint}`);
        depth += 1;
        try {
          const result = fn(...args);
          depth -= 1;
          db.exec(depth === 0 ? "commit" : `release ${savepoint}`);
          return result;
        } catch (error) {
          depth -= 1;
          db.exec(depth === 0 ? "rollback" : `rollback to ${savepoint}; release ${savepoint}`);
          throw error;
        }
      }) as typeof fn;
    },
    close() {
      db.close();
    }
  };
  return wrapped;
}

// The backend types its handle as better-sqlite3's; the adapter covers the part it calls.
export const asTrackerDatabase = (db: WasmDatabase) => db as unknown as TrackerDatabase;
