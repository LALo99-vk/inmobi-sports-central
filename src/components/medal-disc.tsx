/**
 * A struck medal, drawn rather than photographed.
 *
 * The champions page has no head-shots to work with and no prospect of
 * collecting 54 of them before the day, so the medal itself is the portrait.
 * Four things have to read at once, and each gets its own channel so none of
 * them fight:
 *
 *   ribbon → the house      metal → the medal
 *   face   → the sport      rim   → the person
 *
 * Keeping the house on the ribbon rather than the ring is the load-bearing
 * decision: Golden Gladiators is `#C8951E`, near enough to gold that a
 * house-coloured ring would make every GG silver look like a first place.
 */
import { useId, type Ref } from "react";

import type { Medal } from "@/data/tournaments";
import { InMobiLoopShapes } from "@/components/inmobi-mark";
import { SportEmblemShapes } from "@/components/sport-motif";
import { cn } from "@/lib/utils";

/** Struck-metal ramps: highlight, body, shadow, edge, and the engraved line. */
const METAL: Record<Medal, { lite: string; mid: string; dark: string; deep: string; ink: string }> =
  {
    gold: { lite: "#F6E2AC", mid: "#D8AC44", dark: "#936D18", deep: "#5F4409", ink: "#4A340A" },
    silver: { lite: "#F2F5F8", mid: "#BFC6CE", dark: "#87909B", deep: "#5A626B", ink: "#464D55" },
    bronze: { lite: "#F1CCA4", mid: "#C9884F", dark: "#8E5628", deep: "#603818", ink: "#4C2C12" },
  };

/**
 * Three marks share the recessed field, stacked and each given its own band so
 * none of them touch: the InMobi loop stamped at the top, the sport's emblem
 * through the middle, the wordmark seated underneath.
 *
 * MARK_BOX is the loop's measured bounding box inside the logo's own 122x19
 * coordinate space — read off `getBBox()`, not eyeballed.
 */
/**
 * The loop, struck under the word: 26 across, which is where its open middle
 * and the slivers where the strokes cross still survive the emboss. Below that
 * the second pass closes them and it strikes as a solid blob.
 *
 * MARK_BOX is the loop's measured bounding box inside the logo's own 122x19
 * coordinate space — read off `getBBox()`, not eyeballed.
 */
const MARK_BOX = { x: 67.223, y: 0.5, width: 25.25 };
const MARK_W = 26;
const MARK_K = MARK_W / MARK_BOX.width;
const MARK_X = 100 - MARK_W / 2;
const MARK_Y = 189;

/** The emblem takes the top of the field, above the word. */
const EMBLEM_K = 0.26;
const EMBLEM_X = 100 - (200 * EMBLEM_K) / 2;
const EMBLEM_Y = 116;

/** A die leaves the metal raised on one edge: a light pass above a dark one. */
const strike = (x: number, y: number, dx: number, dy: number) => `translate(${x + dx}, ${y + dy})`;

/** Darkens a hex colour for the shaded half of the ribbon. */
function shade(hex: string, amount: number): string {
  const value = parseInt(hex.replace("#", ""), 16);
  if (!Number.isFinite(value)) return hex;
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * amount);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/**
 * What gets engraved around the rim.
 *
 * The arc holds roughly 18 characters at full size. Past that a singles name
 * sets as "Arjun K." and a pair as "Iyer · Shah" — the full names are always
 * spelled out under the disc, so nothing is lost by abbreviating here.
 */
function rimLabel(names: string[], fallback: string): string {
  const surname = (name: string) => name.trim().split(/\s+/).slice(-1)[0] ?? name;

  if (!names.length) return fallback.toUpperCase();

  if (names.length > 1) {
    const pair = names.map(surname).join(" · ");
    const initials = names.map((name) => surname(name)[0] ?? "").join(" · ");
    return (pair.length <= 20 ? pair : initials).toUpperCase();
  }

  const full = names[0]?.trim() ?? "";
  if (full.length <= 18) return full.toUpperCase();

  const parts = full.split(/\s+/);
  const last = parts.length > 1 ? `${parts[parts.length - 1]?.[0] ?? ""}.` : "";
  return `${parts[0]} ${last}`.trim().toUpperCase();
}

export type MedalDiscProps = {
  medal: Medal;
  /** The winning house's colour, straight off the Groups tab. */
  houseColor: string;
  /** Falls back onto the rim when a team sport has no individual winner. */
  houseName: string;
  /** Route slug, so the face carries this sport's own line-work. */
  sportSlug: string;
  /** Who won it: one name for a singles event, both for a pair. */
  names: string[];
  /** Curved along the bottom rim — the medal and the year. */
  foot: string;
  /** Spoken description; the visible name always sits below the disc. */
  label: string;
  className?: string;
  /** So the podium can paint a shareable poster from the disc on screen. */
  ref?: Ref<SVGSVGElement>;
};

export function MedalDisc({
  medal,
  houseColor,
  houseName,
  sportSlug,
  names,
  foot,
  label,
  className,
  ref,
}: MedalDiscProps) {
  // Gradients are per-instance: a page holds three discs in three metals, and
  // shared ids would strike all of them in whichever landed last.
  const uid = useId().replace(/:/g, "");
  const metal = METAL[medal];

  const rim = rimLabel(names, houseName);
  // The arc holds about 18 characters before it starts crowding the rim.
  const rimSize = rim.length > 15 ? 10.6 : rim.length > 11 ? 12 : 13.3;

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 246"
      role="img"
      aria-label={label}
      className={cn("block h-auto w-full", className)}
    >
      <defs>
        <linearGradient id={`${uid}-face`} x1="0.16" y1="0.03" x2="0.86" y2="0.98">
          <stop offset="0" stopColor={metal.lite} />
          <stop offset="0.34" stopColor={metal.mid} />
          <stop offset="0.62" stopColor={metal.dark} />
          <stop offset="0.82" stopColor={metal.mid} />
          <stop offset="1" stopColor={metal.deep} />
        </linearGradient>
        <linearGradient id={`${uid}-field`} x1="0.9" y1="0.05" x2="0.2" y2="1">
          <stop offset="0" stopColor={metal.dark} />
          <stop offset="0.45" stopColor={metal.mid} />
          <stop offset="1" stopColor={metal.deep} />
        </linearGradient>
        <radialGradient id={`${uid}-spec`} cx="0.3" cy="0.22" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* Left to right over the top of the rim, so the name reads upright. */}
        <path id={`${uid}-arc`} d="M 100,162 m -65,0 a 65,65 0 0,1 130,0" fill="none" />
        {/* Under the disc, sweeping the other way so the year reads upright too.
            Set flat it would run off the rim — the disc is only ~75 wide there. */}
        <path id={`${uid}-foot`} d="M 100,162 m -69,0 a 69,69 0 0,0 138,0" fill="none" />
      </defs>

      {/* The ribbon — the only place the house colour appears. */}
      <path d="M144,0 L112,0 L78,116 L110,116 Z" fill={shade(houseColor, 0.72)} />
      <path d="M56,0 L88,0 L122,116 L90,116 Z" fill={houseColor} />
      <path d="M56,0 L88,0 L74,48 L62,20 Z" fill="rgba(255,255,255,0.14)" />
      <rect
        x="92"
        y="70"
        width="16"
        height="20"
        rx="3"
        fill={`url(#${uid}-face)`}
        stroke={metal.deep}
        strokeWidth="1.2"
      />

      {/* The struck disc: outer rim, then the recessed inner field. */}
      <circle cx="100" cy="162" r="76" fill={`url(#${uid}-face)`} />
      <circle cx="100" cy="162" r="76" fill="none" stroke={metal.deep} strokeWidth="2" />
      <circle
        cx="100"
        cy="162"
        r="70.5"
        fill="none"
        stroke={metal.lite}
        strokeWidth="1"
        opacity="0.5"
      />
      <circle cx="100" cy="162" r="54" fill={`url(#${uid}-field)`} />
      <circle
        cx="100"
        cy="162"
        r="54"
        fill="none"
        stroke={metal.deep}
        strokeWidth="1.6"
        opacity="0.85"
      />
      <circle
        cx="100"
        cy="162"
        r="50"
        fill="none"
        stroke={metal.lite}
        strokeWidth="0.9"
        opacity="0.35"
      />

      {/* The sport's own line-work — the board, the court, the track — across
          the top of the field. */}
      {(
        [
          [-0.4, -0.9, metal.lite, 0.5],
          [0.4, 0.9, metal.ink, 0.62],
        ] as const
      ).map(([dx, dy, tone, opacity]) => (
        <g
          key={String(tone)}
          transform={`${strike(EMBLEM_X, EMBLEM_Y, dx, dy)} scale(${EMBLEM_K})`}
          color={tone}
          opacity={opacity}
        >
          <SportEmblemShapes slug={sportSlug} />
        </g>
      ))}

      {/* Whose sports day it is, seated under the emblem. The rest of the mark
          — "SPORTS DAY · 2026" — runs around the bottom rim, where a struck
          medal names its event. */}
      <g fontFamily="var(--font-display)" fontWeight="900" fontSize="11.5" letterSpacing="1.4">
        <text x="99.2" y="182.2" textAnchor="middle" fill={metal.lite} opacity="0.5">
          INMOBI
        </text>
        <text x="100" y="183" textAnchor="middle" fill={metal.ink} opacity="0.9">
          INMOBI
        </text>
      </g>

      {/* The loop, struck last and lowest. Tighter offsets than the emblem: its
          counters are only a couple of units across, and a heavier second pass
          would fill them. */}
      {(
        [
          [-0.25, -0.45, metal.lite, 0.5],
          [0.25, 0.45, metal.ink, 0.85],
        ] as const
      ).map(([dx, dy, tone, opacity]) => (
        <g
          key={String(tone)}
          transform={`${strike(MARK_X - MARK_BOX.x * MARK_K, MARK_Y - MARK_BOX.y * MARK_K, dx, dy)} scale(${MARK_K})`}
          color={tone}
          opacity={opacity}
        >
          <InMobiLoopShapes />
        </g>
      ))}

      {/* Struck metal catches the light from the upper left. */}
      <circle
        cx="100"
        cy="162"
        r="76"
        fill={`url(#${uid}-spec)`}
        style={{ pointerEvents: "none" }}
      />

      {/* The engraving. */}
      <text
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize={rimSize}
        letterSpacing="1.7"
        fill={metal.ink}
        opacity="0.85"
      >
        <textPath href={`#${uid}-arc`} startOffset="50%" textAnchor="middle">
          {rim}
        </textPath>
      </text>
      <text
        fontFamily="var(--font-display)"
        fontWeight="700"
        fontSize="8.5"
        letterSpacing="2.6"
        fill={metal.ink}
        opacity="0.62"
      >
        <textPath href={`#${uid}-foot`} startOffset="50%" textAnchor="middle">
          {foot}
        </textPath>
      </text>
      <circle cx="30" cy="162" r="2.2" fill={metal.ink} opacity="0.5" />
      <circle cx="170" cy="162" r="2.2" fill={metal.ink} opacity="0.5" />
    </svg>
  );
}
