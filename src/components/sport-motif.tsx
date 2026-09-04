/**
 * Line-work motif for a tournament masthead — a carrom board, a court, a track.
 *
 * Replaces the stock photography: it is on-brand, needs no image assets, costs
 * nothing to load, and gives each sport its own identity rather than a generic
 * picture of an office.
 *
 * Draws in `currentColor`, so the caller controls colour and opacity.
 */

import type * as React from "react";

type MotifProps = { slug: string; className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  vectorEffect: "non-scaling-stroke" as const,
};

/** Carrom / chess — a board seen square on. */
function BoardMotif() {
  return (
    <>
      <rect x="10" y="10" width="180" height="180" rx="4" {...stroke} />
      <rect x="28" y="28" width="144" height="144" rx="2" {...stroke} />
      <circle cx="100" cy="100" r="30" {...stroke} />
      <circle cx="100" cy="100" r="17" {...stroke} />
      <circle cx="100" cy="100" r="3.5" fill="currentColor" stroke="none" />
      {[
        [28, 28],
        [172, 28],
        [28, 172],
        [172, 172],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="9" {...stroke} />
      ))}
      <path d="M46 46 L74 74 M154 46 L126 74 M46 154 L74 126 M154 154 L126 126" {...stroke} />
    </>
  );
}

/** Chess — the checkered grid. */
function ChessMotif() {
  const cells = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={10 + c * 22.5}
          y={10 + r * 22.5}
          width="22.5"
          height="22.5"
          fill="currentColor"
          opacity="0.28"
        />,
      );
    }
  }
  return (
    <>
      {cells}
      <rect x="10" y="10" width="180" height="180" {...stroke} />
    </>
  );
}

/** Badminton / table tennis — a court with its net and service lines. */
function CourtMotif() {
  return (
    <>
      <rect x="18" y="26" width="164" height="148" rx="2" {...stroke} />
      <path d="M18 100 H182" {...stroke} strokeDasharray="6 5" />
      <path d="M18 62 H182 M18 138 H182 M100 26 V62 M100 138 V174" {...stroke} />
      <rect x="40" y="26" width="120" height="148" {...stroke} opacity="0.55" />
    </>
  );
}

/** Cricket — an oval boundary, the ring, and the strip down the middle. */
function GroundMotif() {
  return (
    <>
      <ellipse cx="100" cy="100" rx="88" ry="76" {...stroke} />
      {/* The fielding ring, set back the way the thirty-yard circle sits. */}
      <ellipse cx="100" cy="100" rx="47" ry="41" {...stroke} opacity="0.55" />
      {/* The strip, with a crease and a set of stumps at each end. */}
      <rect x="90" y="68" width="20" height="64" {...stroke} />
      <path d="M84 82 H116 M84 118 H116" {...stroke} />
      <path d="M94 68 V76 M100 68 V76 M106 68 V76" {...stroke} />
      <path d="M94 124 V132 M100 124 V132 M106 124 V132" {...stroke} />
    </>
  );
}

/** Football — centre circle, halfway line, penalty arcs. */
function FieldMotif() {
  return (
    <>
      <rect x="12" y="24" width="176" height="152" rx="3" {...stroke} />
      <path d="M100 24 V176" {...stroke} />
      <circle cx="100" cy="100" r="34" {...stroke} />
      <circle cx="100" cy="100" r="3" fill="currentColor" stroke="none" />
      <path d="M12 66 H48 V134 H12" {...stroke} />
      <path d="M188 66 H152 V134 H188" {...stroke} />
      <path d="M48 82 A 26 26 0 0 1 48 118" {...stroke} />
      <path d="M152 82 A 26 26 0 0 0 152 118" {...stroke} />
    </>
  );
}

/** Races & relay — lane lines curving through a bend. */
function TrackMotif() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={20 + i * 15}
          y={40 + i * 12}
          width={160 - i * 30}
          height={120 - i * 24}
          rx={(120 - i * 24) / 2}
          {...stroke}
          opacity={1 - i * 0.12}
        />
      ))}
      <path d="M100 40 V28 M100 160 V172" {...stroke} />
    </>
  );
}

/** Darts — the board's rings and segments. */
function DartsMotif() {
  return (
    <>
      {[88, 70, 52, 30, 13].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} {...stroke} />
      ))}
      <circle cx="100" cy="100" r="5" fill="currentColor" stroke="none" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i * Math.PI) / 5;
        return (
          <path
            key={i}
            d={`M${100 + Math.cos(a) * 30} ${100 + Math.sin(a) * 30} L${100 + Math.cos(a) * 88} ${100 + Math.sin(a) * 88}`}
            {...stroke}
          />
        );
      })}
    </>
  );
}

/** Foosball — the table from above: rods across it, men on them, a goal each end. */
function FoosballMotif() {
  // Each rod and the men bolted to it — 1-2-3-3-2-1 out from the goals, the way
  // a table is actually strung. The two inner rods stand clear of the centre
  // circle so the men beside it read as men rather than smudging into the line.
  const rods: [x: number, men: number[]][] = [
    [34, [100]],
    [56, [70, 130]],
    [78, [58, 100, 142]],
    [122, [58, 100, 142]],
    [144, [70, 130]],
    [166, [100]],
  ];
  return (
    <>
      <rect x="12" y="26" width="176" height="148" rx="3" {...stroke} />
      <path d="M100 26 V174" {...stroke} />
      <circle cx="100" cy="100" r="16" {...stroke} />
      <circle cx="100" cy="100" r="3" fill="currentColor" stroke="none" />
      {/* Goal mouths, cut into each end. */}
      <path d="M12 76 H26 V124 H12" {...stroke} />
      <path d="M188 76 H174 V124 H188" {...stroke} />
      {rods.map(([x, men]) => (
        <g key={x}>
          {/* The rod overhangs the table, as it does in the room. */}
          <path d={`M${x} 16 V184`} {...stroke} opacity="0.6" />
          {men.map((y) => (
            <rect
              key={y}
              x={x - 5}
              y={y - 9}
              width="10"
              height="18"
              rx="3"
              fill="currentColor"
              stroke="none"
              opacity="0.85"
            />
          ))}
        </g>
      ))}
    </>
  );
}

/** "TT Men's Singles" and "tt-mens-singles" both reduce to "ttmenssingles". */
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Callers hold a *tournament* slug — "tt-mens-singles", "fooseball", "Chess" —
 * while a motif belongs to a *sport*. Match on a normalised prefix so a slug
 * that names its sport and then its category still lands on the right mark, and
 * so a capital letter or a misspelling in the sheet doesn't silently fall
 * through to the carrom board.
 */
const MOTIFS: { keys: string[]; motif: () => React.ReactElement }[] = [
  { keys: ["carrom"], motif: BoardMotif },
  { keys: ["chess"], motif: ChessMotif },
  { keys: ["badminton"], motif: CourtMotif },
  { keys: ["tabletennis", "tt"], motif: CourtMotif },
  { keys: ["cricket"], motif: GroundMotif },
  { keys: ["football"], motif: FieldMotif },
  { keys: ["race", "relay"], motif: TrackMotif },
  { keys: ["dart"], motif: DartsMotif },
  // The sheet spells it "fooseball"; both spellings resolve.
  { keys: ["foosball", "fooseball"], motif: FoosballMotif },
];

function motifFor(slug: string) {
  const key = norm(slug);
  return MOTIFS.find((entry) => entry.keys.some((k) => key.startsWith(k)))?.motif ?? BoardMotif;
}

/**
 * Chess, as the pieces rather than the board.
 *
 * The board motif is right for a masthead, where it is 300px of fine line-work.
 * Struck into a 64px medal face those 64 squares collapse into a grey texture.
 * Real chess medals put a group of pieces in relief instead, so this does the
 * same in flat silhouette: rook, king and queen standing on a ground line, the
 * king tallest in the middle. Three reads at this size where six would mush.
 */
function ChessEmblem() {
  return (
    <g fill="currentColor" stroke="none" transform="translate(2,-14)">
      {/* Rook — the battlement is the whole tell. */}
      <path d="M32 96h9v7h6v-7h9v7h6v-7h9v21H32Z" />
      <rect x="29" y="117" width="45" height="6" rx="1" />
      <path d="M38 123c-2 14-2 26-4 34h35c-2-8-2-20-4-34Z" />
      <rect x="28" y="157" width="47" height="9" rx="3" />
      <rect x="25" y="168" width="53" height="8" rx="3" />

      {/* King — centre and tallest, cross finial on top. */}
      <rect x="96" y="48" width="8" height="24" rx="2" />
      <rect x="88" y="55" width="24" height="8" rx="2" />
      <circle cx="100" cy="88" r="15" />
      <path d="M90 100h20l3 12H87Z" />
      <path d="M91 116h18c0 16 6 30 13 40H78c7-10 13-24 13-40Z" />
      <rect x="80" y="156" width="40" height="10" rx="3" />
      <rect x="76" y="168" width="48" height="8" rx="3" />

      {/* Queen — the coronet, and the pearl above it. */}
      <circle cx="146" cy="76" r="5" />
      <path d="M132 106l3-18 5 11 6-17 6 17 5-11 3 18Z" />
      <rect x="131" y="104" width="30" height="7" rx="2" />
      <path d="M135 111c-2 18-4 32-7 46h40c-3-14-5-28-7-46Z" />
      <rect x="126" y="157" width="42" height="9" rx="3" />
      <rect x="123" y="168" width="48" height="8" rx="3" />

      {/* The board they stand on. */}
      <rect x="26" y="176" width="148" height="5" rx="2" />
    </g>
  );
}

/**
 * Foosball, as the man on the rod rather than the table.
 *
 * Same reasoning as the chess pieces: struck into a 64px face, the table's six
 * rods and their thirteen men collapse into a grey band. One figure with the
 * rod through its shoulders is the shape everybody recognises, and it survives
 * being shrunk.
 */
function FoosballEmblem() {
  return (
    <g fill="currentColor" stroke="none">
      {/* The rod, running the full width through the shoulders. */}
      <rect x="18" y="70" width="164" height="13" rx="6.5" />
      <circle cx="100" cy="46" r="17" />
      <rect x="93" y="58" width="14" height="14" />
      {/* Torso — square shoulders tapering to the waist. */}
      <path d="M76 68h48l-5 46H81Z" />
      {/* Legs, planted apart. */}
      <path d="M81 118h16l-3 52H72Z" />
      <path d="M103 118h16l9 52h-22Z" />
      <rect x="64" y="168" width="34" height="11" rx="4" />
      <rect x="102" y="168" width="34" height="11" rx="4" />
    </g>
  );
}

/**
 * Cricket, as the kit rather than the ground.
 *
 * The masthead falls back on a field, which for cricket draws a football pitch
 * — halfway line, penalty boxes and all. Medals put the kit on the face
 * instead. The three pieces stand side by side rather than crossing: struck in
 * one colour, a bat laid over the stumps merges into a single blob.
 */
function CricketEmblem() {
  return (
    <g fill="currentColor" stroke="none">
      {/* The bat, leaning in from the left. */}
      <g transform="rotate(-10 42 170)">
        <rect x="36" y="40" width="12" height="46" rx="6" />
        <rect x="26" y="80" width="32" height="90" rx="11" />
      </g>
      <circle cx="90" cy="154" r="16" />
      {/* Two bails over three stumps. */}
      <rect x="121" y="42" width="33" height="8" rx="4" />
      <rect x="145" y="42" width="33" height="8" rx="4" />
      <rect x="120" y="52" width="11" height="118" rx="5.5" />
      <rect x="144" y="52" width="11" height="118" rx="5.5" />
      <rect x="168" y="52" width="11" height="118" rx="5.5" />
      {/* The crease they all stand on. */}
      <rect x="16" y="170" width="170" height="8" rx="4" />
    </g>
  );
}

/**
 * Football, as the boot and the ball.
 *
 * The ball's centre panel is punched out with `evenodd` rather than drawn on
 * top of it: the emblem only ever has one colour to work with, so the only way
 * to put a mark inside a solid shape is to take metal away. One pentagon is
 * enough — the surrounding hexagons would be a unit across at this size and
 * would close up under the strike.
 */
/**
 * Football, as the boot and the ball.
 *
 * The ball is drawn the way a ball is drawn — a ring, the centre panel, and the
 * seams running off its corners. Solid, with the panel punched out of it, it
 * read as a full stop. The seams stop at the ring rather than crossing it, so
 * the outline stays unbroken when the die closes them up.
 */
function FootballEmblem() {
  return (
    <g fill="currentColor" stroke="none">
      <circle cx="136" cy="84" r="41" fill="none" stroke="currentColor" strokeWidth="9" />
      <path d="M136 68 151.2 79.1 145.4 96.9 126.6 96.9 120.8 79.1Z" />
      <path
        d="M136 68 136 47.5M151.2 79.1 170.7 72.7M145.4 96.9 157.5 113.5M126.6 96.9 114.5 113.5M120.8 79.1 101.3 72.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      {/* The boot, sat close under it: collar, instep, sole out to the toe. */}
      <path d="M32 100 62 100 74 128C100 145 128 151 156 153L158 165 32 165C24 165 22 157 22 148L22 112C22 105 26 100 32 100Z" />
      <rect x="34" y="165" width="16" height="10" rx="3" />
      <rect x="78" y="165" width="16" height="10" rx="3" />
      <rect x="128" y="165" width="16" height="10" rx="3" />
    </g>
  );
}
/**
 * One laurel sprig, curving up the left of a mark. The right is this mirrored,
 * so the pair can never drift apart.
 *
 * Four leaves, not the dozen a real wreath carries: at the strike a leaf is
 * about five pixels long, and a dozen of them close into a solid crescent.
 */
function LaurelBranch() {
  return (
    <>
      <path
        d="M70 184C48 172 32 150 25 98"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {[
        [54, 168, 36],
        [41, 150, 55],
        [31, 126, 72],
        [25, 100, 83],
      ].map(([x, y, angle]) => (
        <ellipse
          key={angle}
          cx={x}
          cy={y}
          rx="13"
          ry="6.5"
          transform={`rotate(${angle} ${x} ${y})`}
        />
      ))}
    </>
  );
}

/**
 * Badminton, as the shuttle in a wreath.
 *
 * Five feathers rather than the sixteen a real shuttle has: spaced at 16° they
 * still hold a couple of units of daylight between them once struck, where a
 * full skirt would close into a solid cone.
 *
 * The laurels sit where the shuttle is narrowest — up the sides of the cork,
 * below the flare of the skirt — so the two never have to share space.
 */
function ShuttleEmblem() {
  return (
    <g fill="currentColor" stroke="none">
      {[-32, -16, 0, 16, 32].map((angle) => (
        <path
          key={angle}
          transform={`rotate(${angle} 100 158)`}
          d="M94 146 106 146 111 40 89 40Z"
        />
      ))}
      {/* The cork, rounded off the way it leaves the racket. */}
      <path d="M76 140h48v12a24 24 0 0 1-48 0Z" />
      <LaurelBranch />
      <g transform="translate(200 0) scale(-1 1)">
        <LaurelBranch />
      </g>
    </g>
  );
}

/**
 * One bat: the blade, its detailing, and the handle laid over the top of it.
 *
 * A plain disc strikes as a plain disc, so the blade carries the two lines a
 * real bat shows — the straight edge of the rubber up by the handle, and the
 * edge tape following the rim below. Both are cut out of the blade with
 * `evenodd` rather than drawn over it: the emblem has one colour, so a line
 * has to be metal taken away. Neither runs quite to the blade's edge, which
 * would break the outline the eye reads the shape from.
 *
 * The handle goes on after the blade and crosses the straight groove, leaving
 * it as two segments — which is what the eye expects, the rubber carrying on
 * behind the handle.
 *
 * `x` is the blade's centre, and everything is drawn around it, so the pair
 * are two placements of one shape rather than two shapes kept in step by hand.
 */
function TableTennisBat({ x, lean }: { x: number; lean: number }) {
  const at = (n: number) => n + x - 56;
  return (
    <g transform={`rotate(${lean} ${x} 126)`}>
      <path
        fillRule="evenodd"
        d={
          `M${at(19)} 126a37 37 0 1 0 74 0 37 37 0 1 0-74 0Z` +
          `M${at(26)} 108h60v8h-60Z` +
          `M${at(86.9)} 134.28A32 32 0 0 1 ${at(25.1)} 134.28` +
          `L${at(31.85)} 132.47A25 25 0 0 0 ${at(80.15)} 132.47Z`
        }
      />
      <rect x={at(48)} y="34" width="16" height="100" rx="8" />
    </g>
  );
}

/**
 * Table tennis, as two bats and the ball.
 *
 * The two bats stand apart and stay apart: they lean towards each other, but
 * the handles stop a good thirty units short of meeting, and the blades keep
 * daylight down the middle. Crossed into an X the pair struck as one shape.
 * The ball sits below and between them, clear of both blades.
 */
function TableTennisEmblem() {
  return (
    <g fill="currentColor" stroke="none">
      <TableTennisBat x={56} lean={12} />
      <TableTennisBat x={144} lean={-12} />
      <circle cx="100" cy="170" r="13" />
    </g>
  );
}

/** Limbs are drawn as round-capped strokes: at this size a joint reads better
 *  as one thick line than as an outline that has to stay open. */
const limb: React.SVGProps<SVGPathElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Races — the sprinter, mid-stride. */
function RunnerEmblem() {
  return (
    <g>
      <circle cx="140" cy="46" r="16" fill="currentColor" />
      <path d="M126 68 100 118" {...limb} strokeWidth="24" />
      <path d="M126 72 98 86 70 72" {...limb} strokeWidth="14" />
      <path d="M126 72 156 88 170 64" {...limb} strokeWidth="14" />
      <path d="M100 118 70 138 42 152" {...limb} strokeWidth="18" />
      <path d="M100 118 138 126 146 164" {...limb} strokeWidth="18" />
      <path d="M42 152 24 168" {...limb} strokeWidth="12" />
      <path d="M146 164 170 170" {...limb} strokeWidth="12" />
    </g>
  );
}

/** Sports whose medal face wants its own mark rather than the masthead motif. */
const EMBLEMS: { keys: string[]; emblem: () => React.ReactElement }[] = [
  { keys: ["chess"], emblem: ChessEmblem },
  { keys: ["foosball", "fooseball"], emblem: FoosballEmblem },
  { keys: ["cricket"], emblem: CricketEmblem },
  { keys: ["football"], emblem: FootballEmblem },
  { keys: ["badminton"], emblem: ShuttleEmblem },
  { keys: ["tabletennis", "tt"], emblem: TableTennisEmblem },
  { keys: ["race", "relay"], emblem: RunnerEmblem },
];

/**
 * What gets struck into a medal face: the sport's emblem where one is drawn,
 * otherwise the masthead motif, which holds up fine for the open shapes that
 * are left — the carrom board, the darts board.
 */
export function SportEmblemShapes({ slug }: { slug: string }) {
  const key = norm(slug);
  const Emblem = EMBLEMS.find((entry) => entry.keys.some((k) => key.startsWith(k)))?.emblem;
  return Emblem ? <Emblem /> : <SportMotifShapes slug={slug} />;
}

/**
 * The bare line-work, without an `<svg>` around it, so a caller that is already
 * drawing in SVG can place it inside their own coordinate system — the medal
 * disc strikes it into the face at a fraction of its natural size.
 */
export function SportMotifShapes({ slug }: { slug: string }) {
  const Motif = motifFor(slug);
  return <Motif />;
}

export function SportMotif({ slug, className }: MotifProps) {
  const Motif = motifFor(slug);
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden
      focusable="false"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <Motif />
    </svg>
  );
}
