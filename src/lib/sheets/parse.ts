/**
 * Turns raw Google Sheet rows into the exact shapes the bracket UI already
 * renders. Deliberately forgiving: the business team should be able to reorder
 * columns, merge cells, add their own working columns and make the odd typo
 * without the site breaking. Anything it can't understand becomes a warning,
 * never an exception.
 */
import type {
  BracketMatch,
  BracketRound,
  BracketSlot,
  Group,
  MatchStatus,
  ParticipantKind,
} from "@/data/tournaments";

/** A tab straight from the Sheets API: row 0 is the header. */
export type SheetGrid = string[][];

export type ParseWarning = { tab: string; row: number | null; message: string };

/* ------------------------------------------------------------------ *
 * Header matching
 * ------------------------------------------------------------------ */

/** "Team / Player 1" -> "teamplayer1", so spacing and punctuation don't matter. */
function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type MatchField =
  | "matchNo"
  | "round"
  | "group1"
  | "team1"
  | "group2"
  | "team2"
  | "score1"
  | "score2"
  | "score"
  | "board"
  | "timing"
  | "day"
  | "winner"
  | "status";

const MATCH_HEADERS: Record<MatchField, string[]> = {
  matchNo: ["matchno", "matchnumber", "match", "matchid", "no", "sno", "slno", "srno", "s", "id"],
  round: ["round", "stage", "roundname"],
  group1: ["team1house", "group1", "house1", "team1group", "side1group", "groupa", "housea"],
  team1: ["team1", "teamplayer1", "player1", "side1", "teama", "participant1", "playera"],
  group2: ["team2house", "group2", "house2", "team2group", "side2group", "groupb", "houseb"],
  team2: ["team2", "teamplayer2", "player2", "side2", "teamb", "participant2", "playerb"],
  score1: ["score1", "scorea", "points1", "team1score", "player1score"],
  score2: ["score2", "scoreb", "points2", "team2score", "player2score"],
  // A single column holding both, e.g. "21-14".
  score: ["score", "scores", "finalscore", "points", "scoreline"],
  board: ["board", "court", "table", "pitch", "lane", "ground", "venue"],
  timing: ["timing", "time", "slot", "matchtime"],
  day: ["day", "date", "matchday"],
  winner: ["winner", "won", "result", "winningteam", "winnerteam"],
  status: ["status", "state", "live", "matchstatus"],
};

export type ColumnMap = Partial<Record<MatchField, number>>;

/**
 * Maps each known field to its column index. Unrecognised columns are ignored,
 * so the team can keep their own scratch columns in the sheet.
 */
export function buildColumnMap(header: string[]): ColumnMap {
  const map: ColumnMap = {};
  header.forEach((raw, index) => {
    const key = normalizeHeader(raw ?? "");
    if (!key) return;
    for (const [field, aliases] of Object.entries(MATCH_HEADERS) as [MatchField, string[]][]) {
      if (map[field] === undefined && aliases.includes(key)) {
        map[field] = index;
        return;
      }
    }
  });
  // The live carrom sheet heads its match-number column with "$", which
  // normalises to nothing. Fall back to column A when it looks numeric.
  if (map.matchNo === undefined && map.round !== undefined && map.round > 0) {
    map.matchNo = 0;
  }
  return map;
}

const cell = (row: string[], index: number | undefined) =>
  index === undefined ? "" : (row[index] ?? "").trim();

/* ------------------------------------------------------------------ *
 * Merged cells
 * ------------------------------------------------------------------ */

/**
 * A merged cell only reports its value on the first row it covers; every other
 * row comes back empty. The business team merges Timing and DAY across a block
 * of matches, so carry the last seen value downwards.
 */
export function fillDown(rows: SheetGrid, columns: (number | undefined)[]): SheetGrid {
  const last = new Map<number, string>();
  return rows.map((row) => {
    const copy = row.slice();
    for (const index of columns) {
      if (index === undefined) continue;
      const value = (copy[index] ?? "").trim();
      if (value) last.set(index, value);
      else if (last.has(index)) copy[index] = last.get(index) as string;
    }
    return copy;
  });
}

/* ------------------------------------------------------------------ *
 * Participants
 * ------------------------------------------------------------------ */

/** "Nihar Shah (RR) & RR-Guest Player (RR)" -> ["Nihar Shah", "RR-Guest Player"] */
export function splitPlayers(value: string): string[] {
  return value
    .split(/\s*(?:&|\+|\/|\band\b)\s*/i)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Pulls a trailing "(RR)" house tag off a name. Used only as a fallback for
 * rows written before the Group columns existed.
 */
export function extractGroupTag(name: string): { name: string; group?: string } {
  const match = name.match(/\(([A-Za-z]{1,4})\)\s*$/);
  if (!match?.[1]) return { name: name.trim() };
  return { name: name.slice(0, match.index).trim(), group: match[1].toUpperCase() };
}

/* ------------------------------------------------------------------ *
 * Rounds
 * ------------------------------------------------------------------ */

const ROUND_ALIASES: { canonical: string; order: number; keys: string[] }[] = [
  { canonical: "Round 1", order: 1, keys: ["round1", "r1", "roundone", "preliminary", "prelims"] },
  {
    canonical: "Round 2",
    order: 2,
    keys: ["round2", "r2", "roundtwo", "prequarterfinals", "prequarters", "pqf"],
  },
  { canonical: "Round 3", order: 3, keys: ["round3", "r3", "roundthree"] },
  {
    canonical: "Quarter-Finals",
    order: 4,
    keys: ["quarterfinals", "quarterfinal", "quarters", "quarter", "qf"],
  },
  { canonical: "Semi-Finals", order: 5, keys: ["semifinals", "semifinal", "semis", "semi", "sf"] },
  { canonical: "Final", order: 6, keys: ["final", "finals", "grandfinal", "f"] },
];

export function normalizeRound(value: string) {
  const key = normalizeHeader(value);
  return ROUND_ALIASES.find((round) => round.keys.includes(key));
}

/* ------------------------------------------------------------------ *
 * Progression references
 * ------------------------------------------------------------------ */

/** "Winner Match 1" / "Winner of M1" / "W1" -> 1 */
export function parseWinnerRef(value: string): number | null {
  const match = value.trim().match(/^w(?:inner)?\.?\s*(?:of\s*)?(?:match|m)?\s*#?\s*(\d+)$/i);
  return match?.[1] ? Number(match[1]) : null;
}

function parseScore(value: string): number | string | null {
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

/**
 * Splits a single "21-14" / "21 - 14" / "21/14" cell into the two sides.
 * Returns null when the cell isn't a scoreline, so "2" or "Won" fall through.
 */
export function splitCombinedScore(value: string): [string, string] | null {
  const match = value.trim().match(/^(\S+)\s*[-–/:]\s*(\S+)$/);
  if (!match?.[1] || !match[2]) return null;
  return [match[1], match[2]];
}

function normalizeStatus(value: string): MatchStatus | null {
  const key = normalizeHeader(value);
  if (!key) return null;
  if (["live", "inprogress", "ongoing", "playing", "started"].includes(key)) return "live";
  if (["completed", "complete", "done", "final", "finished", "played"].includes(key)) {
    return "completed";
  }
  if (["upcoming", "scheduled", "notstarted", "pending", "yettostart"].includes(key)) {
    return "upcoming";
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Match rows
 * ------------------------------------------------------------------ */

type RawSide = {
  players: string[];
  group?: string | undefined;
  /** Set when the cell said "Winner Match 3" rather than naming anyone. */
  fromMatch?: number | undefined;
  score: number | string | null;
};

type RawMatch = {
  matchNumber: number;
  round: string;
  roundOrder: number;
  sides: [RawSide, RawSide];
  board: string;
  day: string;
  timing: string;
  winnerCell: string;
  statusCell: string;
};

function readSide(row: string[], columns: ColumnMap, side: 1 | 2): RawSide {
  const raw = cell(row, side === 1 ? columns.team1 : columns.team2);
  const explicitGroup = cell(row, side === 1 ? columns.group1 : columns.group2);

  // Prefer the per-side columns; fall back to a single "21-14" column.
  const own = cell(row, side === 1 ? columns.score1 : columns.score2);
  const combined = own ? null : splitCombinedScore(cell(row, columns.score));
  const score = parseScore(own || (combined ? (side === 1 ? combined[0] : combined[1]) : ""));

  const ref = parseWinnerRef(raw);
  if (ref !== null) {
    return { players: [], fromMatch: ref, score };
  }

  const parts = splitPlayers(raw);
  const tagged = parts.map(extractGroupTag);
  const group =
    explicitGroup.toUpperCase() || tagged.find((entry) => entry.group)?.group || undefined;

  return {
    players: tagged.map((entry) => entry.name).filter(Boolean),
    group,
    score,
  };
}

/**
 * Reads one tournament tab into ordered rounds, resolving "Winner Match N"
 * references to the actual winners once those matches have a result.
 */
export function parseMatchTab(
  tab: string,
  grid: SheetGrid,
): { rounds: BracketRound[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const header = grid[0];
  if (!header) {
    warnings.push({ tab, row: null, message: "Tab is empty — no header row found." });
    return { rounds: [], warnings };
  }

  const columns = buildColumnMap(header);
  for (const required of ["round", "team1", "team2"] as const) {
    if (columns[required] === undefined) {
      warnings.push({
        tab,
        row: 1,
        message: `Missing a "${required}" column. Found: ${header.filter(Boolean).join(", ")}`,
      });
      return { rounds: [], warnings };
    }
  }

  const body = fillDown(grid.slice(1), [columns.timing, columns.day, columns.board]);

  const raw: RawMatch[] = [];
  body.forEach((row, index) => {
    const sheetRow = index + 2; // 1-indexed, and row 1 is the header
    const roundCell = cell(row, columns.round);
    const team1 = cell(row, columns.team1);
    const team2 = cell(row, columns.team2);

    // Entirely blank spacer rows are normal in a working sheet.
    if (!roundCell && !team1 && !team2) return;

    const round = normalizeRound(roundCell);
    if (!round) {
      warnings.push({
        tab,
        row: sheetRow,
        message: `Unrecognised round "${roundCell}". Use Round 1, Round 2, Quarter-Finals, Semi-Finals or Final.`,
      });
      return;
    }

    const matchNumber = Number(cell(row, columns.matchNo));
    if (!Number.isFinite(matchNumber) || matchNumber <= 0) {
      warnings.push({
        tab,
        row: sheetRow,
        message: `Missing or invalid match number "${cell(row, columns.matchNo)}".`,
      });
      return;
    }

    raw.push({
      matchNumber,
      round: round.canonical,
      roundOrder: round.order,
      sides: [readSide(row, columns, 1), readSide(row, columns, 2)],
      board: cell(row, columns.board),
      day: cell(row, columns.day),
      timing: cell(row, columns.timing),
      winnerCell: cell(row, columns.winner),
      statusCell: cell(row, columns.status),
    });
  });

  const byNumber = new Map(raw.map((match) => [match.matchNumber, match]));

  const duplicates = raw.length - byNumber.size;
  if (duplicates > 0) {
    warnings.push({
      tab,
      row: null,
      message: `${duplicates} duplicate match number(s) — later rows overwrote earlier ones.`,
    });
  }

  /** Every way a side might legitimately be named in the Winner column. */
  function sideKeys(side: RawSide): string[] {
    const keys = side.players.map((player) => normalizeHeader(player)).filter(Boolean);
    if (keys.length > 1) keys.push(normalizeHeader(side.players.join("")));
    if (side.group) keys.push(normalizeHeader(side.group));
    return keys;
  }

  const winnerCache = new Map<number, 0 | 1 | null>();

  /** Which side won, or null while undecided. Memoised so warnings fire once. */
  function winnerOf(match: RawMatch): 0 | 1 | null {
    const cached = winnerCache.get(match.matchNumber);
    if (cached !== undefined) return cached;
    winnerCache.set(match.matchNumber, null); // breaks any circular lookup

    const result = computeWinner(match);
    winnerCache.set(match.matchNumber, result);
    return result;
  }

  function computeWinner(match: RawMatch): 0 | 1 | null {
    // A filled Winner is the definitive signal, even if Status still says Live.
    // People mark a match live when it starts and rarely go back to change it;
    // letting a stale Status hide a recorded winner would stall the whole ladder.
    const value = match.winnerCell.trim();
    if (!value) return null;

    if (value === "1" || normalizeHeader(value) === "team1") return 0;
    if (value === "2" || normalizeHeader(value) === "team2") return 1;

    // The Winner column is usually pasted from the Team column, so it may still
    // carry the "(RR)" tags — clean it exactly like a participant cell.
    const cleaned = splitPlayers(value)
      .map((player) => extractGroupTag(player).name)
      .filter(Boolean);
    const candidates = new Set(
      [
        normalizeHeader(value),
        normalizeHeader(cleaned.join("")),
        ...cleaned.map(normalizeHeader),
      ].filter(Boolean),
    );

    for (const index of [0, 1] as const) {
      if (sideKeys(match.sides[index]).some((key) => candidates.has(key))) return index;
    }

    warnings.push({
      tab,
      row: null,
      message: `Match ${match.matchNumber}: winner "${value}" doesn't match either side.`,
    });
    return null;
  }

  /** Follows a "Winner Match N" chain to whoever actually holds the slot. */
  function resolve(
    side: RawSide,
    seen: Set<number>,
  ): { players: string[]; group?: string | undefined } | null {
    if (side.players.length > 0) return { players: side.players, group: side.group };
    if (side.fromMatch === undefined) return null;
    if (seen.has(side.fromMatch)) return null; // guards a circular reference
    seen.add(side.fromMatch);

    const feeder = byNumber.get(side.fromMatch);
    if (!feeder) {
      warnings.push({
        tab,
        row: null,
        message: `A row points at "Winner Match ${side.fromMatch}", but no match ${side.fromMatch} exists.`,
      });
      return null;
    }
    const index = winnerOf(feeder);
    if (index === null) return null;
    return resolve(feeder.sides[index], seen);
  }

  function toSlot(side: RawSide): BracketSlot {
    const resolved = resolve(side, new Set());
    return {
      players: resolved?.players.length ? resolved.players : null,
      group: resolved?.group,
      source: side.fromMatch !== undefined ? `Winner · M${side.fromMatch}` : undefined,
      fromMatch: side.fromMatch,
      score: side.score,
    };
  }

  const ordered = [...byNumber.values()].sort(
    (a, b) => a.roundOrder - b.roundOrder || a.matchNumber - b.matchNumber,
  );

  const rounds: BracketRound[] = [];
  for (const item of ordered) {
    const winnerIndex = winnerOf(item);
    const explicit = normalizeStatus(item.statusCell);
    // Winner wins, then an explicit Status, then upcoming.
    const status: MatchStatus = winnerIndex !== null ? "completed" : (explicit ?? "upcoming");

    const time = [item.day, item.timing].filter(Boolean).join(" · ");

    const match: BracketMatch = {
      id: `${tab}-m${item.matchNumber}`,
      matchNumber: item.matchNumber,
      status,
      time,
      court: item.board || undefined,
      a: toSlot(item.sides[0]),
      b: toSlot(item.sides[1]),
      winner: winnerIndex === null ? null : winnerIndex === 0 ? "a" : "b",
    };

    let round = rounds.find((entry) => entry.name === item.round);
    if (!round) {
      round = { name: item.round, matches: [] };
      rounds.push(round);
    }
    round.matches.push(match);
  }

  return { rounds, warnings };
}

/* ------------------------------------------------------------------ *
 * Groups tab
 * ------------------------------------------------------------------ */

const DEFAULT_GROUP_COLOR = "#6B7280";

export function parseGroupsTab(grid: SheetGrid): { groups: Group[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const header = grid[0];
  if (!header) return { groups: [], warnings };

  const index = { code: -1, name: -1, color: -1 };
  header.forEach((raw, i) => {
    const key = normalizeHeader(raw ?? "");
    if (["code", "group", "groupcode", "short", "tag"].includes(key)) index.code = i;
    else if (["name", "groupname", "team", "teamname", "house"].includes(key)) index.name = i;
    else if (["color", "colour", "hex"].includes(key)) index.color = i;
  });

  if (index.code === -1 || index.name === -1) {
    warnings.push({
      tab: "Groups",
      row: 1,
      message: 'Needs at least "Code" and "Name" columns.',
    });
    return { groups: [], warnings };
  }

  const groups: Group[] = [];
  grid.slice(1).forEach((row) => {
    const code = (row[index.code] ?? "").trim().toUpperCase();
    const name = (row[index.name] ?? "").trim();
    if (!code || !name) return;
    const color = index.color === -1 ? "" : (row[index.color] ?? "").trim();
    groups.push({
      code,
      name,
      color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : DEFAULT_GROUP_COLOR,
    });
  });

  return { groups, warnings };
}

/* ------------------------------------------------------------------ *
 * Tournaments tab — the control panel
 * ------------------------------------------------------------------ */

export type TournamentConfig = {
  slug: string;
  sheetTab: string;
  visible: boolean;
  sport?: string;
  name?: string;
  participants?: ParticipantKind;
  dates?: string;
  day?: string;
  time?: string;
  venue?: string;
  venueNote?: string;
  format?: string;
  tagline?: string;
  about?: string;
};

const CONFIG_HEADERS: Record<string, string[]> = {
  slug: ["slug", "id", "key"],
  sport: ["sport", "sportname"],
  name: ["tournamentname", "name", "title", "tournament"],
  sheetTab: ["sheettab", "tab", "tabname", "matchestab", "matchtab", "bracket tab"],
  participants: ["participants", "participanttype", "type", "kind"],
  dates: ["dates", "date", "daterange"],
  day: ["days", "day"],
  time: ["time", "times", "timing"],
  venue: ["venue", "location"],
  venueNote: ["venuenote", "venuedetail", "address", "note"],
  format: ["format", "structure"],
  tagline: ["tagline", "subtitle", "strapline"],
  about: ["about", "description", "summary", "intro"],
  visible: ["visible", "published", "show", "publish"],
};

function normalizeParticipants(value: string): ParticipantKind | undefined {
  const key = normalizeHeader(value);
  if (["team", "teams", "teamsport", "squad"].includes(key)) return "team";
  if (["doubles", "double", "pairs", "pair"].includes(key)) return "doubles";
  if (["singles", "single", "individual", "solo"].includes(key)) return "singles";
  return undefined;
}

/** Anything other than an explicit "no" counts as visible. */
function isVisible(value: string) {
  const key = normalizeHeader(value);
  if (!key) return true;
  return !["no", "false", "hidden", "hide", "draft", "0", "off"].includes(key);
}

export function parseTournamentsTab(grid: SheetGrid): {
  configs: TournamentConfig[];
  warnings: ParseWarning[];
} {
  const warnings: ParseWarning[] = [];
  const header = grid[0];
  if (!header) return { configs: [], warnings };

  const index: Record<string, number> = {};
  header.forEach((raw, i) => {
    const key = normalizeHeader(raw ?? "");
    if (!key) return;
    for (const [field, aliases] of Object.entries(CONFIG_HEADERS)) {
      if (index[field] === undefined && aliases.includes(key)) {
        index[field] = i;
        return;
      }
    }
  });

  if (index["slug"] === undefined) {
    warnings.push({
      tab: "Tournaments",
      row: 1,
      message: 'Needs a "Slug" column (e.g. carrom) naming each tournament.',
    });
    return { configs: [], warnings };
  }

  const read = (row: string[], field: string) => {
    const i = index[field];
    return i === undefined ? "" : (row[i] ?? "").trim();
  };

  const configs: TournamentConfig[] = [];
  grid.slice(1).forEach((row, i) => {
    const slug = read(row, "slug").toLowerCase();
    if (!slug) return;

    const participantsRaw = read(row, "participants");
    const participants = normalizeParticipants(participantsRaw);
    if (participantsRaw && !participants) {
      warnings.push({
        tab: "Tournaments",
        row: i + 2,
        message: `Participants "${participantsRaw}" not understood — use Team, Singles or Doubles.`,
      });
    }

    const optional = (field: string) => {
      const value = read(row, field);
      return value ? value : undefined;
    };

    configs.push({
      slug,
      // Falls back to a tab named after the sport, then the slug itself.
      sheetTab: read(row, "sheetTab") || read(row, "sport") || slug,
      visible: isVisible(read(row, "visible")),
      ...(optional("sport") ? { sport: optional("sport") as string } : {}),
      ...(optional("name") ? { name: optional("name") as string } : {}),
      ...(participants ? { participants } : {}),
      ...(optional("dates") ? { dates: optional("dates") as string } : {}),
      ...(optional("day") ? { day: optional("day") as string } : {}),
      ...(optional("time") ? { time: optional("time") as string } : {}),
      ...(optional("venue") ? { venue: optional("venue") as string } : {}),
      ...(optional("venueNote") ? { venueNote: optional("venueNote") as string } : {}),
      ...(optional("format") ? { format: optional("format") as string } : {}),
      ...(optional("tagline") ? { tagline: optional("tagline") as string } : {}),
      ...(optional("about") ? { about: optional("about") as string } : {}),
    });
  });

  return { configs, warnings };
}
