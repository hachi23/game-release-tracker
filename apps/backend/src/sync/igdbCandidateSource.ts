import type { TrackerDatabase } from "../database/db";
import { ACCEPTED_GAME_TYPES, KNOWN_REPAIR_TITLES, MIN_RELEASE_DATE, APPROVED_COMPANIES } from "../../../../shared/constants";
import type { IgdbGameLike } from "../../../../shared/types";
import { normalizeText } from "../text/normalizeText";
import { escapeIgdbSearch } from "../igdb/gateway";

interface IgdbQueryClient {
  query<T>(endpoint: string, body: string): Promise<T[]>;
}

interface IgdbCompany {
  id: number;
  name: string;
  slug?: string;
}

interface IgdbCandidateSourceOptions {
  searchTerms?: readonly string[];
  repairTitles?: readonly string[];
  minReleaseDate?: string;
}

export const companySearchTerms = [...new Set(APPROVED_COMPANIES)];

const igdbGameFields = [
  "id",
  "name",
  "slug",
  "url",
  "game_type",
  "first_release_date",
  "updated_at",
  "hypes",
  "total_rating_count",
  "genres.name",
  "platforms.id",
  "platforms.slug",
  "platforms.name",
  "platforms.abbreviation",
  "release_dates.human",
  "release_dates.date",
  "release_dates.y",
  "release_dates.m",
  "release_dates.d",
  "release_dates.date_format",
  "release_dates.platform.id",
  "release_dates.platform.slug",
  "release_dates.platform.name",
  "release_dates.platform.abbreviation",
  "involved_companies.publisher",
  "involved_companies.developer",
  "involved_companies.company.id",
  "involved_companies.company.name",
  "artworks.image_id",
  "cover.image_id",
  "screenshots.image_id",
  "videos.video_id",
  "videos.name"
].join(",");

export async function discoverIgdbCandidates(
  client: IgdbQueryClient,
  db?: TrackerDatabase,
  options: IgdbCandidateSourceOptions = {}
): Promise<IgdbGameLike[]> {
  const typeList = ACCEPTED_GAME_TYPES.join(",");
  const seen = new Map<number, IgdbGameLike>();
  const add = (items: IgdbGameLike[]) => {
    for (const item of items) seen.set(item.id, item);
  };
  const companyIds = await resolvePreferredCompanyIds(client, db, options.searchTerms ?? companySearchTerms);
  if (companyIds.length === 0) throw new Error("IGDB company resolution returned no approved publisher/studio IDs");
  const minReleaseDate = options.minReleaseDate ?? MIN_RELEASE_DATE;
  const minUnix = Math.floor(new Date(`${minReleaseDate}T00:00:00Z`).getTime() / 1000);

  for (const ids of chunk(companyIds, 25)) {
    for (let offset = 0; offset < 2500; offset += 500) {
      const batch = await client.query<IgdbGameLike>("games", buildPublisherGameQuery(ids, minUnix, offset, minReleaseDate));
      add(batch);
      if (batch.length < 500) break;
    }
  }

  for (const title of options.repairTitles ?? KNOWN_REPAIR_TITLES) {
    const escaped = escapeIgdbSearch(title);
    const body = `
      search "${escaped}";
      fields ${igdbGameFields};
      where game_type = (${typeList});
      limit 10;
    `;
    add(await client.query<IgdbGameLike>("games", body));
  }

  return [...seen.values()];
}

export function buildPublisherGameQuery(companyIds: number[], minReleaseUnix: number, offset: number, minReleaseDate = MIN_RELEASE_DATE) {
  const typeList = ACCEPTED_GAME_TYPES.join(",");
  const idList = companyIds.join(",");
  const minYear = Number(minReleaseDate.slice(0, 4));
  return `
    fields ${igdbGameFields};
    where game_type = (${typeList})
      & involved_companies.company = (${idList})
      & (first_release_date >= ${minReleaseUnix} | release_dates.y >= ${minYear});
    sort first_release_date asc;
    limit 500;
    offset ${offset};
  `;
}

// Publisher lookups barely change, so a saved one is reused: for 30 days when it found companies, for
// 7 days when it found none. Only missing or stale terms cost IGDB requests (about 1-2 per term at IGDB's
// 4 requests per second, so a full lookup of every term takes 15-30 s).
const COMPANY_LOOKUP_FRESH_DAYS = 30;
const COMPANY_MISS_FRESH_DAYS = 7;

function savedCompanyIds(db: TrackerDatabase | undefined, term: string): number[] | null {
  if (!db) return null;
  const row = db.prepare(`
    select company_ids companyIds,
           julianday('now') - julianday(updated_at) ageDays
    from publisher_sync_state where approved_term = ?
  `).get(term) as { companyIds: string; ageDays: number } | undefined;
  if (!row) return null;
  const ids = JSON.parse(row.companyIds) as number[];
  const freshDays = ids.length > 0 ? COMPANY_LOOKUP_FRESH_DAYS : COMPANY_MISS_FRESH_DAYS;
  return row.ageDays <= freshDays ? ids : null;
}

async function resolvePreferredCompanyIds(client: IgdbQueryClient, db: TrackerDatabase | undefined, searchTerms: readonly string[]) {
  const ids = new Map<number, string>();
  for (const term of [...new Set(searchTerms)]) {
    const saved = savedCompanyIds(db, term);
    if (saved) {
      for (const id of saved) ids.set(id, term);
      continue;
    }
    const escaped = escapeIgdbSearch(term);
    const expectedSlug = slugifyCompany(term);
    let companies = await client.query<IgdbCompany>("companies", `
      fields id,name,slug;
      where slug = "${expectedSlug}" | name = "${escaped}";
      limit 10;
    `);
    if (companies.length === 0) {
      companies = await client.query<IgdbCompany>("companies", `
        fields id,name,slug;
        where name ~ *"${escaped}"*;
        limit 10;
      `);
    }
    const matched: IgdbCompany[] = [];
    for (const company of companies) {
      if (isCompanyMatch(term, company)) {
        ids.set(company.id, company.name);
        matched.push(company);
      }
    }
    recordCompanyResolution(db, term, matched);
  }
  return [...ids.keys()];
}

function isCompanyMatch(term: string, company: IgdbCompany) {
  const normalizedTerm = normalizeText(term);
  const normalizedName = normalizeText(company.name);
  if (normalizedName === normalizedTerm) return true;
  if (company.slug && company.slug.toLowerCase() === slugifyCompany(term)) return true;
  if (normalizedTerm.length <= 2) return false;
  const termTokens = normalizedTerm.split(" ").filter(Boolean);
  const nameTokens = new Set(normalizedName.split(" ").filter(Boolean));
  return termTokens.every(token => nameTokens.has(token));
}

function slugifyCompany(term: string) {
  return term.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function recordCompanyResolution(db: TrackerDatabase | undefined, term: string, companies: IgdbCompany[]) {
  if (!db) return;
  db.prepare(`
    insert into publisher_sync_state (approved_term, company_ids, company_names, last_error, updated_at)
    values (?, ?, ?, ?, current_timestamp)
    on conflict(approved_term) do update set
      company_ids = excluded.company_ids,
      company_names = excluded.company_names,
      last_error = excluded.last_error,
      updated_at = current_timestamp
  `).run(
    term,
    JSON.stringify(companies.map(company => company.id)),
    JSON.stringify(companies.map(company => company.name)),
    companies.length === 0 ? "No IGDB company match" : null
  );
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
