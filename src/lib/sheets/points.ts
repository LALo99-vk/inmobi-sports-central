/**
 * The house points table.
 *
 * Two tabs matter. `Results` is where the business team works: 18 rows, one per
 * event, each naming the houses that took gold, silver and bronze. `LeaderBoard`
 * is a rollup the sheet calculates for itself.
 *
 * We read `Results` and do every sum ourselves, then check our answer against
 * `LeaderBoard`. Points come from the sheet's own Pts columns rather than being
 * hardcoded here, so if they ever retune the scoring the site follows without a
 * deploy — but we still warn when a value isn't what the published system says.
 */
import type {
  EventMedal,
  EventResult,
  Group,
  Medal,
  MedalCount,
  PointsTable,
  ScoringStatus,
  SportPoints,
} from "@/data/tournaments";
import { MEDALS } from "@/data/tournaments";
import type { ParseWarning, SheetGrid, TournamentConfig } from "./parse";

/** The event-level results. Preferred over anything else in the sheet. */
export const RESULTS_TAB_NAMES = ["results", "resultsentry", "resultentry", "result"];

/**
 * The rollup. Read only to check our arithmetic against theirs — and used as a
 * fallback source if the Results tab ever goes missing.
 */
export const LEADERBOARD_TAB_NAMES = [
  "leaderboard",
  "houseleaderboard",
  "standings",
  "points",
  "pointstable",
  "pointtable",
  "overallpoints",
  "overall",
  "medaltally",
];

/** Every tab this module claims, so they're never read as tournament matches. */
export const POINTS_TAB_NAMES = [...RESULTS_TAB_NAMES, ...LEADERBOARD_TAB_NAMES];

/** The published system, used to check the sheet rather than to drive it. */
const EXPECTED_SPORT_POOL = 50;
const EXPECTED_TOTAL_POOL = 450;

const norm = (value: string) => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Cells that mean "nothing here yet" rather than a real value. */
const BLANK_CELLS = ["", "-", "tbd", "tba", "na", "none", "pending", "notplayed", "yettoplay"];

const isBlank = (value: string) => BLANK_CELLS.includes(norm(value));

/** Rows the team keeps for their own arithmetic — we sum the events ourselves. */
const TOTAL_LABELS = [
  "total",
  "totals",
  "grandtotal",
  "rank",
  "pointsawardedsofar",
  "awarded",
  "medalcount",
  "medalcounttiebreaker",
];

const cell = (row: string[] | undefined, index: number | undefined) =>
  index === undefined || index < 0 ? "" : (row?.[index] ?? "").trim();

/** A points cell to a number. Blank and junk both come back as 0. */
function toPoints(raw: string): number {
  if (isBlank(raw)) return 0;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Matches whatever the sheet wrote for a house — the code, the full name, or
 * "Red Raiders (RR)" — back to its group code.
 */
export function buildHouseLookup(groups: Group[]) {
  const byKey = new Map<string, string>();
  for (const group of groups) {
    byKey.set(norm(group.code), group.code);
    byKey.set(norm(group.name), group.code);
  }

  return (value: string): string | undefined => {
    const key = norm(value ?? "");
    if (!key || isBlank(value)) return undefined;
    const exact = byKey.get(key);
    if (exact) return exact;
    // Longer labels only: a two-letter code like "TT" would match half the sheet.
    for (const [candidate, code] of byKey) {
      if (candidate.length >= 4 && key.includes(candidate)) return code;
    }
    return undefined;
  };
}

/**
 * Finds the header row rather than assuming row 1 — both tabs open with a
 * title banner, and the team may well add more rows above the table later.
 */
function findHeaderRow(grid: SheetGrid, matches: (row: string[]) => boolean): number {
  for (let i = 0; i < Math.min(grid.length, 25); i++) {
    const row = grid[i];
    if (row && matches(row)) return i;
  }
  return -1;
}

/** True once a row is entirely empty — where a block of the sheet stops. */
const isEmptyRow = (row: string[] | undefined) =>
  !row || row.every((value) => (value ?? "").trim() === "");

/* ------------------------------------------------------------------ *
 * Results tab — the source of truth
 * ------------------------------------------------------------------ */

const SPORT_HEADERS = ["sport", "sports", "game", "discipline"];
const CATEGORY_HEADERS = ["eventcategory", "event", "category", "eventname", "categoryevent"];

/**
 * Reads the Results tab into one record per event.
 *
 * Each medal's points live in the column immediately after its house column —
 * all three are headed "Pts", so they can only be told apart by position.
 */
export function parseResultsTab(
  grid: SheetGrid,
  groups: Group[],
  tab = "Results",
): { events: EventResult[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const resolveHouse = buildHouseLookup(groups);

  const medalHeader = (value: string, medal: Medal) => norm(value).startsWith(medal);
  const headerIndex = findHeaderRow(grid, (row) =>
    row.some((value) => medalHeader(value ?? "", "gold")),
  );

  if (headerIndex === -1) {
    warnings.push({
      tab,
      row: null,
      message:
        "Couldn't find the header row. It needs a Sport column and a " +
        "'GOLD — house' column, with the points beside each medal.",
    });
    return { events: [], warnings };
  }

  const header = grid[headerIndex] ?? [];
  const findColumn = (names: string[]) =>
    header.findIndex((value) => names.includes(norm(value ?? "")));

  const sportColumn = findColumn(SPORT_HEADERS);
  const categoryColumn = findColumn(CATEGORY_HEADERS);

  // The Pts column sits immediately right of its house column. Every one of
  // them is headed "Pts", so position is the only thing that distinguishes them.
  const medalColumns = MEDALS.map((medal) => {
    const house = header.findIndex((value) => medalHeader(value ?? "", medal));
    return { medal, house, points: house === -1 ? -1 : house + 1 };
  });

  const missing = medalColumns.filter((column) => column.house === -1);
  if (sportColumn === -1 || missing.length) {
    warnings.push({
      tab,
      row: headerIndex + 1,
      message: `Missing columns: ${[
        sportColumn === -1 ? "Sport" : null,
        ...missing.map((column) => `${column.medal} — house`),
      ]
        .filter(Boolean)
        .join(", ")}.`,
    });
    return { events: [], warnings };
  }

  const events: EventResult[] = [];

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i];
    // The events run in one unbroken block. Everything below the first blank
    // row — their totals line, the medal tally, the footnote — is not an event.
    if (isEmptyRow(row)) break;

    const sport = cell(row, sportColumn);
    if (!sport) continue;
    if (TOTAL_LABELS.includes(norm(sport))) break;

    const category = categoryColumn === -1 ? "" : cell(row, categoryColumn);

    const medals: EventMedal[] = medalColumns.map(({ medal, house, points }) => {
      const raw = cell(row, house);
      const team = resolveHouse(raw);
      if (raw && !team) {
        warnings.push({
          tab,
          row: i + 1,
          message:
            `${sport}${category ? ` (${category})` : ""}: "${raw}" isn't one of the ` +
            `houses (${groups.map((group) => group.code).join(", ")}), so its ` +
            `${medal} went uncounted.`,
        });
      }
      return { medal, points: toPoints(cell(row, points)), ...(team ? { team } : {}) };
    });

    const decided = medals.filter((entry) => entry.team).length;
    events.push({
      sport,
      category,
      medals,
      awarded: medals.reduce((sum, entry) => sum + (entry.team ? entry.points : 0), 0),
      pool: medals.reduce((sum, entry) => sum + entry.points, 0),
      status: decided === 0 ? "pending" : decided === medals.length ? "complete" : "partial",
    });
  }

  if (!events.length) {
    warnings.push({ tab, row: headerIndex + 1, message: "No event rows found under the header." });
  }

  return { events, warnings };
}

/* ------------------------------------------------------------------ *
 * LeaderBoard tab — read only to check our arithmetic
 * ------------------------------------------------------------------ */

export type LeaderboardSnapshot = {
  /** Points per sport per house code, exactly as the sheet calculated them. */
  points: Map<string, Record<string, number>>;
  /** Their medal tally block, if it is present. */
  medals: Map<string, MedalCount>;
  /** The order the sheet lists the sports in — what Mayur sees. */
  order: string[];
};

/**
 * Reads the rollup tab: the per-sport grid at the top, and the medal count
 * block further down. Both stop at the first blank row.
 */
export function parseLeaderboardTab(grid: SheetGrid, groups: Group[]): LeaderboardSnapshot | null {
  const resolveHouse = buildHouseLookup(groups);
  const houseCount = (row: string[]) => row.filter((value) => resolveHouse(value ?? "")).length;

  const headerIndex = findHeaderRow(grid, (row) => houseCount(row) >= 2);
  if (headerIndex === -1) return null;

  const header = grid[headerIndex] ?? [];
  const houseColumns: { index: number; code: string }[] = [];
  header.forEach((value, index) => {
    const code = resolveHouse(value ?? "");
    if (code && !houseColumns.some((column) => column.code === code)) {
      houseColumns.push({ index, code });
    }
  });

  const points = new Map<string, Record<string, number>>();
  const order: string[] = [];
  let cursor = headerIndex + 1;

  for (; cursor < grid.length; cursor++) {
    const row = grid[cursor];
    if (isEmptyRow(row)) break;
    const sport = cell(row, 0);
    if (!sport || TOTAL_LABELS.includes(norm(sport))) break;
    order.push(sport);
    points.set(
      norm(sport),
      Object.fromEntries(houseColumns.map(({ index, code }) => [code, toPoints(cell(row, index))])),
    );
  }

  // The medal tally sits below, keyed by house down the side: Gold, Silver,
  // Bronze across the top.
  const medals = new Map<string, MedalCount>();
  const medalHeader = findHeaderRow(grid.slice(cursor), (row) =>
    MEDALS.every((medal) => row.some((value) => norm(value ?? "") === medal)),
  );

  if (medalHeader !== -1) {
    const start = cursor + medalHeader;
    const header = grid[start] ?? [];
    const columns = MEDALS.map((medal) => header.findIndex((value) => norm(value ?? "") === medal));

    for (let i = start + 1; i < grid.length; i++) {
      const row = grid[i];
      if (isEmptyRow(row)) break;
      const code = resolveHouse(cell(row, 0));
      if (!code) continue;
      const counts = MEDALS.map((_, index) => toPoints(cell(row, columns[index])));
      medals.set(code, {
        gold: counts[0] ?? 0,
        silver: counts[1] ?? 0,
        bronze: counts[2] ?? 0,
        total: counts.reduce((sum, value) => sum + value, 0),
      });
    }
  }

  return { points, medals, order };
}

/* ------------------------------------------------------------------ *
 * Building the table
 * ------------------------------------------------------------------ */

const rollUpStatus = (parts: ScoringStatus[]): ScoringStatus => {
  if (parts.every((status) => status === "pending")) return "pending";
  if (parts.every((status) => status === "complete")) return "complete";
  return "partial";
};

/** Groups the events into sports and adds everything up. */
export function buildPointsTable(
  events: EventResult[],
  teams: Group[],
  configs: TournamentConfig[] = [],
  options: { order?: string[]; published?: boolean } = {},
): PointsTable {
  const slugByName = new Map<string, string>();
  for (const config of configs) {
    if (!config.visible) continue;
    slugByName.set(norm(config.slug), config.slug);
    if (config.sport) slugByName.set(norm(config.sport), config.slug);
    if (config.name) slugByName.set(norm(config.name), config.slug);
  }
  // "Dart" in the sheet, "darts" as our slug. Singular and plural both resolve.
  const findSlug = (sport: string) =>
    slugByName.get(norm(sport)) ??
    slugByName.get(`${norm(sport)}s`) ??
    slugByName.get(norm(sport).replace(/s$/, ""));

  const bySport = new Map<string, EventResult[]>();
  for (const event of events) {
    const key = norm(event.sport);
    const existing = bySport.get(key);
    if (existing) existing.push(event);
    else bySport.set(key, [event]);
  }

  // Show the sports in the order the sheet's own leaderboard lists them, so the
  // site reads the same way round as the tab they work in.
  const ordered = [...bySport.keys()].sort((a, b) => {
    const order = (options.order ?? []).map(norm);
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const sports: SportPoints[] = ordered.map((key) => {
    const group = bySport.get(key) ?? [];
    const sport = group[0]?.sport ?? key;
    const points: Record<string, number> = Object.fromEntries(teams.map((team) => [team.code, 0]));

    for (const event of group) {
      for (const medal of event.medals) {
        if (medal.team) points[medal.team] = (points[medal.team] ?? 0) + medal.points;
      }
    }

    const slug = findSlug(sport);
    return {
      sport,
      ...(slug ? { slug } : {}),
      events: group,
      points,
      awarded: group.reduce((sum, event) => sum + event.awarded, 0),
      pool: group.reduce((sum, event) => sum + event.pool, 0),
      status: rollUpStatus(group.map((event) => event.status)),
    };
  });

  const totals: Record<string, number> = Object.fromEntries(teams.map((team) => [team.code, 0]));
  const medals: Record<string, MedalCount> = Object.fromEntries(
    teams.map((team) => [team.code, { gold: 0, silver: 0, bronze: 0, total: 0 }]),
  );

  for (const sport of sports) {
    for (const [code, value] of Object.entries(sport.points)) {
      totals[code] = (totals[code] ?? 0) + value;
    }
    for (const event of sport.events) {
      for (const medal of event.medals) {
        const count = medal.team ? medals[medal.team] : undefined;
        if (!count) continue;
        count[medal.medal] += 1;
        count.total += 1;
      }
    }
  }

  return {
    sports,
    teams,
    totals,
    medals,
    awarded: sports.reduce((sum, sport) => sum + sport.awarded, 0),
    pool: sports.reduce((sum, sport) => sum + sport.pool, 0),
    eventsDecided: events.filter((event) => event.status === "complete").length,
    eventsTotal: events.length,
    published: options.published ?? events.length > 0,
  };
}

/** An empty table, so the page renders before the sheet has anything in it. */
export function emptyPointsTable(teams: Group[]): PointsTable {
  return buildPointsTable([], teams, [], { published: false });
}

/* ------------------------------------------------------------------ *
 * Reconciliation
 * ------------------------------------------------------------------ */

/**
 * Checks our arithmetic three ways: internally, against the published scoring
 * system, and against the sheet's own leaderboard. Anything that disagrees
 * becomes a warning on /api/sheet-status — never an exception, because a
 * miscounted medal must not take the page down mid-event.
 */
export function reconcile(
  table: PointsTable,
  leaderboard: LeaderboardSnapshot | null,
  tab = "Results",
): ParseWarning[] {
  const warnings: ParseWarning[] = [];
  const add = (message: string) => warnings.push({ tab, row: null, message });

  // 1. Every point awarded belongs to exactly one house.
  const houseSum = Object.values(table.totals).reduce((sum, value) => sum + value, 0);
  if (houseSum !== table.awarded) {
    add(
      `House totals add up to ${houseSum} but ${table.awarded} points have been ` +
        `awarded. Some points aren't reaching a house.`,
    );
  }

  // 2. Every medal handed out is counted exactly once.
  const medalSum = Object.values(table.medals).reduce((sum, count) => sum + count.total, 0);
  const decidedMedals = table.sports
    .flatMap((sport) => sport.events)
    .flatMap((event) => event.medals)
    .filter((medal) => medal.team).length;
  if (medalSum !== decidedMedals) {
    add(`Medal counts add up to ${medalSum} but ${decidedMedals} medals have been given out.`);
  }

  // 3. The scoring system itself: 50 a sport, 450 in total.
  for (const sport of table.sports) {
    if (sport.pool !== EXPECTED_SPORT_POOL) {
      add(
        `${sport.sport} is worth ${sport.pool} points across its ` +
          `${sport.events.length} event(s), not ${EXPECTED_SPORT_POOL}. Check the Pts columns.`,
      );
    }
    if (sport.awarded > sport.pool) {
      add(
        `${sport.sport} has awarded ${sport.awarded} points, more than the ${sport.pool} it holds.`,
      );
    }
  }
  if (table.pool !== EXPECTED_TOTAL_POOL && table.sports.length) {
    add(`The nine sports add up to ${table.pool} points, not ${EXPECTED_TOTAL_POOL}.`);
  }

  // 4. One house can't take two medals in the same event. Their own rules tab
  // lists this as an open decision, so flag it rather than assume.
  for (const sport of table.sports) {
    for (const event of sport.events) {
      const teams = event.medals.map((medal) => medal.team).filter(Boolean);
      if (new Set(teams).size !== teams.length) {
        add(
          `${sport.sport} — ${event.category}: the same house is down for more than ` +
            `one medal. Points still counted; confirm that's intended.`,
        );
      }
    }
  }

  // 5. Our sums against theirs.
  if (leaderboard) {
    for (const sport of table.sports) {
      const theirs = leaderboard.points.get(norm(sport.sport));
      if (!theirs) continue;
      for (const [code, value] of Object.entries(sport.points)) {
        const other = theirs[code];
        if (other !== undefined && other !== value) {
          add(
            `${sport.sport}: we make ${code} ${value} points, the LeaderBoard tab ` +
              `says ${other}.`,
          );
        }
      }
    }
    for (const [code, count] of leaderboard.medals) {
      const ours = table.medals[code];
      if (!ours) continue;
      for (const medal of MEDALS) {
        if (count[medal] !== ours[medal]) {
          add(
            `${code} ${medal} medals: we count ${ours[medal]}, the LeaderBoard tab ` +
              `says ${count[medal]}.`,
          );
        }
      }
    }
  }

  return warnings;
}
