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

/** Cricket / football — centre circle, halfway line, penalty arcs. */
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

const MOTIFS: Record<string, () => React.ReactElement> = {
  carrom: BoardMotif,
  chess: ChessMotif,
  badminton: CourtMotif,
  "table-tennis": CourtMotif,
  cricket: FieldMotif,
  football: FieldMotif,
  "races-relay": TrackMotif,
  darts: DartsMotif,
};

export function SportMotif({ slug, className }: MotifProps) {
  const Motif = MOTIFS[slug] ?? BoardMotif;
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
