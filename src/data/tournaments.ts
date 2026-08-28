import cricketImg from "@/assets/g-cricket.jpg";
import footballImg from "@/assets/g-football.jpg";
import badmintonImg from "@/assets/g-badminton.jpg";
import indoorImg from "@/assets/g-indoor.jpg";
import raceImg from "@/assets/g-race.jpg";
import ttImg from "@/assets/g-tt.jpg";

export type MatchStatus = "upcoming" | "live" | "completed";

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
  about: string;
  info: { label: string; value: string }[];
  rounds: BracketRound[];
  gallery: { src: string; caption: string }[];
  videos: { title: string; duration: string; poster: string; meta: string }[];
};

const teamNames = ["Blue Moon Mavericks", "Golden Gladiators", "Red Raiders", "Teal Titans"];

const images = [cricketImg, footballImg, badmintonImg, indoorImg, raceImg, ttImg];

function gallery(pick: string[], captions: string[]) {
  return pick.map((src, i) => ({ src, caption: captions[i % captions.length] ?? "" }));
}

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
    tagline: "Eight overs. Sixteen squads. One trophy.",
    dates: "05 – 06 Sep · 26 – 27 Sep 2026",
    day: "Sat – Sun",
    time: "7:00 AM – 6:00 PM",
    venue: "Sports Square",
    venueNote: "Sarjapur – Marathahalli Road",
    format: "Knockout · 8 overs a side",
    teams: "16 squads",
    image: cricketImg,
    accent: "ember",
    participants: "team",
    about:
      "The marquee event of Sports Day 2026. Sixteen cross-functional squads, eight-over innings and a straight knockout ladder that runs across two weekends before the floodlit final.",
    info: [
      { label: "Overs", value: "8 per innings" },
      { label: "Squad size", value: "11 + 2 substitutes" },
      { label: "Ball", value: "Tennis ball, taped" },
      { label: "Tie-breaker", value: "Super over" },
    ],
    rounds: buildLadder(cricketSquads, {
      completed: 3,
      live: 3,
      scoring: "runs",
      days: ["05 Sep", "06 Sep", "26 Sep", "27 Sep", "27 Sep"],
      times: OUTDOOR_TIMES,
      courtLabel: "Ground",
    }),
    gallery: gallery(
      [cricketImg, footballImg, raceImg, cricketImg, ttImg, indoorImg],
      [
        "Openers walking out at Sports Square",
        "Warm-ups before the first innings",
        "Sprint between the wickets",
        "Squad huddle at the toss",
        "Between-innings break",
        "Support crew on the sidelines",
      ],
    ),
    videos: [
      {
        title: "Quarter-Final 2 · Full highlights",
        duration: "8:42",
        poster: cricketImg,
        meta: "Golden Gladiators vs Red Raiders",
      },
      {
        title: "Six of the tournament",
        duration: "0:38",
        poster: footballImg,
        meta: "Round 2 · Bid Blazers",
      },
      {
        title: "Captains speak",
        duration: "4:10",
        poster: raceImg,
        meta: "Pre-final press huddle",
      },
    ],
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
    gallery: gallery(
      [footballImg, raceImg, cricketImg, footballImg],
      ["Evening kick-off", "Counter-attack", "Sideline tactics", "Full-time whistle"],
    ),
    videos: [
      {
        title: "Round 2 · Best goals",
        duration: "3:05",
        poster: footballImg,
        meta: "12 goals, 6 matches",
      },
      {
        title: "Golden goal in the QF",
        duration: "1:12",
        poster: raceImg,
        meta: "Turf Tigers vs Net Ninjas",
      },
    ],
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
    gallery: gallery(
      [badmintonImg, ttImg, indoorImg, badmintonImg, raceImg, footballImg],
      [
        "Opening smash",
        "Between games",
        "Courtside crowd",
        "Deciding rally",
        "Warm-up drills",
        "Post-match handshake",
      ],
    ),
    videos: [
      {
        title: "Semi-Final 1 · Extended rally",
        duration: "2:24",
        poster: badmintonImg,
        meta: "42-shot rally, game point",
      },
      { title: "Night 3 recap", duration: "5:50", poster: ttImg, meta: "All Round 2 results" },
    ],
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
    gallery: gallery(
      [ttImg, indoorImg, badmintonImg, ttImg],
      ["Rally at table one", "Crowd at the final", "Serve, match point", "Trophy handover"],
    ),
    videos: [
      {
        title: "Final · Full match",
        duration: "18:05",
        poster: ttImg,
        meta: "Dev P. vs Aayansh R.",
      },
    ],
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
      { label: "Time control", value: "10 min + 5 sec" },
      { label: "Rounds", value: "5 knockout rounds" },
      { label: "Draw rule", value: "Blitz decider" },
      { label: "Boards", value: "8 boards" },
    ],
    rounds: buildLadder(singlesPlayers, {
      completed: 2,
      live: 2,
      scoring: "games",
      days: ["31 Aug", "02 Sep", "04 Sep", "08 Sep", "09 Sep"],
      times: EVENING_TIMES,
      courtLabel: "Board",
    }),
    gallery: gallery(
      [indoorImg, ttImg, cricketImg, indoorImg],
      ["Board one, round two", "Clock pressure", "Analysis after play", "Quiet concentration"],
    ),
    videos: [
      {
        title: "Round 2 · Board one recap",
        duration: "6:30",
        poster: indoorImg,
        meta: "Queen sacrifice on move 24",
      },
    ],
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
      "Doubles carrom on four boards. First to 21 points or two boards, with the queen to be covered as per standard rules.",
    info: [
      { label: "Format", value: "First to 21 points" },
      { label: "Boards", value: "4 boards" },
      { label: "Queen", value: "Must be covered" },
      { label: "Break", value: "Alternating" },
    ],
    rounds: buildLadder(pairs(7), {
      completed: 1,
      live: 1,
      scoring: "points",
      days: ["31 Aug", "02 Sep", "04 Sep", "08 Sep", "09 Sep"],
      times: EVENING_TIMES,
      courtLabel: "Board",
    }),
    gallery: gallery(
      [indoorImg, ttImg, cricketImg],
      ["Opening break", "Queen pocketed", "Board four finish"],
    ),
    videos: [
      {
        title: "Trick shots of week one",
        duration: "1:48",
        poster: indoorImg,
        meta: "Round 1 highlights",
      },
    ],
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
    gallery: gallery(
      [indoorImg, ttImg, footballImg],
      ["Checkout attempt", "Scoreboard duty", "Crowd at the board"],
    ),
    videos: [
      { title: "170 checkout", duration: "0:44", poster: indoorImg, meta: "Round 2 · Deep Patel" },
    ],
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
    gallery: gallery(
      [raceImg, footballImg, cricketImg, raceImg],
      ["Heat one off the blocks", "Baton exchange", "Cheering the anchor leg", "Photo finish"],
    ),
    videos: [
      {
        title: "Relay semi-finals",
        duration: "7:20",
        poster: raceImg,
        meta: "Four teams, two spots",
      },
      {
        title: "100m final · slow motion",
        duration: "0:52",
        poster: footballImg,
        meta: "Decided by 0.04s",
      },
    ],
  },
];

export const heroGallery = images;

export function getTournament(slug: string) {
  return tournaments.find((t) => t.slug === slug);
}

export const eventTeams = teamNames;
