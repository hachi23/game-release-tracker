import sqlite3InitModule, { type Database as WasmDb, type Sqlite3Static } from "@sqlite.org/sqlite-wasm";
import type { TrackerDatabase } from "../../backend/src/database/db";

// The part of better-sqlite3's interface the backend uses, on top of the official SQLite WASM build
// (which, unlike sql.js, includes FTS5). Statements run synchronously, as they do on the desktop, so
// backend stores and actions run unchanged. The database lives in memory; libraryFile.ts saves its
// bytes (export()) after each committed write and loads them at start.

type Params = unknown[];

export interface WasmDatabase {
  readonly name: string;
  readonly memory: boolean;
  readonly inTransaction: boolean;
  exec(sql: string): WasmDatabase;
  prepare(sql: string): WasmStatement;
  pragma(source: string, options?: { simple?: boolean }): unknown;
  transaction<F extends (...args: never[]) => unknown>(fn: F): F;
  export(): Uint8Array;
  close(): void;
}

interface WasmStatement {
  get(...params: Params): unknown;
  all(...params: Params): unknown[];
  run(...params: Params): { changes: number; lastInsertRowid: number | bigint };
}

let sqlite3: Promise<Sqlite3Static> | null = null;
export const loadSqlite = () => (sqlite3 ??= sqlite3InitModule());

// Opens an in-memory database, from a saved library's bytes when given. onCommit runs after every write
// that is committed (a statement outside a transaction, or the outermost transaction's commit).
export async function openWasmDatabase(bytes?: Uint8Array, onCommit: () => void = () => undefined): Promise<WasmDatabase> {
  const s = await loadSqlite();
  const db = new s.oo1.DB(":memory:");
  if (bytes?.byteLength) {
    const pointer = s.wasm.allocFromTypedArray(rollbackJournalHeader(bytes));
    const flags = s.capi.SQLITE_DESERIALIZE_FREEONCLOSE | s.capi.SQLITE_DESERIALIZE_RESIZEABLE;
    db.checkRc(s.capi.sqlite3_deserialize(db.pointer!, "main", pointer, bytes.byteLength, bytes.byteLength, flags));
  }
  return wrapDatabase(s, db, onCommit);
}

// The desktop database runs in WAL mode (header bytes 18 and 19 are 2). An in-memory copy can't use WAL,
// so a copy of such a file is opened in the default rollback-journal mode (1) instead. The content is
// unchanged; only the copy's header differs. (Changes still in a separate -wal file are not in the .db.)
export function rollbackJournalHeader(bytes: Uint8Array) {
  if (bytes.length < 20 || (bytes[18] !== 2 && bytes[19] !== 2)) return bytes;
  const copy = bytes.slice();
  copy[18] = 1;
  copy[19] = 1;
  return copy;
}

// Cache extracted named parameter tokens per SQL string so queries never compile RegExps in hot loops.
const NAMED_PARAM_RE = /([@:$])([A-Za-z_][A-Za-z0-9_]*)\b/g;
const sqlParamCache = new Map<string, Array<{ prefix: string; key: string; token: string }>>();

function namedParamsFor(sql: string) {
  let cached = sqlParamCache.get(sql);
  if (cached) return cached;
  const seen = new Set<string>();
  cached = [];
  for (const match of sql.matchAll(NAMED_PARAM_RE)) {
    const token = match[0];
    if (seen.has(token)) continue;
    seen.add(token);
    cached.push({ prefix: match[1], key: match[2], token });
  }
  if (sqlParamCache.size > 256) sqlParamCache.clear();
  sqlParamCache.set(sql, cached);
  return cached;
}

// Converts better-sqlite3 arguments to a sqlite-wasm binding. better-sqlite3 takes positional values
// (spread or in arrays) or one object of named values keyed without the @ / : / $ prefix.
function binding(sql: string, params: Params): unknown[] | Record<string, unknown> | undefined {
  if (params.length === 1 && isNamedObject(params[0])) {
    const obj = params[0];
    const named: Record<string, unknown> = {};
    let count = 0;
    for (const { key, token } of namedParamsFor(sql)) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        named[token] = bindValue(obj[key]);
        count += 1;
      }
    }
    // better-sqlite3 ignores named values the statement doesn't use; sqlite-wasm refuses to bind none.
    return count > 0 ? named : undefined;
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

function wrapDatabase(s: Sqlite3Static, db: WasmDb, onCommit: () => void): WasmDatabase {
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
    // No file name: migrations skip the desktop's on-disk backup copy.
    name: "",
    memory: true,
    get inTransaction() {
      return depth > 0;
    },
    exec(sql) {
      db.exec(sql);
      if (depth === 0) onCommit();
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
          if (depth === 0) onCommit();
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
          if (depth === 0) onCommit();
          return result;
        } catch (error) {
          depth -= 1;
          db.exec(depth === 0 ? "rollback" : `rollback to ${savepoint}; release ${savepoint}`);
          throw error;
        }
      }) as typeof fn;
    },
    export() {
      return s.capi.sqlite3_js_db_export(db);
    },
    close() {
      db.close();
    }
  };
  return wrapped;
}

// The backend types its handle as better-sqlite3's; the adapter covers the part it calls.
export const asTrackerDatabase = (db: WasmDatabase) => db as unknown as TrackerDatabase;
