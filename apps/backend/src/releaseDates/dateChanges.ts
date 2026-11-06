import type { DateChangeKind, DatePrecision, ReleaseDateChange } from "../../../../shared/types";
import type { TrackerDatabase } from "../database/db";

// A release's date as stored: its words, its day (if known), how exact it is and the date it sorts by
// (the end of a vague period, per ADR 0005).
export interface DateSnapshot {
  dateText: string;
  releaseDate: string | null;
  datePrecision: DatePrecision;
  sortDate: string | null;
}

const PRECISION_RANK: Record<DatePrecision, number> = { TBA: 0, Year: 1, Window: 2, Month: 3, Exact: 4 };

// What a date change means for the person waiting for the game, or null when nothing a reader would call
// a change happened (the same date reworded). A later date is a delay; a sharper date inside the old
// period ("2027" becoming "Mar 14, 2027") is the date being announced; anything earlier moved the game up.
export function classifyDateChange(before: DateSnapshot, after: DateSnapshot): DateChangeKind | null {
  if (before.dateText === after.dateText && before.releaseDate === after.releaseDate) return null;
  if (!before.sortDate) return after.sortDate ? "announced" : null;
  if (!after.sortDate) return "delayed";
  if (after.sortDate > before.sortDate) return "delayed";
  const sharper = PRECISION_RANK[after.datePrecision] > PRECISION_RANK[before.datePrecision];
  if (sharper && after.sortDate >= periodStart(before)) return "announced";
  if (after.sortDate < before.sortDate) return "earlier";
  return null;
}

// The first day the old, vaguer date could have meant.
function periodStart({ datePrecision, sortDate }: DateSnapshot) {
  const date = sortDate!;
  if (datePrecision === "Year") return `${date.slice(0, 4)}-01-01`;
  if (datePrecision === "Month") return `${date.slice(0, 7)}-01`;
  if (datePrecision === "Window") {
    // A quarter or season: the three months ending in the sort month.
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7)) - 2;
    const start = month < 1 ? { year: year - 1, month: month + 12 } : { year, month };
    return `${start.year}-${String(start.month).padStart(2, "0")}-01`;
  }
  return date;
}

export function readDateSnapshot(db: TrackerDatabase, releaseId: string): DateSnapshot | null {
  const row = db.prepare(`
    select date_text dateText, release_date releaseDate, date_precision datePrecision, effective_sort_date sortDate
    from releases where id = ?
  `).get(releaseId) as DateSnapshot | undefined;
  return row ?? null;
}

// Records the change between two snapshots, if it is one. Returns the kind recorded.
export function recordDateChange(db: TrackerDatabase, releaseId: string, before: DateSnapshot, after: DateSnapshot, syncRunId: number | null): DateChangeKind | null {
  const kind = classifyDateChange(before, after);
  if (!kind) return null;
  db.prepare(`
    insert into release_date_changes (release_id, kind, from_text, to_text, from_sort_date, to_sort_date, sync_run_id)
    values (?, ?, ?, ?, ?, ?, ?)
  `).run(releaseId, kind, before.dateText, after.dateText, before.sortDate, after.sortDate, syncRunId);
  return kind;
}

const changeColumns = "kind, from_text fromText, to_text toText, changed_at changedAt";

// Every recorded change for one release, newest first (its detail page).
export function listDateChanges(db: TrackerDatabase, releaseId: string): ReleaseDateChange[] {
  return db.prepare(`select ${changeColumns} from release_date_changes where release_id = ? order by id desc`).all(releaseId) as ReleaseDateChange[];
}

// The newest change of each listed release, in one query (the list's "Delayed from" badge).
export function latestDateChanges(db: TrackerDatabase, idsJson: string): Map<string, ReleaseDateChange> {
  const rows = db.prepare(`
    select release_id releaseId, ${changeColumns} from release_date_changes
    where id in (
      select max(id) from release_date_changes
      where release_id in (select value from json_each(?))
      group by release_id
    )
  `).all(idsJson) as Array<ReleaseDateChange & { releaseId: string }>;
  return new Map(rows.map(({ releaseId, ...change }) => [releaseId, change]));
}
