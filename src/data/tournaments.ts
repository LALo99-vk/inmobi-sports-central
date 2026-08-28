import cricketImg from "@/assets/g-cricket.jpg";
import footballImg from "@/assets/g-football.jpg";
import badmintonImg from "@/assets/g-badminton.jpg";
import indoorImg from "@/assets/g-indoor.jpg";
import raceImg from "@/assets/g-race.jpg";
import ttImg from "@/assets/g-tt.jpg";

export type MatchStatus = "upcoming" | "live" | "completed";

export type BracketTeam = {
  name: string | null;
  score?: number | null;
  seed?: string;
};

export type BracketMatch = {
  id: string;
  status: MatchStatus;
  time: string;
  court?: string;
  a: BracketTeam;
  b: BracketTeam;
  winner?: "a" | "b" | null;
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
  about: string;
  info: { label: string; value: string }[];
  rounds: BracketRound[];
  gallery: { src: string; caption: string }[];
  videos: { title: string; duration: string; poster: string; meta: string }[];
};

const teamNames = [
  "Blue Moon Mavericks",
  "Golden Gladiators",
  "Red Raiders",
  "Teal Titans",
];

const images = [cricketImg, footballImg, badmintonImg, indoorImg, raceImg, ttImg];

function gallery(pick: string[], captions: string[]) {
  return pick.map((src, i) => ({ src, caption: captions[i % captions.length] }));
}

/** Builds a 16-slot knockout ladder: R1 -> R2 -> QF -> SF -> Final */
function buildRounds(
  players: string[],
  progress: number,
  liveRound: number,
): BracketRound[] {
  const names = ["Round 1", "Round 2", "Quarter-Finals", "Semi-Finals", "Final"];
  const rounds: BracketRound[] = [];
  let current = players.slice();

  for (let r = 0; r < 5; r++) {
    const matches: BracketMatch[] = [];
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const aName = current[i] ?? null;
      const bName = current[i + 1] ?? null;
      let status: MatchStatus = "upcoming";
      if (r < progress) status = "completed";
      else if (r === liveRound) status = "live";

      const aWins = (i / 2 + r) % 3 !== 1;
      const winner = status === "completed" ? (aWins ? "a" : "b") : null;
      const scoreA = status === "upcoming" ? null : aWins ? 2 : r === 4 ? 1 : 0;
      const scoreB = status === "upcoming" ? null : aWins ? (r === 4 ? 1 : 0) : 2;

      matches.push({
        id: `r${r}m${i / 2}`,
        status,
        time: `${r === 4 ? "27" : 21 + r} Sep · ${["10:00", "11:30", "14:00", "16:30"][(i / 2) % 4]}`,
        court: `Court ${((i / 2) % 4) + 1}`,
        a: { name: aName, score: scoreA },
        b: { name: bName, score: scoreB },
        winner,
      });

      next.push(
        status === "completed"
          ? ((aWins ? aName : bName) ?? "TBD")
          : (null as unknown as string),
      );
    }
    rounds.push({ name: names[r], matches });
    current = next;
    if (current.length < 2) break;
  }
  return rounds;
}

const cricketPlayers = [
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
];

const singlesPlayers = [
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
];

export const tournaments: Tournament[] = [
  {
    slug: "cricket",
    sport: "Cricket",
    name: "InMobi Premier League",
    tagline: "Eight overs. Four squads. One trophy.",
    dates: "05 – 06 Sep · 26 – 27 Sep 2026",
    day: "Sat – Sun",
    time: "7:00 AM – 6:00 PM",
    venue: "Sports Square",
    venueNote: "Sarjapur – Marathahalli Road",
    format: "Knockout · 8 overs a side",
    teams: "16 squads",
    image: cricketImg,
    accent: "ember",
    about:
      "The marquee event of Sports Day 2026. Sixteen cross-functional squads, eight-over innings and a straight knockout ladder that runs across two weekends before the floodlit final.",
    info: [
      { label: "Overs", value: "8 per innings" },
      { label: "Squad size", value: "11 + 2 substitutes" },
      { label: "Ball", value: "Tennis ball, taped" },
      { label: "Tie-breaker", value: "Super over" },
    ],
    rounds: buildRounds(cricketPlayers, 3, 3),
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
      { title: "Quarter-Final 2 · Full highlights", duration: "8:42", poster: cricketImg, meta: "Golden Gladiators vs Red Raiders" },
      { title: "Six of the tournament", duration: "0:38", poster: footballImg, meta: "Round 2 · Bid Blazers" },
      { title: "Captains speak", duration: "4:10", poster: raceImg, meta: "Pre-final press huddle" },
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
    about:
      "Fast five-a-side football on turf. Twenty-minute matches, rolling substitutions, and penalties to settle anything level at the whistle.",
    info: [
      { label: "Duration", value: "2 × 10 minutes" },
      { label: "Squad size", value: "5 + 3 rolling subs" },
      { label: "Surface", value: "Artificial turf" },
      { label: "Tie-breaker", value: "3 penalties" },
    ],
    rounds: buildRounds(
      ["Turf Tigers","Goal Diggers","Red Raiders","Net Ninjas","Teal Titans","Boot Brigade","Golden Gladiators","Pitch Pandas","Blue Moon Mavericks","Sole Strikers","Cloud Chasers","Volley Vipers","Signal Squad","Kickstarters","Data Dynamos","Corner Kings"],
      2,
      2,
    ),
    gallery: gallery(
      [footballImg, raceImg, cricketImg, footballImg],
      ["Evening kick-off", "Counter-attack", "Sideline tactics", "Full-time whistle"],
    ),
    videos: [
      { title: "Round 2 · Best goals", duration: "3:05", poster: footballImg, meta: "12 goals, 6 matches" },
      { title: "Golden goal in the QF", duration: "1:12", poster: raceImg, meta: "Turf Tigers vs Net Ninjas" },
    ],
  },
  {
    slug: "badminton",
    sport: "Badminton",
    name: "Shuttle Masters",
    tagline: "Five nights under the lights at 11 Point Club.",
    dates: "21 – 25 Sep 2026",
    day: "Mon – Fri",
    time: "6:00 PM – 9:30 PM",
    venue: "11 Point Club",
    venueNote: "Kaverappa Layout, Kadubeesanahalli",
    format: "Knockout · Singles",
    teams: "16 players",
    image: badmintonImg,
    accent: "sky",
    about:
      "Singles knockout played across five evenings on four courts. Best of three games to 21, with the final on centre court on Friday night.",
    info: [
      { label: "Format", value: "Best of 3 to 21" },
      { label: "Courts", value: "4 wooden courts" },
      { label: "Shuttle", value: "Feather, tournament grade" },
      { label: "Final", value: "Fri, centre court" },
    ],
    rounds: buildRounds(singlesPlayers, 3, 3),
    gallery: gallery(
      [badmintonImg, ttImg, indoorImg, badmintonImg, raceImg, footballImg],
      ["Opening smash", "Between games", "Courtside crowd", "Deciding rally", "Warm-up drills", "Post-match handshake"],
    ),
    videos: [
      { title: "Semi-Final 1 · Extended rally", duration: "2:24", poster: badmintonImg, meta: "42-shot rally, game point" },
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
    about:
      "Two weeks of after-hours table tennis in the ground floor cafeteria. Best of five to 11, two tables running in parallel.",
    info: [
      { label: "Format", value: "Best of 5 to 11" },
      { label: "Tables", value: "2 in parallel" },
      { label: "Service", value: "2 serves each" },
      { label: "Final", value: "09 Sep, 6:00 PM" },
    ],
    rounds: buildRounds(singlesPlayers, 4, -1),
    gallery: gallery([ttImg, indoorImg, badmintonImg, ttImg], ["Rally at table one", "Crowd at the final", "Serve, match point", "Trophy handover"]),
    videos: [{ title: "Final · Full match", duration: "18:05", poster: ttImg, meta: "Dev P. vs Aayansh R." }],
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
    about:
      "Rapid knockout chess. Ten minutes per side with a five-second increment; a single blitz game decides any drawn pairing.",
    info: [
      { label: "Time control", value: "10 min + 5 sec" },
      { label: "Rounds", value: "5 knockout rounds" },
      { label: "Draw rule", value: "Blitz decider" },
      { label: "Boards", value: "8 boards" },
    ],
    rounds: buildRounds(singlesPlayers, 2, 2),
    gallery: gallery([indoorImg, ttImg, cricketImg, indoorImg], ["Board one, round two", "Clock pressure", "Analysis after play", "Quiet concentration"]),
    videos: [{ title: "Round 2 · Board one recap", duration: "6:30", poster: indoorImg, meta: "Queen sacrifice on move 24" }],
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
    format: "Knockout · Singles",
    teams: "16 players",
    image: indoorImg,
    accent: "ember",
    about:
      "Singles carrom on four boards. First to 21 points or two boards, with the queen to be covered as per standard rules.",
    info: [
      { label: "Format", value: "First to 21 points" },
      { label: "Boards", value: "4 boards" },
      { label: "Queen", value: "Must be covered" },
      { label: "Break", value: "Alternating" },
    ],
    rounds: buildRounds(singlesPlayers, 1, 1),
    gallery: gallery([indoorImg, ttImg, cricketImg], ["Opening break", "Queen pocketed", "Board four finish"]),
    videos: [{ title: "Trick shots of week one", duration: "1:48", poster: indoorImg, meta: "Round 1 highlights" }],
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
    about:
      "Classic 501, straight in and double out. Best of three legs through the ladder, best of five in the final.",
    info: [
      { label: "Game", value: "501, double out" },
      { label: "Legs", value: "Best of 3" },
      { label: "Boards", value: "2 bristle boards" },
      { label: "Final", value: "Best of 5 legs" },
    ],
    rounds: buildRounds(singlesPlayers, 2, -1),
    gallery: gallery([indoorImg, ttImg, footballImg], ["Checkout attempt", "Scoreboard duty", "Crowd at the board"]),
    videos: [{ title: "170 checkout", duration: "0:44", poster: indoorImg, meta: "Round 2 · Deep Patel" }],
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
    about:
      "Sprint heats through the morning, relay ladder in the afternoon. Sixteen four-person teams race the knockout relay to a Sunday evening final.",
    info: [
      { label: "Events", value: "100m, 200m, 4×100 relay" },
      { label: "Team size", value: "4 runners" },
      { label: "Surface", value: "Marked grass track" },
      { label: "Heats", value: "Morning, 7:00 AM" },
    ],
    rounds: buildRounds(
      ["Blue Moon Mavericks","Sprint Squad","Golden Gladiators","Baton Bandits","Red Raiders","Track Pack","Teal Titans","Pace Makers","Cloud Chasers","Relay Rebels","Signal Squad","Fast Lane","Data Dynamos","Split Timers","Bid Blazers","Finish Line"],
      3,
      -1,
    ),
    gallery: gallery([raceImg, footballImg, cricketImg, raceImg], ["Heat one off the blocks", "Baton exchange", "Cheering the anchor leg", "Photo finish"]),
    videos: [
      { title: "Relay semi-finals", duration: "7:20", poster: raceImg, meta: "Four teams, two spots" },
      { title: "100m final · slow motion", duration: "0:52", poster: footballImg, meta: "Decided by 0.04s" },
    ],
  },
];

export const heroGallery = images;

export function getTournament(slug: string) {
  return tournaments.find((t) => t.slug === slug);
}

export const eventTeams = teamNames;
