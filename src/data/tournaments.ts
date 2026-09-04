import cricketImg from "@/assets/g-cricket.jpg";
import footballImg from "@/assets/g-football.jpg";
import badmintonImg from "@/assets/g-badminton.jpg";
import indoorImg from "@/assets/g-indoor.jpg";
import raceImg from "@/assets/g-race.jpg";
import ttImg from "@/assets/g-tt.jpg";

/**
 * "cancelled" and "noshow" both mean the fixture was not played out. They stay
 * distinct because the reason is what the desk gets asked about: a cancelled
 * match may be rescheduled, a no-show usually hands the tie to whoever turned
 * up. Either may still carry a winner — that is a walkover, and the winner
 * advances exactly as they would from a played match.
 */
export type MatchStatus = "upcoming" | "live" | "completed" | "cancelled" | "noshow";

/** How participants are shown in the bracket. */
export type ParticipantKind = "team" | "singles" | "doubles";

/** One of the four house teams every player belongs to. */
export type Group = {
  /** Short code as written in the sheet, e.g. "RR". */
  code: string;
  name: string;
  color: string;
};

/**
 * Kept here for now; this is the first thing that will move to the sheet's
 * `Groups` tab so the business team owns the codes, names and colours.
 */
export const groups: Group[] = [
  { code: "BMM", name: "Blue Moon Mavericks", color: "#2E6DB4" },
  { code: "GG", name: "Golden Gladiators", color: "#C8951E" },
  { code: "RR", name: "Red Raiders", color: "#C0392B" },
  { code: "TT", name: "Teal Titans", color: "#1F8A7A" },
];

export function getGroup(code: string | undefined | null) {
  if (!code) return undefined;
  return groups.find((g) => g.code === code);
}

/* ------------------------------------------------------------------ *
 * Event-wide points table
 * ------------------------------------------------------------------ */

export type Medal = "gold" | "silver" | "bronze";

/** The three places, in the order they are awarded and displayed. */
export const MEDALS: Medal[] = ["gold", "silver", "bronze"];

/** How much of a thing has been decided: none of it, some, or all. */
export type ScoringStatus = "pending" | "partial" | "complete";

/** One medal in one event: what it is worth, and who took it. */
export type EventMedal = {
  medal: Medal;
  /** Read from the sheet rather than hardcoded, so their values always win. */
  points: number;
  /** Group code of the winning house. Undefined until the sheet names one. */
  team?: string | undefined;
  /**
   * Who actually won it: one name for a singles event, both for a pair. Comes
   * from the Winners tab, so it stays empty until someone fills that in — and
   * stays empty for team sports, where the house itself is the winner.
   */
  winners?: string[] | undefined;
};

/**
 * One of the 18 events — a whole sport for cricket, one category for badminton.
 * This is the unit points are actually awarded in.
 */
export type EventResult = {
  /** Sport as written in the sheet, e.g. "Table Tennis". */
  sport: string;
  /** "Open", "Men's Singles", "100 m". */
  category: string;
  medals: EventMedal[];
  /** Points handed out so far — the medals that have a house against them. */
  awarded: number;
  /** Everything this event is worth: 50, 10 or 25. */
  pool: number;
  status: ScoringStatus;
};

/** One sport's contribution to the standings, and the events inside it. */
export type SportPoints = {
  sport: string;
  /** Set when the sport matches a tournament, so the row can link to it. */
  slug?: string | undefined;
  /** 1 event for cricket, 5 for badminton, 2 for races. */
  events: EventResult[];
  /** Points per house, keyed by group code. Summed from the events. */
  points: Record<string, number>;
  awarded: number;
  /** Always 50 — every sport carries equal weight. */
  pool: number;
  status: ScoringStatus;
};

/** Medals won by one house. The tiebreaker when points are level. */
export type MedalCount = { gold: number; silver: number; bronze: number; total: number };

/** The whole standings page in one object, ready to render. */
export type PointsTable = {
  sports: SportPoints[];
  /** The four houses, in the order the Groups tab lists them. */
  teams: Group[];
  /** Points per house, keyed by group code — never a hand-typed total. */
  totals: Record<string, number>;
  /** Medal counts per house, keyed by group code. */
  medals: Record<string, MedalCount>;
  /** Points handed out across the whole carnival so far. */
  awarded: number;
  /** Everything in play: 450. */
  pool: number;
  /** Events with all three medals decided. */
  eventsDecided: number;
  /** 18, unless the sheet says otherwise. */
  eventsTotal: number;
  /** True once a Results tab was found and read. */
  published: boolean;
};

export type BracketSlot = {
  /**
   * Team name (team sports), the player (singles) or both players (doubles).
   * `null` until the feeding match has been decided.
   */
  players: string[] | null;
  /** House team code — only set for individual and doubles sports. */
  group?: string | undefined;
  /** Shown while `players` is null — mirrors the sheet's "Winner Match 1". */
  source?: string | undefined;
  /** Match number this slot is fed by, when the sheet said "Winner Match 3". */
  fromMatch?: number | undefined;
  /** This side is a bye — the sheet left no opponent here. */
  bye?: boolean | undefined;
  /** The player reached this slot on a bye rather than by winning. */
  viaBye?: boolean | undefined;
  score?: number | string | null | undefined;
};

export type BracketMatch = {
  id: string;
  /** Sequential across the whole tournament, as in the business sheet. */
  matchNumber: number;
  status: MatchStatus;
  time: string;
  court?: string | undefined;
  a: BracketSlot;
  b: BracketSlot;
  winner?: "a" | "b" | null | undefined;
};

export type BracketRound = {
  name: string;
  matches: BracketMatch[];
};

export type Tournament = {
  slug: string;
  sport: string;
  name: string;
  tagline: string;
  dates: string;
  day: string;
  time: string;
  venue: string;
  venueNote: string;
  format: string;
  teams: string;
  image: string;
  accent: "ember" | "turf" | "sky" | "ink";
  participants: ParticipantKind;
  /** What the sheet calls the playing surface: "Board", "Court", "Table". */
  courtLabel?: string | undefined;
  about: string;
  info: { label: string; value: string }[];
  /**
   * Plain-language house rules, straight from the referees' rulebook issued for
   * this tournament. Only present for sports that have one — the rest render no
   * rules section rather than an invented one.
   */
  rules?: { section: string; text: string }[];
  rounds: BracketRound[];
  gallery: { src: string; caption: string }[];
  videos: {
    id: string;
    title: string;
    duration: string;
    /** Width over height — the card takes the clip's own shape. */
    aspect: number;
    poster: string;
    meta: string;
    shared: boolean;
  }[];
};

const teamNames = ["Blue Moon Mavericks", "Golden Gladiators", "Red Raiders", "Teal Titans"];

const images = [cricketImg, footballImg, badmintonImg, indoorImg, raceImg, ttImg];

/* ------------------------------------------------------------------ *
 * Mock bracket generation
 * ------------------------------------------------------------------ */

type Scoring = "runs" | "goals" | "games" | "sets" | "points" | "legs" | "time";

/** Deterministic pseudo-random so the mock data never shifts between renders. */
function seeded(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Plausible winner/loser scores for the sport in question. */
function scoreFor(scoring: Scoring, r: number, i: number): [number | string, number | string] {
  const k = seeded(r * 17 + i * 7 + 1);
  const j = seeded(k * 913 + 5);
  switch (scoring) {
    case "runs": {
      const w = 96 + Math.round(k * 74);
      return [w, w - (4 + Math.round(j * 34))];
    }
    case "goals": {
      const w = 2 + Math.round(k * 3);
      return [w, Math.round(j * (w - 1))];
    }
    case "games":
      return [2, k > 0.55 ? 1 : 0];
    case "sets":
      return [3, k > 0.5 ? 2 : 1];
    case "points":
      return [21, 9 + Math.round(k * 10)];
    case "legs":
      return [3, Math.round(k * 2)];
    case "time": {
      const w = 48 + k * 4;
      return [`${w.toFixed(2)}s`, `${(w + 0.3 + j * 1.8).toFixed(2)}s`];
    }
  }
}

/** Partial score for a match that is still being played. */
function liveScore(full: number | string) {
  if (typeof full !== "number") return null;
  return Math.max(0, Math.round(full * 0.62));
}

const ROUND_NAMES = ["Round 1", "Round 2", "Quarter-Finals", "Semi-Finals", "Final"];

type LadderOptions = {
  /** Number of fully completed rounds. */
  completed: number;
  /** Index of the round currently being played, or -1. */
  live: number;
  scoring: Scoring;
  /** Day label per round, e.g. "05 Sep". */
  days: string[];
  times?: string[];
  courtLabel?: string;
};

/** One side of a first-round match. */
type Entrant = { players: string[]; group?: string | undefined };

/** Builds a knockout ladder: Round 1 -> Round 2 -> QF -> SF -> Final. */
function buildLadder(entrants: Entrant[], opts: LadderOptions): BracketRound[] {
  const {
    completed,
    live,
    scoring,
    days,
    times = ["10:00", "11:30", "14:00", "16:30"],
    courtLabel = "Court",
  } = opts;

  const rounds: BracketRound[] = [];
  let slots: BracketSlot[] = entrants.map((e) => ({
    players: e.players,
    group: e.group,
  }));
  let matchNumber = 1;

  for (let r = 0; slots.length >= 2 && r < ROUND_NAMES.length; r++) {
    const matches: BracketMatch[] = [];
    const next: BracketSlot[] = [];

    for (let i = 0; i < slots.length; i += 2) {
      const idx = i / 2;
      const n = matchNumber++;

      const a = slots[i] as BracketSlot;
      const b = slots[i + 1] as BracketSlot;
      const known = Boolean(a.players && b.players);

      let status: MatchStatus = "upcoming";
      if (r < completed) status = "completed";
      else if (r === live) status = "live";
      if (!known) status = "upcoming";

      const aWins = seeded(r * 31 + idx * 11 + 3) > 0.45;
      const [sw, sl] = scoreFor(scoring, r, idx);

      let scoreA: number | string | null = null;
      let scoreB: number | string | null = null;
      let winner: "a" | "b" | null = null;

      if (status === "completed") {
        winner = aWins ? "a" : "b";
        scoreA = aWins ? sw : sl;
        scoreB = aWins ? sl : sw;
      } else if (status === "live") {
        scoreA = liveScore(aWins ? sw : sl);
        scoreB = liveScore(aWins ? sl : sw);
      }

      matches.push({
        id: `r${r}m${idx}`,
        matchNumber: n,
        status,
        time: `${days[Math.min(r, days.length - 1)] ?? ""} · ${times[idx % times.length] ?? ""}`,
        court: `${courtLabel} ${(idx % 4) + 1}`,
        a: { players: a.players, group: a.group, source: a.source, score: scoreA },
        b: { players: b.players, group: b.group, source: b.source, score: scoreB },
        winner,
      });

      const through = winner ? (winner === "a" ? a : b) : null;
      next.push({
        players: through?.players ?? null,
        group: through?.group,
        source: `Winner · M${n}`,
      });
    }

    rounds.push({ name: ROUND_NAMES[r] ?? `Round ${r + 1}`, matches });
    slots = next;
  }

  return rounds;
}

/* ------------------------------------------------------------------ *
 * Entrants
 * ------------------------------------------------------------------ */

const GROUP_CODES = ["BMM", "GG", "RR", "TT"];

/** Team sports — the squad name is the identity, so no house tag. */
const squads = (names: string[]): Entrant[] => names.map((n) => ({ players: [n] }));

/** Individual sports — every player is tagged with their house. */
const solo = (names: string[]): Entrant[] =>
  names.map((n, i) => ({ players: [n], group: GROUP_CODES[i % GROUP_CODES.length] }));

const cricketSquads = squads([
  "Blue Moon Mavericks",
  "Byte Bandits",
  "Golden Gladiators",
  "Ad Avengers",
  "Red Raiders",
  "Pixel Pirates",
  "Teal Titans",
  "Data Dynamos",
  "Cloud Chasers",
  "Glance Giants",
  "Signal Squad",
  "Core Crushers",
  "Bid Blazers",
  "Latency Lions",
  "Native Ninjas",
  "Stack Strikers",
]);

const footballSquads = squads([
  "Turf Tigers",
  "Goal Diggers",
  "Red Raiders",
  "Net Ninjas",
  "Teal Titans",
  "Boot Brigade",
  "Golden Gladiators",
  "Pitch Pandas",
  "Blue Moon Mavericks",
  "Sole Strikers",
  "Cloud Chasers",
  "Volley Vipers",
  "Signal Squad",
  "Kickstarters",
  "Data Dynamos",
  "Corner Kings",
]);

const relaySquads = squads([
  "Blue Moon Mavericks",
  "Sprint Squad",
  "Golden Gladiators",
  "Baton Bandits",
  "Red Raiders",
  "Track Pack",
  "Teal Titans",
  "Pace Makers",
  "Cloud Chasers",
  "Relay Rebels",
  "Signal Squad",
  "Fast Lane",
  "Data Dynamos",
  "Split Timers",
  "Bid Blazers",
  "Finish Line",
]);

const playerPool = [
  "Aarav Verma",
  "Nitesh S.",
  "Aayansh R.",
  "Advik M.",
  "Sanjay K.",
  "Aanisah H.",
  "Abhijeet D.",
  "Piyush N.",
  "Dev P.",
  "Deep Patel",
  "Mayur J.",
  "Riya S.",
  "Karan T.",
  "Ishita B.",
  "Rahul V.",
  "Neha G.",
  "Arjun M.",
  "Sneha R.",
  "Vikram J.",
  "Pooja L.",
  "Rohit A.",
  "Tanvi S.",
  "Kunal B.",
  "Meera N.",
  "Siddharth P.",
  "Ananya K.",
  "Farhan Q.",
  "Divya R.",
  "Manish T.",
  "Kavya S.",
  "Aditya G.",
  "Shruti M.",
];

const singlesPlayers = solo(playerPool.slice(0, 16));

/** 16 doubles pairs drawn from the 32-name pool; `offset` varies the pairings. */
function pairs(offset: number): Entrant[] {
  return Array.from({ length: 16 }, (_, i) => ({
    players: [
      playerPool[(i * 2 + offset) % playerPool.length] ?? "",
      playerPool[(i * 2 + 1 + offset) % playerPool.length] ?? "",
    ],
    group: GROUP_CODES[i % GROUP_CODES.length],
  }));
}

const OUTDOOR_TIMES = ["08:00", "10:30", "13:00", "15:30"];
const EVENING_TIMES = ["16:30", "17:15", "18:00", "18:45"];
const NIGHT_TIMES = ["18:15", "19:00", "19:45", "20:30"];

export const tournaments: Tournament[] = [
  {
    slug: "cricket",
    sport: "Cricket",
    name: "InMobi Premier League",
    tagline: "Eight teams, two groups, one weekend to reach the semis.",
    dates: "05 – 06 Sep · 26 – 27 Sep 2026",
    day: "Sat – Sun",
    time: "7:00 AM – 6:00 PM",
    venue: "Sports Square",
    venueNote: "Sarjapur – Marathahalli Road",
    format: "Groups + Knockout · 10 overs a side",
    teams: "8 teams",
    image: cricketImg,
    accent: "ember",
    participants: "team",
    about:
      "The marquee event of Sports Day 2026. Eight house teams in two groups of four, ten-over innings, and a knockout stage that runs a fortnight after the group weekend.",
    info: [
      // League overs. The knockout plays longer innings — that belongs in the
      // rules, where the stage-by-stage numbers can be spelled out.
      { label: "Overs", value: "10 per innings" },
      { label: "Squad size", value: "15 named, 11 playing" },
      { label: "Tie-breaker", value: "Super Over" },
    ],
    rules: [
      {
        section: "Format",
        text: "Ten overs a side in the group stage, fifteen in the semi-finals and final, and twelve in the third-place match. The knockout overs may change on the day if conditions or time demand it.",
      },
      {
        section: "Squad",
        text: "Up to fifteen players a team. The captain picks the playing eleven on CricHeroes and confirms it with the match official before the game begins.",
      },
      {
        section: "One team only",
        text: "Within a group a player turns out for a single team. Fielding the same player for two teams in one group disqualifies the team that played them.",
      },
      {
        section: "Bowling",
        text: "No bowler sends down more than two overs in a league match, or three in the knockout. Two bouncers are allowed an over.",
      },
      {
        section: "Powerplay",
        text: "The first three overs of a league innings, five in the semi-finals and final, four in the third-place match \u2014 no more than two fielders outside the thirty-yard circle.",
      },
      {
        section: "Batting",
        text: "No LBW. Runs are awarded for byes, overthrows, wides and no-balls, and a no-ball brings a free hit on which the batter can only go run out, hitting the ball twice or obstructing the field.",
      },
      {
        section: "Injuries",
        text: "No runners: an injured batter is retired not out and may return if they recover. The fielding side may use two substitute fielders a game, and a short-handed team may borrow its A- or B-team players to field only.",
      },
      {
        section: "On the day",
        text: "Played with a red Vicky ball. Innings are capped at forty-five minutes in the league, seventy-five in the semi-finals and final, sixty in the third-place match, with a five-minute innings break. A tie goes to a Super Over, and the umpire\u2019s decision is final.",
      },
    ],
    rounds: buildLadder(cricketSquads, {
      completed: 3,
      live: 3,
      scoring: "runs",
      days: ["05 Sep", "06 Sep", "26 Sep", "27 Sep", "27 Sep"],
      times: OUTDOOR_TIMES,
      courtLabel: "Ground",
    }),
    gallery: [],
    videos: [],
  },
  {
    slug: "football",
    sport: "Football",
    name: "Turf Cup 2026",
    tagline: "Five-a-side, twenty minutes, no mercy.",
    dates: "05 – 06 Sep · 26 – 27 Sep 2026",
    day: "Sat – Sun",
    time: "7:00 AM – 6:00 PM",
    venue: "Sports Square",
    venueNote: "Sarjapur – Marathahalli Road",
    format: "Knockout · 5-a-side",
    teams: "16 teams",
    image: footballImg,
    accent: "turf",
    participants: "team",
    about:
      "Fast five-a-side football on turf. Twenty-minute matches, rolling substitutions, and penalties to settle anything level at the whistle.",
    info: [
      { label: "Duration", value: "2 × 10 minutes" },
      { label: "Squad size", value: "5 + 3 rolling subs" },
      { label: "Surface", value: "Artificial turf" },
      { label: "Tie-breaker", value: "3 penalties" },
    ],
    rounds: buildLadder(footballSquads, {
      completed: 2,
      live: 2,
      scoring: "goals",
      days: ["05 Sep", "06 Sep", "26 Sep", "27 Sep", "27 Sep"],
      times: OUTDOOR_TIMES,
      courtLabel: "Pitch",
    }),
    gallery: [],
    videos: [],
  },
  {
    slug: "badminton",
    sport: "Badminton",
    name: "Shuttle Masters",
    tagline: "Five nights of doubles under the lights at 11 Point Club.",
    dates: "21 – 25 Sep 2026",
    day: "Mon – Fri",
    time: "6:00 PM – 9:30 PM",
    venue: "11 Point Club",
    venueNote: "Kaverappa Layout, Kadubeesanahalli",
    format: "Knockout · Doubles",
    teams: "16 pairs",
    image: badmintonImg,
    accent: "sky",
    participants: "doubles",
    about:
      "Doubles knockout played across five evenings on four courts. Best of three games to 21, with the final on centre court on Friday night.",
    info: [
      { label: "Format", value: "Best of 3 to 21" },
      { label: "Courts", value: "4 wooden courts" },
      { label: "Shuttle", value: "Feather, tournament grade" },
      { label: "Final", value: "Fri, centre court" },
    ],
    rounds: buildLadder(pairs(0), {
      completed: 3,
      live: 3,
      scoring: "games",
      days: ["21 Sep", "22 Sep", "23 Sep", "24 Sep", "25 Sep"],
      times: NIGHT_TIMES,
    }),
    gallery: [],
    videos: [],
  },
  {
    slug: "table-tennis",
    sport: "Table Tennis",
    name: "Paddle Open",
    tagline: "Cafeteria evenings, tournament intensity.",
    dates: "31 Aug – 09 Sep 2026",
    day: "Mon – Fri",
    time: "4:00 PM – 7:00 PM",
    venue: "Cafeteria",
    venueNote: "Ground Floor",
    format: "Knockout · Singles",
    teams: "16 players",
    image: ttImg,
    accent: "ink",
    participants: "singles",
    about:
      "Two weeks of after-hours table tennis in the ground floor cafeteria. Best of five to 11, two tables running in parallel.",
    info: [
      { label: "Format", value: "Best of 5 to 11" },
      { label: "Tables", value: "2 in parallel" },
      { label: "Service", value: "2 serves each" },
      { label: "Final", value: "09 Sep, 6:00 PM" },
    ],
    rounds: buildLadder(singlesPlayers, {
      completed: 5,
      live: -1,
      scoring: "sets",
      days: ["31 Aug", "02 Sep", "04 Sep", "08 Sep", "09 Sep"],
      times: EVENING_TIMES,
      courtLabel: "Table",
    }),
    gallery: [],
    videos: [],
  },
  {
    slug: "chess",
    sport: "Chess",
    name: "Rapid Chess Classic",
    tagline: "Ten minutes on the clock. No takebacks.",
    dates: "31 Aug – 09 Sep 2026",
    day: "Mon – Fri",
    time: "4:00 PM – 7:00 PM",
    venue: "Cafeteria",
    venueNote: "Ground Floor",
    format: "Knockout · Rapid",
    teams: "16 players",
    image: indoorImg,
    accent: "ink",
    participants: "singles",
    about:
      "Rapid knockout chess. Ten minutes per side with a five-second increment; a single blitz game decides any drawn pairing.",
    info: [
      // Organisers' ruling: 5 min for league matches, 10 min for knockout.
      // This draw is knockout throughout, so 10 applies.
      { label: "Time control", value: "10 min · knockout" },
      { label: "Rounds", value: "5 knockout rounds" },
      { label: "Boards", value: "8 boards" },
    ],
    rules: [
      {
        section: "Castling",
        text: "The King moves two squares toward a Rook that has not moved, and that Rook hops across \u2014 only with the squares between them empty, and never out of, through, or into check.",
      },
      {
        section: "En passant",
        text: "A pawn that advances two squares and lands alongside an enemy pawn may be captured in passing, on the very next turn only.",
      },
      {
        section: "Promotion",
        text: "A pawn reaching the far rank must be promoted to a Queen, Rook, Bishop or Knight of its own colour, whether or not that piece has been captured.",
      },
      {
        section: "Draws",
        text: "A game is drawn by stalemate, insufficient material, threefold repetition, the fifty-move rule, or mutual agreement.",
      },
    ],
    rounds: buildLadder(singlesPlayers, {
      completed: 2,
      live: 2,
      scoring: "games",
      days: ["31 Aug", "02 Sep", "04 Sep", "08 Sep", "09 Sep"],
      times: EVENING_TIMES,
      courtLabel: "Board",
    }),
    gallery: [],
    videos: [],
  },
  {
    slug: "carrom",
    sport: "Carrom",
    name: "Striker Cup",
    tagline: "Precision over power.",
    dates: "31 Aug – 09 Sep 2026",
    day: "Mon – Fri",
    time: "4:00 PM – 7:00 PM",
    venue: "Cafeteria",
    venueNote: "Ground Floor",
    format: "Knockout · Doubles",
    teams: "16 pairs",
    image: indoorImg,
    accent: "ember",
    participants: "doubles",
    about:
      "Doubles carrom played as a straight knockout. Partners play alternately, a toss decides the first break, and a team wins the board by clearing all its carrom men and covering the Queen.",
    info: [
      // Board count is rewritten from the draw; see applyFacts in lib/sheets.
      { label: "Boards", value: "4 boards" },
      { label: "Queen", value: "Must be covered" },
      // The toss winner breaks; it is the turns that alternate, not the break.
      { label: "Break", value: "Toss decides" },
    ],
    rules: [
      {
        section: "Format",
        text: "Doubles, two players a side, partners playing alternately with their registered teammate.",
      },
      {
        section: "Starting",
        text: "A toss decides which team starts, and the winner takes the first break.",
      },
      {
        section: "Scoring",
        text: "Your own carrom man is 1 point, the covered Queen 3, and a foul costs you 1.",
      },
      {
        section: "The Queen",
        text: "Either side may pocket the Queen, but it must be covered with your own man straight after \u2014 uncovered, it goes back to the centre.",
      },
      {
        section: "Winning",
        text: "Clear all your carrom men and cover the Queen. Where points decide it the higher score wins, and a tie goes to a tie-breaker set by the officials.",
      },
      {
        section: "Fouls",
        text: "Pocketing the striker, touching the men by hand, playing from outside the baseline area or disturbing the board \u2014 one point off each time.",
      },
      {
        section: "On the day",
        text: "Report to your board five minutes early. Up to five minutes\u2019 grace is allowed, after which the match may be given as a walkover, and no outside coaching is permitted.",
      },
    ],
    rounds: buildLadder(pairs(7), {
      completed: 1,
      live: 1,
      scoring: "points",
      days: ["31 Aug", "02 Sep", "04 Sep", "08 Sep", "09 Sep"],
      times: EVENING_TIMES,
      courtLabel: "Board",
    }),
    gallery: [],
    videos: [],
  },
  {
    slug: "foosball",
    sport: "Foosball",
    name: "Rod Masters",
    tagline: "Four rods. Two minds. No mercy.",
    dates: "31 Aug – 09 Sep 2026",
    day: "Mon – Fri",
    time: "4:00 PM – 7:00 PM",
    venue: "Cafeteria",
    venueNote: "Ground Floor",
    format: "Knockout · Doubles",
    teams: "16 pairs",
    image: indoorImg,
    accent: "turf",
    participants: "doubles",
    about:
      "Doubles foosball on two tables. First to five goals through the ladder, first to seven in the final. No spinning.",
    info: [
      { label: "Format", value: "First to 5 goals" },
      { label: "Tables", value: "2 tables" },
      { label: "Spinning", value: "Not allowed" },
      { label: "Final", value: "First to 7" },
    ],
    rounds: buildLadder(pairs(3), {
      completed: 1,
      live: -1,
      scoring: "goals",
      days: ["31 Aug", "02 Sep", "04 Sep", "08 Sep", "09 Sep"],
      times: EVENING_TIMES,
      courtLabel: "Table",
    }),
    gallery: [],
    videos: [],
  },
  {
    slug: "darts",
    sport: "Darts",
    name: "Bullseye Challenge",
    tagline: "Three darts. One board. Total silence.",
    dates: "31 Aug – 09 Sep 2026",
    day: "Mon – Fri",
    time: "4:00 PM – 7:00 PM",
    venue: "Cafeteria",
    venueNote: "Ground Floor",
    format: "Knockout · 501",
    teams: "16 players",
    image: indoorImg,
    accent: "sky",
    participants: "singles",
    about:
      "Classic 501, straight in and double out. Best of three legs through the ladder, best of five in the final.",
    info: [
      { label: "Game", value: "501, double out" },
      { label: "Legs", value: "Best of 3" },
      { label: "Boards", value: "2 bristle boards" },
      { label: "Final", value: "Best of 5 legs" },
    ],
    rounds: buildLadder(singlesPlayers, {
      completed: 2,
      live: -1,
      scoring: "legs",
      days: ["31 Aug", "02 Sep", "04 Sep", "08 Sep", "09 Sep"],
      times: EVENING_TIMES,
      courtLabel: "Board",
    }),
    gallery: [],
    videos: [],
  },
  {
    slug: "races-relay",
    sport: "Races & Relay",
    name: "Track Series",
    tagline: "100m, 200m and the 4×100 relay finale.",
    dates: "05 – 06 Sep · 26 – 27 Sep 2026",
    day: "Sat – Sun",
    time: "7:00 AM – 6:00 PM",
    venue: "Sports Square",
    venueNote: "Sarjapur – Marathahalli Road",
    format: "Heats → Finals",
    teams: "16 relay teams",
    image: raceImg,
    accent: "turf",
    participants: "team",
    about:
      "Sprint heats through the morning, relay ladder in the afternoon. Sixteen four-person teams race the knockout relay to a Sunday evening final.",
    info: [
      { label: "Events", value: "100m, 200m, 4×100 relay" },
      { label: "Team size", value: "4 runners" },
      { label: "Surface", value: "Marked grass track" },
      { label: "Heats", value: "Morning, 7:00 AM" },
    ],
    rounds: buildLadder(relaySquads, {
      completed: 3,
      live: -1,
      scoring: "time",
      days: ["05 Sep", "06 Sep", "26 Sep", "27 Sep", "27 Sep"],
      times: OUTDOOR_TIMES,
      courtLabel: "Lane",
    }),
    gallery: [],
    videos: [],
  },
];

export const heroGallery = images;

export function getTournament(slug: string) {
  return tournaments.find((t) => t.slug === slug);
}

export const eventTeams = teamNames;
