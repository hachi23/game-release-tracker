import type { ReleaseCategory } from "./types";

export const ACCEPTED_GAME_TYPES = [0, 1, 2, 4, 8, 9, 10, 11] as const;

export const GAME_TYPE_LABELS: Record<number, ReleaseCategory> = {
  0: "Main",
  1: "DLC",
  2: "Expansion",
  4: "Standalone Expansion",
  8: "Remake",
  9: "Remaster",
  10: "Expanded Game",
  11: "Port"
};

export const APPROVED_COMPANIES = [
  "Atlus",
  "Sega",
  "Sega Corporation",
  "RGG Studio",
  "Falcom",
  "Nihon Falcom",
  "NIS America",
  "NIS America, Inc.",
  "Capcom",
  "Konami",
  "Koei Tecmo",
  "Koei Tecmo Games",
  "Team NINJA",
  "Square Enix",
  "Bandai Namco",
  "Bandai Namco Entertainment",
  "Xbox Game Studios",
  "Microsoft",
  "Microsoft Studios",
  "Bethesda Softworks",
  "Bethesda Game Studios",
  "Activision",
  "Blizzard Entertainment",
  "Ubisoft",
  "Ubisoft Entertainment",
  "EA",
  "Electronic Arts",
  "CD Projekt",
  "CD Projekt Red",
  "Warhorse Studios",
  "Domesticated Ant Games",
  "Devolver Digital",
  "Bloober Team",
  "Remedy",
  "Remedy Entertainment",
  "Archetype Entertainment",
  "Wizards of the Coast",
  "Ryu Ga Gotoku Studio",
  "Xbox",
  "Microsoft Gaming",
  "ZeniMax Media",
  "Activision Blizzard",
  "Blizzard",
  "Wizards",
  "Electronic Arts Originals",
  "EA Originals",
  "Ubisoft Montreal",
  "Ubisoft Quebec",
  "Ubisoft Toronto",
  "Capcom Development Division 1",
  "Capcom Production Studio",
  "Square Enix Creative Studio",
  "Bandai Namco Studios"
] as const;

export const EXCLUDED_TITLE_TERMS = [
  "Digital Deluxe",
  "Ultimate Edition",
  "Collector",
  "Collector's Edition",
  "Complete Launch Edition",
  "Guidebook Edition",
  "Launch Edition",
  "Limited Edition",
  "Gold Edition",
  "Premium Edition",
  "Season Pass",
  "Demo",
  "Beta"
] as const;
export const EXCLUDED_GENRE_TERMS = ["Sport", "Sports"] as const;
export const MAX_RELEASE_ROWS = 5000;
export const IGDB_REQUESTS_PER_SECOND = 4;
export const MIN_RELEASE_DATE = "2026-01-01";

export const ACCEPTED_PLATFORM_SLUGS = [
  "win",
  "xboxone",
  "series-x-s"
] as const;

export const ACCEPTED_PLATFORM_IDS = [6, 49, 169] as const;
export const REJECTED_LEGACY_PLATFORM_IDS = [12, 86] as const;
export const EXCLUSIVE_PLATFORM_SLUGS = ["ps5", "switch", "switch-2"] as const;

export const KNOWN_REPAIR_TITLES = [] as const;
