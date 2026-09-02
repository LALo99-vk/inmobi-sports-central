/**
 * The Winners tab — who actually won, by name.
 *
 * `Results` stays the points ledger: it says which *house* took each medal and
 * what that medal was worth. This tab says which *person*. It is deliberately
 * a separate, long-format tab — one row per medal rather than more columns
 * bolted onto Results — so the business team can append a row as each event
 * finishes instead of filling in a widening grid.
 *
 *     Sport | Category | Medal | House | Winners
 *
 * The House column is read as a *check*, not as a source. Results already
 * decided who won; if this tab disagrees the row still shows, but the
 * disagreement surfaces on /api/sheet-status so it gets fixed in the sheet
 * rather than silently contradicting the points table.
 */
import type { EventResult, Group, Medal } from "@/data/tournaments";
import type { ParseWarning, SheetGrid } from "./parse";
import {
  buildHouseLookup,
  cell,
  findHeaderRow,
  isBlank,
  isEmptyRow,
  norm,
  CATEGORY_HEADERS,
  SPORT_HEADERS,
} from "./points";

/** Tab titles this module answers to. `Winners` is the one we document. */
export const WINNERS_TAB_NAMES = [
  "winners",
  "winner",
  "champions",
  "medalwinners",
  "medallists",
  "medalists",
  "winnerentry",
  "winnersentry",
];

const MEDAL_HEADERS = ["medal", "place", "position", "rank", "medaltype"];
const HOUSE_HEADERS = ["house", "team", "group", "housecode", "housename", "teamname"];
const WINNER_HEADERS = [
  "winner",
  "winners",
  "name",
  "names",
  "winnername",
  "winnernames",
  "player",
  "players",
  "playername",
  "participant",
  "participants",
  "individual",
];

/** However the sheet spells the three places. */
const MEDAL_WORDS: Record<string, Medal> = {
  gold: "gold",
  g: "gold",
  "1": "gold",
  "1st": "gold",
  first: "gold",
  winner: "gold",
  champion: "gold",
  silver: "silver",
  s: "silver",
  "2": "silver",
  "2nd": "silver",
  second: "silver",
  runnerup: "silver",
  bronze: "bronze",
  b: "bronze",
  "3": "bronze",
  "3rd": "bronze",
  third: "bronze",
};

/**
 * Cells that mean "the house won this, nobody in particular" — cricket and
 * football have no individual to name.
 */
const SQUAD_LABELS = ["squad", "team", "wholeteam", "house", "allplayers", "everyone"];

/** A category left blank means the sport's single open event. */
const OPEN = "open";
const categoryKey = (value: string) => {
  const key = norm(value);
  return !key || isBlank(value) ? OPEN : key;
};

const eventKey = (sport: string, category: string) => `${norm(sport)}|${categoryKey(category)}`;

/**
 * Splits a Winners cell into names. Doubles get written every which way —
 * "M. Iyer & P. Shah", "Iyer / Shah", "Iyer, Shah" — so all three separators
 * are honoured.
 */
export function splitNames(raw: string): string[] {
  if (isBlank(raw)) return [];
  if (SQUAD_LABELS.includes(norm(raw))) return [];
  return raw
    .split(/[,/&+]|\band\b/i)
    .map((name) => name.replace(/\s+/g, " ").trim())
    .filter((name) => name.length > 0 && !isBlank(name));
}

/** One row of the tab, before it is matched to an event. */
export type WinnerEntry = {
  sport: string;
  category: string;
  medal: Medal;
  /** Group code, when the row named a house we recognise. */
  house?: string | undefined;
  names: string[];
  /** Sheet row number, so a warning can point at it. */
  row: number;
};

/**
 * Reads the tab into one entry per medal. Rows the parser can't understand
 * become warnings rather than exceptions — a mistyped medal must not take the
 * champions page down mid-event.
 */
export function parseWinnersTab(
  grid: SheetGrid,
  groups: Group[],
  tab = "Winners",
): { entries: WinnerEntry[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const resolveHouse = buildHouseLookup(groups);

  const hasHeader = (row: string[], names: string[]) =>
    row.some((value) => names.includes(norm(value ?? "")));

  const headerIndex = findHeaderRow(
    grid,
    (row) => hasHeader(row, MEDAL_HEADERS) && hasHeader(row, WINNER_HEADERS),
  );

  if (headerIndex === -1) {
    warnings.push({
      tab,
      row: null,
      message:
        "Couldn't find the header row. It needs Sport, Category, Medal and " +
        "Winners columns, one row per medal.",
    });
    return { entries: [], warnings };
  }

  const header = grid[headerIndex] ?? [];
  const findColumn = (names: string[]) =>
    header.findIndex((value) => names.includes(norm(value ?? "")));

  const sportColumn = findColumn(SPORT_HEADERS);
  const categoryColumn = findColumn(CATEGORY_HEADERS);
  const medalColumn = findColumn(MEDAL_HEADERS);
  const houseColumn = findColumn(HOUSE_HEADERS);
  const winnerColumn = findColumn(WINNER_HEADERS);

  if (sportColumn === -1 || medalColumn === -1 || winnerColumn === -1) {
    warnings.push({
      tab,
      row: headerIndex + 1,
      message: `Missing columns: ${[
        sportColumn === -1 ? "Sport" : null,
        medalColumn === -1 ? "Medal" : null,
        winnerColumn === -1 ? "Winners" : null,
      ]
        .filter(Boolean)
        .join(", ")}.`,
    });
    return { entries: [], warnings };
  }

  const entries: WinnerEntry[] = [];

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i];
    // Unlike Results, this tab grows a row at a time as events finish, so a
    // gap in the middle is far more likely than a footer below it. Skip blanks
    // instead of stopping at the first one.
    if (isEmptyRow(row)) continue;

    const sport = cell(row, sportColumn);
    if (!sport) continue;

    const rawMedal = cell(row, medalColumn);
    const medal = MEDAL_WORDS[norm(rawMedal)];
    if (!medal) {
      if (!isBlank(rawMedal)) {
        warnings.push({
          tab,
          row: i + 1,
          message: `${sport}: "${rawMedal}" isn't gold, silver or bronze, so the row was skipped.`,
        });
      }
      continue;
    }

    const rawHouse = houseColumn === -1 ? "" : cell(row, houseColumn);
    const house = resolveHouse(rawHouse);

    entries.push({
      sport,
      category: categoryColumn === -1 ? "" : cell(row, categoryColumn),
      medal,
      ...(house ? { house } : {}),
      names: splitNames(cell(row, winnerColumn)),
      row: i + 1,
    });
  }

  return { entries, warnings };
}

/**
 * Hangs the names off the events Results already produced.
 *
 * Returns new events rather than mutating, so the points arithmetic that ran
 * before this point can never be disturbed by a name.
 */
export function applyWinners(
  events: EventResult[],
  entries: WinnerEntry[],
  tab = "Winners",
): { events: EventResult[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  if (!entries.length) return { events, warnings };

  const byKey = new Map<string, EventResult>();
  const bySport = new Map<string, EventResult[]>();
  for (const event of events) {
    byKey.set(eventKey(event.sport, event.category), event);
    const list = bySport.get(norm(event.sport));
    if (list) list.push(event);
    else bySport.set(norm(event.sport), [event]);
  }

  // Names collected per event and medal, so the events can be rebuilt in one
  // pass below.
  const names = new Map<EventResult, Map<Medal, string[]>>();

  for (const entry of entries) {
    let event = byKey.get(eventKey(entry.sport, entry.category));

    // A sport with a single event is unambiguous even when the two tabs word
    // its category differently — "Open" here, blank there.
    if (!event) {
      const candidates = bySport.get(norm(entry.sport));
      if (candidates?.length === 1) event = candidates[0];
    }

    if (!event) {
      warnings.push({
        tab,
        row: entry.row,
        message:
          `No event in the Results tab matches "${entry.sport}` +
          `${entry.category ? ` — ${entry.category}` : ""}", so its ${entry.medal} ` +
          `winner isn't showing. Check the Sport and Category spelling against Results.`,
      });
      continue;
    }

    const medal = event.medals.find((item) => item.medal === entry.medal);
    if (!medal) continue;

    if (entry.house && medal.team && entry.house !== medal.team) {
      warnings.push({
        tab,
        row: entry.row,
        message:
          `${event.sport} — ${event.category || "Open"}: this tab has ${entry.house} ` +
          `taking the ${entry.medal}, the Results tab has ${medal.team}. The name is ` +
          `still shown; one of the two tabs is wrong.`,
      });
    }

    if (!entry.names.length) continue;
    const forEvent = names.get(event) ?? new Map<Medal, string[]>();
    forEvent.set(entry.medal, entry.names);
    names.set(event, forEvent);
  }

  const applied = events.map((event) => {
    const forEvent = names.get(event);
    if (!forEvent) return event;
    return {
      ...event,
      medals: event.medals.map((medal) => {
        const won = forEvent.get(medal.medal);
        return won?.length ? { ...medal, winners: won } : medal;
      }),
    };
  });

  return { events: applied, warnings };
}

/** Reads the tab and hangs its names off the events, in one call. */
export function applyWinnersTab(
  events: EventResult[],
  grid: SheetGrid,
  groups: Group[],
  tab = "Winners",
): { events: EventResult[]; warnings: ParseWarning[] } {
  const parsed = parseWinnersTab(grid, groups, tab);
  const applied = applyWinners(events, parsed.entries, tab);
  return { events: applied.events, warnings: [...parsed.warnings, ...applied.warnings] };
}
