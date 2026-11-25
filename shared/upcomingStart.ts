import type { ReleaseListItem } from "./types";

// Shared pure module for both Desktop and Android Upcoming views:
// determines whether a release is still upcoming (today or later) across all 5 date precisions,
// and finds the month group + release that Upcoming should open to instead of starting from January.

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function localTodayIso(today: Date) {
  return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
}

function localTodayYearMonth(today: Date) {
  return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
}

function extractIsoDate(value: string | null | undefined): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? "");
  return match ? match[1] : null;
}

function windowEndMonth(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes("q1") || lower.includes("winter")) return 3;
  if (lower.includes("q2") || lower.includes("spring") || lower.includes("h1") || lower.includes("early")) return 6;
  if (lower.includes("q3") || lower.includes("summer") || lower.includes("mid")) return 9;
  return 12;
}

export function isUpcomingRelease(
  item: Pick<ReleaseListItem, "datePrecision" | "releaseDate" | "effectiveSortDate" | "releaseWindow" | "dateText">,
  today: Date
): boolean {
  const todayIso = localTodayIso(today);
  const todayYm = localTodayYearMonth(today);
  const todayYear = today.getFullYear();

  const exactIso = extractIsoDate(item.releaseDate);
  const sortIso = extractIsoDate(item.effectiveSortDate);

  if (item.datePrecision === "Exact") {
    const iso = exactIso ?? sortIso;
    return iso ? iso >= todayIso : true;
  }

  if (item.datePrecision === "Month") {
    const iso = exactIso ?? sortIso;
    return iso ? iso.slice(0, 7) >= todayYm : true;
  }

  if (item.datePrecision === "Window") {
    if (exactIso) return exactIso >= todayIso;
    const text = (item.releaseWindow || item.dateText || "").trim();
    const yearMatch = /\b(20\d{2})\b/.exec(text);
    const year = yearMatch ? Number(yearMatch[1]) : sortIso ? Number(sortIso.slice(0, 4)) : null;
    if (!year) return true;
    const endYm = `${year}-${pad2(windowEndMonth(text))}`;
    return endYm >= todayYm;
  }

  if (item.datePrecision === "Year") {
    const textYear = /\b(20\d{2})\b/.exec(item.dateText || "")?.[1];
    const isoYear = (exactIso ?? sortIso)?.slice(0, 4);
    const year = Number(textYear ?? isoYear);
    return Number.isFinite(year) && year > 0 ? year >= todayYear : true;
  }

  return true;
}

export interface UpcomingStart {
  groupIndex: number;
  itemIndex: number;
  item: ReleaseListItem | undefined;
  earlierGroupCount: number;
}

export function findUpcomingStart<T extends { items: ReleaseListItem[] }>(
  groups: readonly T[],
  today: Date
): UpcomingStart {
  if (groups.length === 0) {
    return { groupIndex: 0, itemIndex: -1, item: undefined, earlierGroupCount: 0 };
  }

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const items = groups[groupIndex].items;
    const itemIndex = items.findIndex(item => isUpcomingRelease(item, today));
    if (itemIndex !== -1) {
      return {
        groupIndex,
        itemIndex,
        item: items[itemIndex],
        earlierGroupCount: groupIndex
      };
    }
  }

  // Every listed release is already in the past: open at the latest month rather than January.
  const lastGroupIndex = groups.length - 1;
  const lastItems = groups[lastGroupIndex].items;
  return {
    groupIndex: lastGroupIndex,
    itemIndex: lastItems.length > 0 ? 0 : -1,
    item: lastItems[0],
    earlierGroupCount: lastGroupIndex
  };
}
