import type { CompletedGameListItem, ReleaseListItem } from "../../../../shared/types";

// Lightweight in-memory list cache so tab switches and CompletedDetail neighbour lookups don't
// re-query and re-parse hundreds of SQLite rows on every tap. Cleared whenever the library mutates.

let cachedUpcoming: { items: ReleaseListItem[]; sampleLoaded: boolean } | null = null;
let cachedCompleted: CompletedGameListItem[] | null = null;

export const getCachedUpcoming = () => cachedUpcoming;
export const setCachedUpcoming = (items: ReleaseListItem[], sampleLoaded: boolean) => {
  cachedUpcoming = { items, sampleLoaded };
};
export const invalidateUpcomingCache = () => {
  cachedUpcoming = null;
};

export const getCachedCompleted = () => cachedCompleted;
export const setCachedCompleted = (items: CompletedGameListItem[]) => {
  cachedCompleted = items;
};
export const updateCachedCompletedItem = (updated: Partial<CompletedGameListItem> & { id: string }) => {
  if (!cachedCompleted) return;
  cachedCompleted = cachedCompleted.map(entry => (entry.id === updated.id ? { ...entry, ...updated } : entry));
};
export const invalidateCompletedCache = () => {
  cachedCompleted = null;
};
export const invalidateAllListCaches = () => {
  cachedUpcoming = null;
  cachedCompleted = null;
};
