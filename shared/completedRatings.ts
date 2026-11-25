export type RatingCategoryKey = "story" | "combat" | "art" | "pacing";

export interface CompletedRatingBreakdown {
  story: number | null;
  combat: number | null;
  art: number | null;
  pacing: number | null;
}

export const RATING_CATEGORIES: ReadonlyArray<{ key: RatingCategoryKey; label: string }> = [
  { key: "story", label: "Story & World" },
  { key: "combat", label: "Combat & Feel" },
  { key: "art", label: "Art & Music" },
  { key: "pacing", label: "Pacing" }
];

const roundToOne = (value: number) => Math.round(value * 10) / 10;

// Parses a category score from a number or typed text ("9", "9.5", "9/10", "95%", "4/5"),
// clamped to 0..10 and rounded to 1 decimal place. Returns null for empty or invalid values.
export function parseCategoryScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return roundToOne(Math.max(0, Math.min(10, value)));
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const fraction = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const raw = (Number(fraction[1]) / Math.max(Number(fraction[2]), 1)) * 10;
    return roundToOne(Math.max(0, Math.min(10, raw)));
  }
  const percent = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    return roundToOne(Math.max(0, Math.min(10, Number(percent[1]) / 10)));
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  const scaled = num <= 10 ? num : num / 10;
  return roundToOne(Math.max(0, Math.min(10, scaled)));
}

export function normalizeRatingBreakdown(raw: Partial<Record<RatingCategoryKey, unknown>> | null | undefined): CompletedRatingBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const normalized: CompletedRatingBreakdown = {
    story: parseCategoryScore(raw.story),
    combat: parseCategoryScore(raw.combat),
    art: parseCategoryScore(raw.art),
    pacing: parseCategoryScore(raw.pacing)
  };
  return hasAnyCategoryRating(normalized) ? normalized : null;
}

export function hasAnyCategoryRating(breakdown: CompletedRatingBreakdown | null | undefined): boolean {
  if (!breakdown) return false;
  return breakdown.story !== null || breakdown.combat !== null || breakdown.art !== null || breakdown.pacing !== null;
}

export function countFilledCategories(breakdown: CompletedRatingBreakdown | null | undefined): number {
  if (!breakdown) return 0;
  return RATING_CATEGORIES.reduce((count, cat) => count + (breakdown[cat.key] !== null ? 1 : 0), 0);
}

// Averages all filled (non-null) categories, rounded to 1 decimal place.
export function computeAverageRating(breakdown: CompletedRatingBreakdown | null | undefined): number | null {
  if (!breakdown) return null;
  const values = RATING_CATEGORIES
    .map(cat => breakdown[cat.key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return roundToOne(sum / values.length);
}

// Short tier stamp displayed inside the Certified Graded Slab header box.
export function gradeTierLabel(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return "UNGRADED";
  if (score >= 9.5) return "GEM MINT";
  if (score >= 9.0) return "MINT";
  if (score >= 8.0) return "EXCELLENT";
  if (score >= 7.0) return "SOLID";
  return "ARCHIVED";
}
