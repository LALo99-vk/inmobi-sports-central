/**
 * Server-side loader: fetches the spreadsheet, translates it, and caches the
 * result. Never throws — if the sheet is unreachable or misconfigured the site
 * falls back to the last good copy, then to the built-in sample data.
 */
import {
  tournaments as fallbackTournaments,
  groups as fallbackGroups,
  type BracketRound,
  type Group,
  type ParticipantKind,
  type PointsTable,
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
import {
  buildPointsTable,
  emptyPointsTable,
  parseLeaderboardTab,
  parseResultsTab,
  reconcile,
  LEADERBOARD_TAB_NAMES,
  POINTS_TAB_NAMES,
  RESULTS_TAB_NAMES,
} from "./points";
import { applyWinnersTab, WINNERS_TAB_NAMES } from "./winners";
import { loadFolderMedia } from "@/lib/drive";

/** How long a fetched copy is served before we re-read the sheet. */
const TTL_MS = 60_000;

export type SheetSource = "sheet" | "cache" | "fallback";

export type SheetData = {
  tournaments: Tournament[];
  groups: Group[] | null;
  /** Event-wide standings for the points table page. */
  points: PointsTable;
  warnings: ParseWarning[];
  source: SheetSource;
  /** Slugs whose matches came from the sheet rather than the sample data. */
  fromSheet: string[];
  fetchedAt: number;
  /** Set when the latest read failed; the data above is then stale or sample. */
  error?: string;
};

/** Tabs that hold configuration rather than a tournament's matches. */
const RESERVED_TABS = new Set([
  "tournaments",
  "groups",
  "config",
  "settings",
  "readme",
  ...POINTS_TAB_NAMES,
  ...WINNERS_TAB_NAMES,
]);

/** Reserved names are compared without spacing, so "POINTS TABLE" matches. */
const isReservedTab = (title: string) =>
  RESERVED_TABS.has(title.trim().toLowerCase()) ||
  RESERVED_TABS.has(
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""),
  );

const findTab = (tabs: Record<string, SheetGrid>, name: string) =>
  Object.entries(tabs).find(([title]) => title.trim().toLowerCase() === name)?.[1];

const normalizeTab = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * Finds a tab by any of its accepted names. Names are matched in the order
 * given, so `Results` always wins over the older `POINTS TABLE` stub even when
 * both are in the sheet.
 */
const findNamedTab = (tabs: Record<string, SheetGrid>, names: string[]) => {
  for (const name of names) {
    const hit = Object.entries(tabs).find(([title]) => normalizeTab(title) === name);
    if (hit?.[1]?.length) return { title: hit[0], grid: hit[1] };
  }
  return null;
};

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

/** The play-off round that hangs off the ladder rather than feeding it. */
const THIRD_PLACE = "Third Place";

/**
 * Facts the draw can answer for itself: how many are entered, how many rounds
 * they play, and how many boards run in parallel.
 *
 * The sample data these pages fall back to hardcodes all three, which goes
 * stale the moment the sheet changes — an 83-player chess draw was still
 * advertising a field of 16. Reading them off the parsed rounds keeps the panel
 * honest without adding yet another column for the business team to maintain.
 */
function derivedFacts(rounds: BracketRound[]) {
  const players = new Set<string>();
  const sides = new Set<string>();
  const courts = new Set<string>();

  // A third-place play-off is an extra fixture, not a step towards the title:
  // an 83-player draw runs 64 -> 32 -> 16 -> 8 -> 4 -> 2 -> 1, seven rounds,
  // and counting the play-off would advertise an eighth that nobody plays
  // on the way to winning.
  const ladder = rounds.filter((round) => round.name !== THIRD_PLACE);

  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.court) courts.add(match.court);
      for (const slot of [match.a, match.b]) {
        if (!slot.players?.length) continue;
        const names = slot.players.map((player) => player.trim().toLowerCase());
        names.forEach((name) => players.add(name));
        // A pair is one entrant however the sheet ordered the two names.
        sides.add([...names].sort().join(" & "));
      }
    }
  }

  return { players: players.size, sides: sides.size, rounds: ladder.length, courts: courts.size };
}

/** "83 players", "50 pairs", "16 teams" — whichever the sport actually fields. */
function fieldLabel(kind: ParticipantKind, facts: ReturnType<typeof derivedFacts>) {
  if (kind === "doubles") return `${facts.sides} pairs`;
  if (kind === "team") return `${facts.sides} teams`;
  return `${facts.players} players`;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * Rewrites the "at a glance" figures the draw can verify, leaving every other
 * tile (time control, draw rule) exactly as the sample data wrote it — those
 * have no source in the sheet, so we must not invent them.
 */
function applyFacts(
  base: Tournament,
  rounds: BracketRound[],
  courtLabel: string | undefined,
): Tournament {
  const facts = derivedFacts(rounds);
  const surface = (courtLabel ?? base.courtLabel ?? "Board").trim().toLowerCase();

  const info = base.info.map((tile) => {
    const label = tile.label.trim().toLowerCase();
    if (label === "rounds") return { ...tile, value: plural(facts.rounds, "knockout round") };
    if (facts.courts > 0 && label === `${surface}s`) {
      return { ...tile, value: plural(facts.courts, surface) };
    }
    return tile;
  });

  return { ...base, teams: fieldLabel(base.participants, facts), info };
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
  points: PointsTable;
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

    const withFacts = applyFacts(base, rounds, courtLabel);
    built.set(config.slug, { ...withFacts, rounds, ...(courtLabel ? { courtLabel } : {}) });
    fromSheet.push(config.slug);
  }

  // Sheet order, so the business team controls how the list reads.
  const tournaments = configs
    .map((config) => built.get(config.slug))
    .filter((t): t is Tournament => t !== undefined);

  const teams = groups ?? fallbackGroups;
  const points = buildPoints(tabs, teams, configs, warnings);

  return { tournaments, groups, points, warnings, fromSheet, configs };
}

/**
 * Builds the standings from the sheet.
 *
 * `Results` is the source of truth: 18 event rows naming who took each medal.
 * Every sum on the page is computed from those rows, never read off the
 * sheet's own totals. `LeaderBoard` is read afterwards only to check our
 * arithmetic against theirs, and to borrow the order it lists the sports in.
 *
 * If the Results tab is ever missing we fall back to the LeaderBoard rollup,
 * which gives points per sport but no medals and no event detail.
 */
function buildPoints(
  tabs: Record<string, SheetGrid>,
  teams: Group[],
  configs: TournamentConfig[],
  warnings: ParseWarning[],
): PointsTable {
  const leaderboardTab = findNamedTab(tabs, LEADERBOARD_TAB_NAMES);
  const leaderboard = leaderboardTab ? parseLeaderboardTab(leaderboardTab.grid, teams) : null;

  const resultsTab = findNamedTab(tabs, RESULTS_TAB_NAMES);
  if (!resultsTab) {
    if (leaderboardTab && !leaderboard) {
      warnings.push({
        tab: leaderboardTab.title,
        row: null,
        message:
          "Couldn't read this tab as a points table — no row names the four " +
          "houses. Add a Results tab for the full breakdown.",
      });
    }
    return leaderboardFallback(leaderboard, teams, configs);
  }

  const parsed = parseResultsTab(resultsTab.grid, teams, resultsTab.title);
  warnings.push(...parsed.warnings);

  // Names, if the Winners tab exists. Purely additive — the medal, the house
  // and the points are already settled by the time this runs, so an unreadable
  // name can never move a point.
  let events = parsed.events;
  const winnersTab = findNamedTab(tabs, WINNERS_TAB_NAMES);
  if (winnersTab) {
    const named = applyWinnersTab(events, winnersTab.grid, teams, winnersTab.title);
    events = named.events;
    warnings.push(...named.warnings);
  }

  const order = leaderboard?.order;
  const table = buildPointsTable(events, teams, configs, {
    ...(order ? { order } : {}),
  });
  warnings.push(...reconcile(table, leaderboard, resultsTab.title));

  return table;
}

/**
 * Standings from the rollup tab alone: points per sport, but no medals and no
 * events, because that tab simply doesn't carry them. Each sport becomes one
 * synthetic event so the totals still add up the same way.
 */
function leaderboardFallback(
  leaderboard: ReturnType<typeof parseLeaderboardTab>,
  teams: Group[],
  configs: TournamentConfig[],
): PointsTable {
  if (!leaderboard?.points.size) return emptyPointsTable(teams);

  const events = leaderboard.order.map((sport) => {
    const points = leaderboard.points.get(sport.toLowerCase().replace(/[^a-z0-9]/g, "")) ?? {};
    // The rollup gives a house's total for the sport, not which medal earned
    // it, so each house's points ride on a medal of their own.
    const medals = Object.entries(points)
      .filter(([, value]) => value > 0)
      .map(([team, value]) => ({ medal: "gold" as const, points: value, team }));

    return {
      sport,
      category: "",
      medals,
      awarded: medals.reduce((sum, medal) => sum + medal.points, 0),
      pool: 50,
      status: medals.length ? ("complete" as const) : ("pending" as const),
    };
  });

  return buildPointsTable(events, teams, configs, {
    order: leaderboard.order,
    published: true,
  });
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
  points: emptyPointsTable(fallbackGroups),
  warnings: [],
  source: "fallback",
  fromSheet: [],
  fetchedAt: Date.now(),
  ...(error ? { error } : {}),
});

async function readSheet(force = false): Promise<SheetData> {
  const config = readSheetsConfig();
  if (!config) {
    return emptyData(
      "Sheet not configured — set GOOGLE_SHEETS_ID, GOOGLE_SA_EMAIL and GOOGLE_SA_PRIVATE_KEY.",
    );
  }

  try {
    let tabs = await fetchAllTabs(config, { refreshTitles: force });
    let built = buildFromTabs(tabs);

    // The client remembers tab names for a few minutes rather than paying for
    // the metadata call on every read. A published tournament pointing at a tab
    // we never fetched means that list is simply behind — the desk has just
    // added the tab — so look the names up again rather than dropping the
    // tournament off the site until the cache turns over.
    const missing = built.configs.some(
      (entry) => entry.visible && !findTab(tabs, entry.sheetTab.trim().toLowerCase())?.length,
    );
    if (missing && !force) {
      tabs = await fetchAllTabs(config, { refreshTitles: true });
      built = buildFromTabs(tabs);
    }

    const { tournaments, groups, points, warnings, fromSheet, configs } = built;
    const withGalleries = await attachGalleries(tournaments, configs);

    // An empty result is a valid state (nothing published yet), not an error.
    const fresh: SheetData = {
      tournaments: withGalleries,
      groups,
      points,
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

  inFlight = readSheet(options?.force === true).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
