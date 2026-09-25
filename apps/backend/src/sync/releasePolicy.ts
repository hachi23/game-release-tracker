import {
  ACCEPTED_GAME_TYPES,
  ACCEPTED_PLATFORM_IDS,
  ACCEPTED_PLATFORM_SLUGS,
  APPROVED_COMPANIES,
  EXCLUDED_GENRE_TERMS,
  EXCLUDED_TITLE_TERMS,
  EXCLUSIVE_PLATFORM_SLUGS,
  GAME_TYPE_LABELS,
  MIN_RELEASE_DATE,
  REJECTED_LEGACY_PLATFORM_IDS
} from "../../../../shared/constants";
import type { IgdbGameLike, IgdbPlatformRef, NormalizedRelease, ReleaseDateChoice, ReleaseEligibility } from "../../../../shared/types";
import { getCompanyNames, getPlatformNames, pickTrailer, unixToIso, unixToText } from "../igdb/igdbGame";
import { normalizeText } from "../text/normalizeText";

// The Upcoming release policy: which IGDB games qualify, which release date counts, when a Release is
// eligible for Upcoming, and how an IGDB game becomes a Release.

function platformSlug(platform: IgdbPlatformRef) {
  return (platform.slug ?? "").toLowerCase();
}

function hasAcceptedPlatform(platforms: IgdbPlatformRef[] = []) {
  return platforms.some(platform => {
    if (typeof platform.id === "number" && (ACCEPTED_PLATFORM_IDS as readonly number[]).includes(platform.id)) return true;
    return (ACCEPTED_PLATFORM_SLUGS as readonly string[]).includes(platformSlug(platform));
  });
}

function isPlatformExclusive(platforms: IgdbPlatformRef[] = []) {
  if (platforms.length === 0 || hasAcceptedPlatform(platforms)) return false;
  return platforms.every(platform => {
    if (typeof platform.id === "number" && (REJECTED_LEGACY_PLATFORM_IDS as readonly number[]).includes(platform.id)) return false;
    return (EXCLUSIVE_PLATFORM_SLUGS as readonly string[]).includes(platformSlug(platform));
  });
}

export function chooseBestReleaseDate(game: IgdbGameLike): ReleaseDateChoice {
  const acceptedDates = (game.release_dates ?? [])
    .filter(date => {
      return !date.platform || hasAcceptedPlatform([date.platform]);
    })
    .sort((a, b) => (a.date ?? Number.MAX_SAFE_INTEGER) - (b.date ?? Number.MAX_SAFE_INTEGER));

  const candidate = acceptedDates[0] ?? (game.release_dates ?? [])[0];
  if (candidate?.date) {
    return {
      dateText: candidate.human || unixToText(candidate.date),
      releaseDate: unixToIso(candidate.date),
      datePrecision: "Exact",
      releaseWindow: null,
      sourceConfidence: 90
    };
  }

  if (candidate?.human) {
    const text = candidate.human;
    return {
      dateText: text,
      releaseDate: null,
      datePrecision: /^\d{4}$/.test(text.trim()) ? "Year" : "Window",
      releaseWindow: text,
      sourceConfidence: 60
    };
  }

  if (game.first_release_date) {
    return {
      dateText: unixToText(game.first_release_date),
      releaseDate: unixToIso(game.first_release_date),
      datePrecision: "Exact",
      releaseWindow: null,
      sourceConfidence: 80
    };
  }

  return { dateText: "TBA", releaseDate: null, datePrecision: "TBA", releaseWindow: null, sourceConfidence: 10 };
}

export function computeSortDateAndEligibility(date: Pick<ReleaseDateChoice, "dateText" | "releaseDate" | "datePrecision" | "releaseWindow">): ReleaseEligibility {
  const effectiveSortDate = deriveEffectiveSortDate(date);
  if (!effectiveSortDate) return { eligible: false, eligibilityReason: "TBA release date", effectiveSortDate: null };
  if (effectiveSortDate < MIN_RELEASE_DATE) return { eligible: false, eligibilityReason: `before ${MIN_RELEASE_DATE}`, effectiveSortDate };
  return { eligible: true, eligibilityReason: null, effectiveSortDate };
}

function deriveEffectiveSortDate(date: Pick<ReleaseDateChoice, "dateText" | "releaseDate" | "datePrecision" | "releaseWindow">) {
  if (date.releaseDate) return date.releaseDate;
  if (date.datePrecision === "TBA") return null;
  const text = (date.releaseWindow || date.dateText || "").trim();
  const year = text.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return null;
  if (date.datePrecision === "Year" || /^\d{4}$/.test(text)) return `${year}-01-01`;
  const lowered = text.toLowerCase();
  if (lowered.includes("q2") || lowered.includes("spring")) return `${year}-04-01`;
  if (lowered.includes("q3") || lowered.includes("summer")) return `${year}-07-01`;
  if (lowered.includes("q4") || lowered.includes("fall") || lowered.includes("autumn") || lowered.includes("late")) return `${year}-10-01`;
  return `${year}-01-01`;
}

export function evaluateCandidate(game: IgdbGameLike) {
  const reasons: string[] = [];
  const title = game.name ?? "";
  const gameType = game.game_type ?? 0;
  const genres = (game.genres ?? []).map(genre => genre.name ?? "");
  const companies = [...getCompanyNames(game, "publisher"), ...getCompanyNames(game, "developer")];
  const eligibility = computeSortDateAndEligibility(chooseBestReleaseDate(game));

  if (!ACCEPTED_GAME_TYPES.includes(gameType as (typeof ACCEPTED_GAME_TYPES)[number])) reasons.push(`unsupported game_type ${gameType}`);
  if (EXCLUDED_TITLE_TERMS.some(term => title.toLowerCase().includes(term.toLowerCase()))) reasons.push("excluded title phrase");
  if (genres.some(genre => EXCLUDED_GENRE_TERMS.some(term => genre.toLowerCase().includes(term.toLowerCase())))) reasons.push("sports-first genre");
  if (!hasAcceptedPlatform(game.platforms)) reasons.push("no accepted PC/Xbox/Game Pass platform");
  if (isPlatformExclusive(game.platforms)) reasons.push("platform exclusive");
  if (!companies.some(isApprovedCompany)) reasons.push("company outside preferred list");
  if (!eligibility.eligible) reasons.push(eligibility.eligibilityReason ?? "ineligible release date");

  return { accepted: reasons.length === 0, reasons };
}

export function isApprovedCompany(name: string) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return false;
  for (const term of APPROVED_COMPANIES) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) continue;
    const termTokens = normalizedTerm.split(" ").filter(Boolean);
    if (termTokens.length <= 1) {
      if (normalizedName === normalizedTerm) return true;
      continue;
    }
    const nameTokens = new Set(normalizedName.split(" ").filter(Boolean));
    if (termTokens.every(token => nameTokens.has(token))) return true;
  }
  return false;
}

export function normalizeIgdbGame(game: IgdbGameLike): NormalizedRelease {
  const date = chooseBestReleaseDate(game);
  const eligibility = computeSortDateAndEligibility(date);
  const publishers = getCompanyNames(game, "publisher");
  const developers = getCompanyNames(game, "developer");
  const artworkIds = (game.artworks ?? []).map(art => art.image_id).filter((imageId): imageId is string => Boolean(imageId));
  const artworks: NormalizedRelease["artworks"] = artworkIds.map(imageId => ({ imageId, source: "artwork" as const }));
  if (game.cover?.image_id && !artworkIds.includes(game.cover.image_id)) {
    artworks.push({ imageId: game.cover.image_id, source: "cover" as const });
  }
  const screenshots: NormalizedRelease["screenshots"] = (game.screenshots ?? [])
    .map(screen => screen.image_id)
    .filter((imageId): imageId is string => Boolean(imageId))
    .slice(0, 6)
    .map(imageId => ({ imageId, source: "artwork" as const }));
  const trailers = pickTrailer(game.videos);
  return {
    id: `igdb-${game.id}`,
    igdbId: game.id,
    title: game.name,
    normalizedTitle: normalizeText(game.name),
    category: GAME_TYPE_LABELS[game.game_type ?? 0] ?? "Main",
    publishers,
    developers,
    platforms: getPlatformNames(game),
    genres: (game.genres ?? []).map(genre => genre.name ?? "").filter(Boolean),
    igdbUrl: game.url,
    sourceUrls: game.url ? [game.url] : [],
    updatedAt: game.updated_at,
    artworks,
    screenshots,
    trailers,
    ...date,
    ...eligibility
  };
}
