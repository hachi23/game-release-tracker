import type { ReleaseListItem } from "../../../../shared/types";

// Dates and countdowns as the Academy UI writes them. Pure: today is passed in.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const monthName = (month: number) => MONTHS[month - 1] ?? "";

// "2026-12-03" → a local date at midnight (never parsed as UTC, which would shift the day).
export function parseDay(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export function daysUntil(day: Date, today: Date) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000);
}

// What the notebook writes beside a release: "today", "1 day", "23 days", "out", or its vague date.
export function countdown(release: Pick<ReleaseListItem, "releaseDate" | "datePrecision" | "dateText">, today: Date) {
  const day = release.datePrecision === "Exact" ? parseDay(release.releaseDate) : null;
  if (!day) return { label: release.dateText || "TBA", days: null as number | null };
  const days = daysUntil(day, today);
  if (days < 0) return { label: "out", days };
  if (days === 0) return { label: "today", days };
  return { label: days === 1 ? "1 day" : `${days} days`, days };
}

// The circled note on a release page.
export function circledCountdown(release: Pick<ReleaseListItem, "releaseDate" | "datePrecision" | "dateText">, today: Date) {
  const { label, days } = countdown(release, today);
  if (days === null) return release.dateText || "TBA";
  if (days < 0) return "Out now!";
  if (days === 0) return "Today!";
  return `${label}!`;
}

export function longDate(value: string | null | undefined) {
  const day = parseDay(value);
  return day ? day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : null;
}

export function shortDate(value: string | null | undefined) {
  const day = parseDay(value);
  return day ? day.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;
}

// Releases grouped under a month heading, in list order; vague dates group by their own text.
export function groupByMonth(items: ReleaseListItem[], today: Date) {
  const groups: Array<{ name: string; items: ReleaseListItem[] }> = [];
  for (const item of items) {
    const sortDay = parseDay(item.effectiveSortDate ?? item.releaseDate);
    const name = sortDay
      ? `${monthName(sortDay.getMonth() + 1)}${sortDay.getFullYear() === today.getFullYear() ? "" : ` ${sortDay.getFullYear()}`}`
      : item.dateText || "To be announced";
    const last = groups[groups.length - 1];
    if (last?.name === name) last.items.push(item);
    else groups.push({ name, items: [item] });
  }
  return groups;
}

export const todayLabel = (today: Date) => today.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

// A grade as the red badge writes it: the score out of 10 ("9.5"), else the text the user typed.
export function ratingLabel(score: number | null | undefined, raw?: string | null) {
  if (score !== null && score !== undefined) return String(Math.round(score * 10) / 10);
  return raw?.trim() || "–";
}
