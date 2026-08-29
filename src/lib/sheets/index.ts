/**
 * Server-side loader: fetches the spreadsheet, translates it, and caches the
 * result. Never throws — if the sheet is unreachable or misconfigured the site
 * falls back to the last good copy, then to the built-in sample data.
 */
import {
  tournaments as fallbackTournaments,
  type Group,
  type Tournament,
} from "@/data/tournaments";
import { fetchAllTabs, readSheetsConfig } from "./client";
import {
  parseGroupsTab,
  parseMatchTab,
  parseTournamentsTab,
  type ParseWarning,
  type SheetGrid,
  type TournamentConfig,
} from "./parse";
import { loadFolderMedia } from "@/lib/drive";

/** How long a fetched copy is served before we re-read the sheet. */
const TTL_MS = 60_000;

export type SheetSource = "sheet" | "cache" | "fallback";

export type SheetData = {
  tournaments: Tournament[];
  groups: Group[] | null;
  warnings: ParseWarning[];
  source: SheetSource;
  /** Slugs whose matches came from the sheet rather than the sample data. */
  fromSheet: string[];
  fetchedAt: number;
  /** Set when the latest read failed; the data above is then stale or sample. */
  error?: string;
};

/** Tabs that hold configuration rather than a tournament's matches. */
const RESERVED_TABS = new Set(["tournaments", "groups", "config", "settings", "readme"]);

const findTab = (tabs: Record<string, SheetGrid>, name: string) =>
  Object.entries(tabs).find(([title]) => title.trim().toLowerCase() === name)?.[1];

/** "Table Tennis" -> "table-tennis", matching the route slugs. */
const toSlug = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Applies any metadata the Tournaments tab supplied over the base entry. */
function applyConfig(base: Tournament, config: TournamentConfig): Tournament {
  return {
    ...base,
    ...(config.sport ? { sport: config.sport } : {}),
    ...(config.name ? { name: config.name } : {}),
    ...(config.participants ? { participants: config.participants } : {}),
    ...(config.dates ? { dates: config.dates } : {}),
    ...(config.day ? { day: config.day } : {}),
    ...(config.time ? { time: config.time } : {}),
    ...(config.venue ? { venue: config.venue } : {}),
    ...(config.venueNote ? { venueNote: config.venueNote } : {}),
    ...(config.format ? { format: config.format } : {}),
    ...(config.tagline ? { tagline: config.tagline } : {}),
    ...(config.about ? { about: config.about } : {}),
  };
}

/**
 * A sport the sheet knows about but the code has never seen. Borrows the
 * artwork from the sample data so the page still renders; gallery and videos
 * stay empty until someone adds them.
 */
function blankTournament(slug: string, config: TournamentConfig): Tournament {
  const base = fallbackTournaments[0] as Tournament;
  return applyConfig(
    {
      ...base,
      slug,
      sport: config.sport ?? slug,
      name: config.name ?? slug,
      tagline: "",
      about: "",
      participants: config.participants ?? "team",
      info: [],
      rounds: [],
      gallery: [],
      videos: [],
    },
    config,
  );
}

/**
 * Merges sheet data over the built-in tournament list. Every tournament still
 * renders; the ones the sheet covers get their matches (and any metadata) from
 * it, the rest keep their sample ladder. So carrom can go live on real data
 * without the other seven sports disappearing.
 */
export function buildFromTabs(tabs: Record<string, SheetGrid>): {
  tournaments: Tournament[];
  groups: Group[] | null;
  warnings: ParseWarning[];
  fromSheet: string[];
  configs: TournamentConfig[];
} {
  const warnings: ParseWarning[] = [];

  const groupsGrid = findTab(tabs, "groups");
  let groups: Group[] | null = null;
  if (groupsGrid?.length) {
    const parsed = parseGroupsTab(groupsGrid);
    warnings.push(...parsed.warnings);
    if (parsed.groups.length) groups = parsed.groups;
  }

  // The Tournaments tab is what maps a sheet tab to a sport. Without it we can
  // only guess from tab names, which works when a tab is called "Carrom".
  const configGrid = findTab(tabs, "tournaments");
  const parsedConfig = configGrid?.length
    ? parseTournamentsTab(configGrid)
    : { configs: [], warnings: [] };
  warnings.push(...parsedConfig.warnings);

  // The Tournaments tab decides what the site shows. Nothing listed there means
  // nothing is published yet — we show an empty state rather than invent data.
  const configs: TournamentConfig[] = parsedConfig.configs;

  if (!configs.length) {
    warnings.push({
      tab: "Tournaments",
      row: null,
      message:
        "No tournaments listed in the Tournaments tab, so the site has nothing to show. " +
        `Tabs seen: ${Object.keys(tabs).join(", ")}`,
    });
  }

  const built = new Map<string, Tournament>();
  const fromSheet: string[] = [];

  for (const config of configs) {
    if (!config.visible) continue;

    const grid = findTab(tabs, config.sheetTab.trim().toLowerCase());
    if (!grid?.length) continue;

    const { rounds, warnings: tabWarnings, courtLabel } = parseMatchTab(config.sheetTab, grid);
    warnings.push(...tabWarnings);
    if (!rounds.length) continue;

    const template = fallbackTournaments.find((t) => t.slug === config.slug);
    const base = template ? applyConfig(template, config) : blankTournament(config.slug, config);

    built.set(config.slug, { ...base, rounds, ...(courtLabel ? { courtLabel } : {}) });
    fromSheet.push(config.slug);
  }

  // Sheet order, so the business team controls how the list reads.
  const tournaments = configs
    .map((config) => built.get(config.slug))
    .filter((t): t is Tournament => t !== undefined);

  return { tournaments, groups, warnings, fromSheet, configs };
}

/**
 * Fetches the live Drive photos and videos for every tournament whose
 * Tournaments-tab row has a gallery folder. Folders that fail to read (not
 * shared, API disabled, etc.) just keep whatever the tournament already had.
 */
async function attachGalleries(
  tournaments: Tournament[],
  configs: TournamentConfig[],
): Promise<Tournament[]> {
  const folderBySlug = new Map(
    configs.filter((c) => c.galleryFolder).map((c) => [c.slug, c.galleryFolder as string]),
  );
  if (folderBySlug.size === 0) return tournaments;

  return Promise.all(
    tournaments.map(async (t) => {
      const folderId = folderBySlug.get(t.slug);
      if (!folderId) return t;
      const { gallery, videos } = await loadFolderMedia(folderId);
      return {
        ...t,
        ...(gallery.length ? { gallery } : {}),
        ...(videos.length ? { videos } : {}),
      };
    }),
  );
}

/* ------------------------------------------------------------------ *
 * Cache
 * ------------------------------------------------------------------ */

let cache: SheetData | null = null;
let inFlight: Promise<SheetData> | null = null;

/**
 * Nothing to show. Used before the sheet is configured and when a read fails
 * with no cached copy — showing sample players and fake results to the company
 * would be worse than showing an honest empty state.
 */
const emptyData = (error?: string): SheetData => ({
  tournaments: [],
  groups: null,
  warnings: [],
  source: "fallback",
  fromSheet: [],
  fetchedAt: Date.now(),
  ...(error ? { error } : {}),
});

async function readSheet(): Promise<SheetData> {
  const config = readSheetsConfig();
  if (!config) {
    return emptyData(
      "Sheet not configured — set GOOGLE_SHEETS_ID, GOOGLE_SA_EMAIL and GOOGLE_SA_PRIVATE_KEY.",
    );
  }

  try {
    const tabs = await fetchAllTabs(config);
    const { tournaments, groups, warnings, fromSheet, configs } = buildFromTabs(tabs);
    const withGalleries = await attachGalleries(tournaments, configs);

    // An empty result is a valid state (nothing published yet), not an error.
    const fresh: SheetData = {
      tournaments: withGalleries,
      groups,
      warnings,
      source: "sheet",
      fromSheet,
      fetchedAt: Date.now(),
    };
    cache = fresh;
    return fresh;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sheets] read failed:", message);

    // Prefer the last good copy over showing nothing during the event.
    if (cache) return { ...cache, source: "cache", error: message };
    return emptyData(message);
  }
}

/** Cached read. Concurrent callers share one in-flight request. */
export async function loadSheetData(options?: { force?: boolean }): Promise<SheetData> {
  if (!options?.force && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache;
  }
  if (inFlight) return inFlight;

  inFlight = readSheet().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
