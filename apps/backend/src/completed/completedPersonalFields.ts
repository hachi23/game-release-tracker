import type { CompletedDatePrecision } from "../../../../shared/types";
import { parseCompletionDate, type CompletedDateParts } from "./completedDate";
import { parseRating } from "./completedRating";

export interface ManualCompletedGamePayload {
  igdbId?: number | null;
  title?: string;
  userPlatform?: string;
  ratingRaw?: string | null;
  completionDate?: string | null;
  completionMonth?: string | null;
  completionYear?: number | null;
  completionPrecision?: CompletedDatePrecision;
  notes?: string | null;
}

// Most precise first: when several completion fields arrive together, the first filled one wins.
const completionFields = ["completionDate", "completionMonth", "completionYear"] as const;

export function normalizeCompletedPersonalPatch(patch: Record<string, unknown>) {
  const normalizedPatch = { ...patch };
  // The score always follows the rating text, so cards, charts and filters see an edited rating.
  delete normalizedPatch.ratingScore;
  if (hasOwn(normalizedPatch, "ratingRaw")) normalizedPatch.ratingScore = parseRating(normalizedPatch.ratingRaw as string | null);
  normalizeDiaryFields(normalizedPatch);
  if (completionFields.some(field => hasOwn(normalizedPatch, field))) {
    // All sent fields empty clears the completion date.
    Object.assign(normalizedPatch, parseCompletionDate(firstFilledCompletion(normalizedPatch) ?? null));
  }
  return normalizedPatch;
}

export const REPLAY_ANSWERS = ["yes", "maybe", "no"] as const;
const IMAGE_ID = /^[a-z0-9]{1,40}$/i;

// The diary fields: blank text clears a field; a replay answer or screenshot id that isn't valid is
// dropped (left unchanged) rather than stored.
function normalizeDiaryFields(patch: Record<string, unknown>) {
  const text = (key: string, max: number) => {
    if (!hasOwn(patch, key)) return;
    const value = patch[key] === null || patch[key] === undefined ? "" : String(patch[key]).trim();
    patch[key] = value ? value.slice(0, max) : null;
  };
  text("verdict", 200);
  text("favouriteCaption", 200);
  if (hasOwn(patch, "favouriteShot")) {
    const value = patch.favouriteShot === null ? "" : String(patch.favouriteShot ?? "").trim();
    if (!value) patch.favouriteShot = null;
    else if (!IMAGE_ID.test(value)) delete patch.favouriteShot;
    else patch.favouriteShot = value;
  }
  if (hasOwn(patch, "replay")) {
    const value = patch.replay === null ? "" : String(patch.replay ?? "").trim().toLowerCase();
    if (!value) patch.replay = null;
    else if ((REPLAY_ANSWERS as readonly string[]).includes(value)) patch.replay = value;
    else delete patch.replay;
  }
}

// The completion date parts for a manually added game: the most precise field the user filled in wins.
export function normalizeManualCompletion(payload: ManualCompletedGamePayload): CompletedDateParts {
  const filled = firstFilledCompletion(payload);
  if (filled !== undefined) return parseCompletionDate(filled);
  return {
    completionDate: null,
    completionMonth: null,
    completionYear: null,
    completionPrecision: payload.completionPrecision ?? "none"
  };
}

function firstFilledCompletion(fields: Partial<Record<(typeof completionFields)[number], unknown>>) {
  return completionFields.map(field => fields[field]).find(value => value !== undefined && value !== null && String(value).trim() !== "");
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
