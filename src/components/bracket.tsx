import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Search, Trophy } from "lucide-react";

import type { BracketMatch, BracketRound, BracketSlot, ParticipantKind } from "@/data/tournaments";
import { buildSections, isByeMatch, searchText, slotLabel } from "@/lib/bracket-sections";
import { getGroup } from "@/data/tournaments";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/* Geometry — the whole ladder is laid out on one absolutely positioned canvas
   so the connectors can be drawn against exact card coordinates. */
const COL_W = 244;
const GUTTER = 72;
const HEAD_H = 28; // match card header strip
const BAND_H = 52; // round title band above the first card
const GAP = 16; // vertical gap between two first-round cards
const CORNER = 16; // connector corner radius
const CHAMP_W = 184;
const ARROW = 9;
/** Cards in one column never sit further apart than this many card-heights. */
const MAX_GAP_FACTOR = 2;
/** How far present mode may enlarge the draw before the cards look blown up. */
const MAX_PRESENT_SCALE = 2.2;
/** …and how little it may enlarge it, however tall the draw is. */
const MIN_PRESENT_SCALE = 1.25;

type SegState = "decided" | "live" | "pending";
/** A search result: the fixture, and where in the draw it was found. */
type Hit = { match: BracketMatch; index: number; round: string; section: string };
type Segment = { key: string; d: string; state: SegState };
type Arrow = { key: string; x: number; y: number; state: SegState };
type Node = { key: string; x: number; y: number };

/**
 * One connector: out of the source card, across, and into the target card,
 * with rounded corners. Works for any pairing, so a match fed by a single
 * winner (a bye on the other side) draws just as cleanly as a classic pair.
 */
function edgePath(x1: number, y1: number, x2: number, y2: number) {
  if (Math.abs(y2 - y1) < 0.5) return `M ${x1} ${y1} H ${x2}`;
  const midX = x1 + (x2 - x1) / 2;
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.min(CORNER, Math.abs(y2 - y1) / 2, (midX - x1) * 0.9);
  return (
    `M ${x1} ${y1} H ${midX - r} Q ${midX} ${y1} ${midX} ${y1 + dir * r} ` +
    `V ${y2 - dir * r} Q ${midX} ${y2} ${midX + r} ${y2} H ${x2}`
  );
}

/**
 * A connector describes whether anyone has actually advanced along it, which is
 * the winner's job rather than the status column's. A match marked Completed
 * with no winner recorded has nobody flowing out of it yet, and a solid line
 * there would contradict the "Winner · M20" still sitting in the next card.
 */
function stateOf(match: BracketMatch): SegState {
  if (match.winner) return "decided";
  if (match.status === "live") return "live";
  return "pending";
}

/**
 * Pulls a column back together. Aligning every match to the average of its
 * feeders is correct but spreads later rounds over the full height of the first
 * round — by the Final you get one card floating in a void. Capping the gap and
 * re-centring keeps the shape readable without breaking the ordering.
 */
function compressColumn(ys: number[], maxGap: number): number[] {
  if (ys.length < 2) return ys;
  const out = [ys[0] as number];
  for (let i = 1; i < ys.length; i++) {
    const gap = Math.min((ys[i] as number) - (ys[i - 1] as number), maxGap);
    out.push((out[i - 1] as number) + gap);
  }
  const beforeMid = ((ys[0] as number) + (ys[ys.length - 1] as number)) / 2;
  const afterMid = ((out[0] as number) + (out[out.length - 1] as number)) / 2;
  const shift = beforeMid - afterMid;
  return out.map((y) => y + shift);
}

/**
 * Places one column. Each match wants to sit level with the average of the
 * matches feeding it; anything unanchored is interpolated from its neighbours.
 * A final pass pushes overlapping cards apart while keeping sheet order.
 */
function resolveColumn(desired: (number | null)[], minGap: number, minY: number): number[] {
  const n = desired.length;
  const out: number[] = new Array(n).fill(minY);
  const anchored = desired.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);

  for (let i = 0; i < n; i++) {
    const own = desired[i];
    if (own !== null && own !== undefined) {
      out[i] = own;
      continue;
    }
    if (anchored.length === 0) {
      out[i] = minY + i * minGap;
      continue;
    }
    const before = [...anchored].reverse().find((k) => k < i);
    const after = anchored.find((k) => k > i);
    if (before !== undefined && after !== undefined) {
      const from = desired[before] as number;
      const to = desired[after] as number;
      out[i] = from + ((to - from) * (i - before)) / (after - before);
    } else if (before !== undefined) {
      out[i] = (desired[before] as number) + (i - before) * minGap;
    } else if (after !== undefined) {
      out[i] = (desired[after] as number) - (after - i) * minGap;
    }
  }

  out[0] = Math.max(out[0] as number, minY);
  for (let i = 1; i < n; i++) {
    out[i] = Math.max(out[i] as number, (out[i - 1] as number) + minGap);
  }
  return out;
}

const STROKE: Record<SegState, { color: string; width: number; dash?: string; opacity?: number }> =
  {
    decided: { color: "var(--accent)", width: 3 },
    live: { color: "var(--live)", width: 3, dash: "8 7" },
    // Muted foreground rather than --border: a hairline border colour all but
    // disappears against the cream background.
    pending: { color: "var(--muted-foreground)", width: 2, dash: "5 6", opacity: 0.32 },
  };

function StatusTag({ status, compact }: { status: BracketMatch["status"]; compact: boolean }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-live">
        <span className="live-dot inline-block size-1.5 rounded-full bg-live" />
        Live
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-accent/90">
        Final
      </span>
    );
  }
  // Dropped on narrow screens so the scheduled time isn't truncated instead.
  if (compact) return null;
  return (
    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
      Upcoming
    </span>
  );
}

function SlotRow({
  slot,
  kind,
  isWinner,
  status,
  height,
  compact,
}: {
  slot: BracketSlot;
  kind: ParticipantKind;
  isWinner: boolean;
  status: BracketMatch["status"];
  height: number;
  compact: boolean;
}) {
  const decided = status === "completed";
  const dimmed = decided && !isWinner;
  const doubles = kind === "doubles" && (slot.players?.length ?? 0) > 1;
  const group = getGroup(slot.group);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5",
        isWinner && "bg-accent/[0.07]",
        dimmed && "text-muted-foreground",
      )}
      style={{ height }}
    >
      {/* House colour rail — the group identity, always visible */}
      <span
        className="w-[3px] shrink-0 rounded-full transition-opacity"
        style={{
          height: doubles ? 26 : 18,
          backgroundColor: group?.color ?? "var(--border)",
          opacity: !slot.players ? 0.25 : dimmed ? 0.45 : 1,
        }}
      />

      {group && slot.players && (
        <span
          title={group.name}
          className={cn(
            "shrink-0 font-display text-[0.58rem] font-extrabold tracking-[0.04em]",
            compact ? "w-[22px]" : "w-[26px]",
          )}
          style={{
            // darken the house colour for the label so 10px text stays legible
            // on the cream background; the rail keeps the true colour
            color: `color-mix(in oklab, ${group.color} 78%, black)`,
            opacity: dimmed ? 0.6 : 1,
          }}
        >
          {group.code}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {slot.players ? (
          doubles ? (
            <div className="space-y-[1px]">
              {slot.players.map((p) => (
                <p
                  key={p}
                  title={p}
                  className={cn(
                    "truncate leading-[1.15]",
                    compact ? "text-[0.72rem]" : "text-[0.78rem]",
                    isWinner ? "font-semibold text-foreground" : "font-medium",
                  )}
                >
                  {p}
                </p>
              ))}
            </div>
          ) : (
            <p
              title={slot.players[0]}
              className={cn(
                "truncate text-[0.85rem]",
                isWinner ? "font-bold text-foreground" : "font-medium",
              )}
            >
              {slot.players[0]}
            </p>
          )
        ) : (
          <p className="truncate text-[0.78rem] italic text-muted-foreground/60">
            {slot.source ?? "To be decided"}
          </p>
        )}
      </div>

      {slot.viaBye && (
        <span
          title="Advanced without playing — no opponent in the previous round"
          className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80"
        >
          from bye
        </span>
      )}

      {slot.score !== null && slot.score !== undefined && (
        <span
          className={cn(
            "font-display text-[0.9rem] tabular-nums",
            isWinner
              ? "font-extrabold text-accent"
              : status === "live"
                ? "font-bold text-foreground/70"
                : "text-muted-foreground",
          )}
        >
          {slot.score}
        </span>
      )}
    </div>
  );
}

function MatchCard({
  match,
  kind,
  rowH,
  compact,
  courtLabel,
  highlighted,
  style,
}: {
  match: BracketMatch;
  kind: ParticipantKind;
  rowH: number;
  compact: boolean;
  courtLabel?: string | undefined;
  highlighted?: boolean | undefined;
  style: React.CSSProperties;
}) {
  const live = match.status === "live";
  const done = match.status === "completed";
  // Where first, then when: on a narrow card the tail is what gets truncated,
  // and "which board am I on" is the thing a player actually came to find out.
  const where = match.court ? [courtLabel, match.court].filter(Boolean).join(" ") : "";
  const meta = [where, match.time].filter(Boolean).join(" · ");

  return (
    <article
      style={style}
      className={cn(
        "card-in absolute overflow-hidden rounded-md border transition-all duration-200",
        // Matches that have happened come forward; ones still to come sit back,
        // so the eye lands on what is actually going on.
        live && "border-live/70 bg-card ring-2 ring-live/20 shadow-[0_4px_16px_-4px_var(--live)]",
        done &&
          "border-border bg-card shadow-[0_1px_3px_rgba(20,20,50,0.07)] hover:border-accent/60 hover:shadow-[0_4px_14px_-4px_rgba(20,20,50,0.16)]",
        !live && !done && "border-dashed border-border bg-card/55 hover:border-foreground/25",
        highlighted && "border-sky ring-2 ring-sky/35",
      )}
    >
      <div
        className="flex items-center gap-2 border-b border-border/70 bg-secondary/40 px-3"
        style={{ height: HEAD_H }}
      >
        <span className="font-display text-[0.6rem] font-extrabold tracking-[0.1em] text-muted-foreground/70">
          M{match.matchNumber}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.66rem] text-muted-foreground" title={meta}>
          {where && <span className="font-medium text-foreground/70">{where}</span>}
          {where && match.time && " · "}
          {match.time}
        </span>
        <StatusTag status={match.status} compact={compact} />
      </div>

      <div className="divide-y divide-border/60">
        <SlotRow
          slot={match.a}
          kind={kind}
          isWinner={match.winner === "a"}
          status={match.status}
          height={rowH}
          compact={compact}
        />
        <SlotRow
          slot={match.b}
          kind={kind}
          isWinner={match.winner === "b"}
          status={match.status}
          height={rowH}
          compact={compact}
        />
      </div>
    </article>
  );
}

function Ladder({
  rounds,
  kind,
  courtLabel,
  showChampion = true,
  highlight,
  fit = false,
}: {
  rounds: BracketRound[];
  kind: ParticipantKind;
  courtLabel?: string | undefined;
  /** A section of a draw ends in a quarter-finalist, not the trophy. */
  showChampion?: boolean;
  highlight?: Set<string>;
  /** Present mode: scale the whole ladder to the box instead of scrolling it. */
  fit?: boolean;
}) {
  // A 244px card leaves barely one column visible on a phone, so the whole
  // ladder tightens up on small screens rather than forcing endless swiping.
  const isMobile = useIsMobile();
  const colW = isMobile ? 214 : COL_W;
  const gutter = isMobile ? 40 : GUTTER;
  const pitch = colW + gutter;
  const champW = isMobile ? 150 : CHAMP_W;

  const rowH = kind === "doubles" ? (isMobile ? 44 : 46) : 40;
  const cardH = HEAD_H + rowH * 2;
  const slotH = cardH + GAP;

  const layout = useMemo(() => {
    type Placed = { match: BracketMatch; x: number; y: number };
    const placed = new Map<number, Placed>();
    const cards: Placed[] = [];

    rounds.forEach((round, r) => {
      const x = r * pitch;

      // Where each match would like to sit: level with whatever feeds it.
      const desired = round.matches.map((match) => {
        const ys = [match.a.fromMatch, match.b.fromMatch]
          .map((n) => (n === undefined ? undefined : placed.get(n)?.y))
          .filter((y): y is number => y !== undefined);
        if (!ys.length) return null;
        return ys.reduce((sum, y) => sum + y, 0) / ys.length;
      });

      const spread = resolveColumn(desired, slotH, BAND_H + cardH / 2);
      const ys = compressColumn(spread, slotH * MAX_GAP_FACTOR).map((y) =>
        Math.max(y, BAND_H + cardH / 2),
      );
      round.matches.forEach((match, i) => {
        const card = { match, x, y: ys[i] as number };
        placed.set(match.matchNumber, card);
        cards.push(card);
      });
    });

    // Connectors follow the sheet's own "Winner Match N" references, so byes
    // and uneven rounds draw correctly rather than being assumed in pairs.
    const segments: Segment[] = [];
    const arrows: Arrow[] = [];
    const nodes: Node[] = [];

    for (const target of cards) {
      const feeders = [target.match.a.fromMatch, target.match.b.fromMatch]
        .filter((n): n is number => n !== undefined)
        .map((n) => placed.get(n))
        .filter((card): card is Placed => card !== undefined);

      if (!feeders.length) continue;

      for (const source of feeders) {
        segments.push({
          key: `e${source.match.matchNumber}-${target.match.matchNumber}`,
          d: edgePath(source.x + colW, source.y, target.x - ARROW, target.y),
          state: stateOf(source.match),
        });
      }

      const states = feeders.map((f) => stateOf(f.match));
      const arrowState: SegState = states.every((s) => s === "decided")
        ? "decided"
        : states.includes("live")
          ? "live"
          : "pending";

      arrows.push({
        key: `a${target.match.matchNumber}`,
        x: target.x,
        y: target.y,
        state: arrowState,
      });
      if (arrowState === "decided" && feeders.length > 1) {
        nodes.push({
          key: `n${target.match.matchNumber}`,
          x: target.x - gutter / 2,
          y: target.y,
        });
      }
    }

    // Final -> champion
    const lastRound = rounds[rounds.length - 1];
    const finalMatch = lastRound?.matches[0];
    const finalCard = finalMatch ? placed.get(finalMatch.matchNumber) : undefined;
    const champX = rounds.length * pitch;
    const champY = finalCard?.y ?? BAND_H + cardH / 2;

    if (showChampion && finalCard && finalMatch) {
      const champState = stateOf(finalMatch);
      segments.push({
        key: "champ",
        d: `M ${finalCard.x + colW} ${champY} H ${champX - ARROW}`,
        state: champState,
      });
      arrows.push({ key: "champ-a", x: champX, y: champY, state: champState });
    }

    const champion =
      showChampion && finalMatch?.status === "completed" && finalMatch.winner
        ? ((finalMatch.winner === "a" ? finalMatch.a : finalMatch.b).players ?? null)
        : null;

    const bottom = cards.reduce((max, card) => Math.max(max, card.y), champY);

    return {
      cards,
      segments,
      arrows,
      nodes,
      champX,
      champY,
      champion,
      width: showChampion ? champX + champW : champX - gutter + 16,
      height: bottom + cardH / 2 + 24,
    };
  }, [rounds, cardH, slotH, colW, gutter, pitch, champW, showChampion]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const check = () => setOverflows(element.scrollWidth - element.clientWidth > 4);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layout.width]);

  // Present mode grows the ladder to the height of the screen and lets it run
  // off the right edge, which is the same left-to-right read as the page has —
  // only large enough to be read from across a room. Fitting the width instead
  // would shrink a wide draw to nothing, which is the opposite of the point.
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!fit) return;
    const element = fitRef.current;
    if (!element) return;

    // A phone is not a projector: there the floor would push the ladder off
    // both edges at once and make it harder to read, not easier, so the screen
    // gets to shrink it back to 1:1.
    const floor = isMobile ? 1 : MIN_PRESENT_SCALE;

    // Measuring inside the observer's own callback is what produces the
    // "ResizeObserver loop" jank; taking the reading on the next frame, and
    // only ever keeping one frame in flight, holds the resize at 60fps.
    let frame = 0;
    const measure = () => {
      frame = 0;
      const { height } = element.getBoundingClientRect();
      if (!height) return;
      const grow = height / layout.height;
      // A draw already taller than the screen would otherwise come out at 1:1 —
      // no larger than the page it was opened from, which is not worth a
      // fullscreen. Present mode always enlarges and scrolls to make up the
      // difference, rather than squeezing the names until they stop reading.
      const next = Math.min(Math.max(grow, floor), MAX_PRESENT_SCALE);
      // Re-rendering the whole ladder for a rounding difference nobody can see
      // is the other half of the jank.
      setScale((current) => (Math.abs(current - next) < 0.005 ? current : next));
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [fit, isMobile, layout.height]);

  /* The ladder is a fixed-size canvas, which is what lets present mode scale it
     as one piece rather than reflowing it. */
  const canvas = (
    <div className="relative" style={{ width: layout.width, height: layout.height }}>
      {/* Alternating lanes give the ladder a rhythm and tie each column together */}
      {rounds.map((round, r) => (
        <div
          key={`lane-${round.name}`}
          aria-hidden
          className={cn(
            "absolute rounded-lg",
            r % 2 === 0 ? "bg-foreground/[0.028]" : "bg-transparent",
          )}
          style={{
            left: r * pitch - 14,
            top: 0,
            width: colW + 28,
            height: layout.height,
          }}
        />
      ))}

      <svg aria-hidden className="absolute inset-0" width={layout.width} height={layout.height}>
        {/* soft halo under every live/decided path — gives the connectors weight */}
        <g fill="none" strokeLinecap="round" opacity={0.16}>
          {layout.segments
            .filter((seg) => seg.state !== "pending")
            .map((seg) => (
              <path
                key={`halo-${seg.key}`}
                d={seg.d}
                stroke={STROKE[seg.state].color}
                strokeWidth={9}
              />
            ))}
        </g>

        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {layout.segments.map((seg) => (
            <path
              key={seg.key}
              d={seg.d}
              stroke={STROKE[seg.state].color}
              strokeWidth={STROKE[seg.state].width}
              strokeDasharray={STROKE[seg.state].dash}
              strokeOpacity={STROKE[seg.state].opacity}
              className={seg.state === "live" ? "connector-flow" : undefined}
            />
          ))}
        </g>

        <g>
          {layout.nodes.map((n) => (
            <circle
              key={n.key}
              cx={n.x}
              cy={n.y}
              r={4}
              fill="var(--background)"
              stroke="var(--accent)"
              strokeWidth={2.5}
            />
          ))}
        </g>

        <g>
          {layout.arrows.map((a) => (
            <polygon
              key={a.key}
              points={`${a.x},${a.y} ${a.x - ARROW},${a.y - 5.5} ${a.x - ARROW},${a.y + 5.5}`}
              fill={STROKE[a.state].color}
              opacity={a.state === "pending" ? 0.45 : 1}
            />
          ))}
        </g>
      </svg>

      {/* Round titles — chapter markers carrying their own progress */}
      {rounds.map((round, r) => {
        const total = round.matches.length;
        const played = round.matches.filter((m) => m.status === "completed").length;
        const playing = round.matches.filter((m) => m.status === "live").length;
        const isFinal = r === rounds.length - 1;

        return (
          <div
            key={round.name}
            className="absolute"
            style={{ left: r * pitch, top: 0, width: colW }}
          >
            <h3
              className={cn(
                "font-display text-[0.78rem] font-extrabold uppercase tracking-[0.16em]",
                isFinal ? "text-accent" : "text-foreground/80",
              )}
            >
              {round.name}
            </h3>
            <div className="mt-1.5 flex items-center gap-2 text-[0.66rem] text-muted-foreground">
              <span className="tabular-nums">
                {total} {total === 1 ? "match" : "matches"}
              </span>
              {played > 0 && (
                <span className="tabular-nums font-medium text-accent">· {played} played</span>
              )}
              {playing > 0 && (
                <span className="flex items-center gap-1 font-medium text-live">
                  <span className="live-dot size-1.5 rounded-full bg-live" />
                  {playing} live
                </span>
              )}
            </div>
            {/* progress rule: filled portion shows how far the round has got */}
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-border">
              <div
                className={cn("h-full rounded-full", isFinal ? "bg-accent" : "bg-accent/70")}
                style={{ width: `${total ? (played / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        );
      })}
      {showChampion && (
        <div className="absolute" style={{ left: layout.champX, top: 0, width: champW }}>
          <h3 className="font-display text-[0.78rem] font-extrabold uppercase tracking-[0.16em] text-accent">
            Champion
          </h3>
          <div className="mt-1.5 text-[0.66rem] text-muted-foreground">
            {layout.champion ? "Decided" : "To be decided"}
          </div>
          <div className="mt-2 h-[3px] w-full rounded-full bg-accent/25" />
        </div>
      )}

      {/* Match cards */}
      {layout.cards.map((card) => (
        <MatchCard
          key={card.match.id}
          match={card.match}
          kind={kind}
          rowH={rowH}
          compact={isMobile}
          courtLabel={courtLabel}
          highlighted={highlight?.has(card.match.id)}
          style={{
            left: card.x,
            top: card.y - cardH / 2,
            width: colW,
            height: cardH,
            animationDelay: `${Math.round(card.x / pitch) * 70}ms`,
          }}
        />
      ))}

      {/* Champion */}
      {showChampion && (
        <div
          className={cn(
            "absolute flex flex-col justify-center rounded-md px-4",
            layout.champion
              ? "ink-panel border-t-2 border-accent"
              : "border border-dashed border-border bg-card",
          )}
          style={{
            left: layout.champX,
            top: layout.champY - cardH / 2,
            width: champW,
            height: cardH,
          }}
        >
          <Trophy
            className={cn("size-4", layout.champion ? "text-accent" : "text-muted-foreground/50")}
          />
          {layout.champion ? (
            <div className="mt-2">
              {layout.champion.map((p) => (
                <p
                  key={p}
                  className="truncate font-display text-sm font-extrabold leading-tight text-primary-foreground"
                >
                  {p}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[0.78rem] italic text-muted-foreground/60">
              Decided at the final
            </p>
          )}
        </div>
      )}
    </div>
  );

  // Present mode: the enlarged ladder scrolls, so the transform is wrapped in a
  // box carrying its scaled size — a bare transform leaves the scroll container
  // measuring the original width and there is nothing to scroll to.
  if (fit) {
    return (
      <div
        ref={fitRef}
        // `overscroll-contain` stops a swipe that runs off the end of the
        // bracket from bouncing the page behind the overlay on iOS.
        className="size-full overflow-auto overscroll-contain"
      >
        <div style={{ width: layout.width * scale, height: layout.height * scale }}>
          <div
            // The scaled ladder is a large, and largely static, canvas: giving
            // it its own compositor layer means dragging it across the screen
            // moves pixels instead of repainting several hundred cards.
            className="origin-top-left will-change-transform"
            style={{ width: layout.width, height: layout.height, transform: `scale(${scale})` }}
          >
            {canvas}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={scrollRef} className="-mx-5 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8">
        {canvas}
      </div>

      {/* Scroll affordance — only when there is somewhere to scroll to, or it
          washes over the last column for no reason. */}
      {overflows && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-background to-transparent sm:block" />
          <p className="mt-1 text-[0.7rem] text-muted-foreground/70 sm:hidden">
            Swipe across to follow the ladder →
          </p>
        </>
      )}
    </div>
  );
}

export function Bracket({
  rounds,
  kind,
  courtLabel,
  title,
}: {
  rounds: BracketRound[];
  kind: ParticipantKind;
  courtLabel?: string | undefined;
  /** Named above the bracket in present mode, where there is no page around it. */
  title?: string | undefined;
}) {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");

  // A bye is a formality rather than a fixture: the player it lets through is
  // already standing in the next round, so drawing it would only add noise.
  const played = useMemo(
    () =>
      rounds
        .map((round) => ({ ...round, matches: round.matches.filter((m) => !isByeMatch(m)) }))
        .filter((round) => round.matches.length > 0),
    [rounds],
  );

  // The third-place play-off hangs off the semi-finals rather than feeding the
  // final, so it would draw a line back across the ladder. It rides along with
  // the closing rounds instead.
  const thirdPlace = useMemo(() => played.find((round) => round.name === "Third Place"), [played]);
  const ladder = useMemo(() => played.filter((round) => round.name !== "Third Place"), [played]);

  const sections = useMemo(() => buildSections(ladder), [ladder]);
  const sectioned = sections.length > 1;

  const q = query.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!q) return [];
    const found: Hit[] = [];
    // A cut draw repeats its converging round in both the section it ends and
    // the closing bracket it opens, so the same fixture is reachable twice.
    // Counting it twice was invisible while a hit was only a highlight; listed
    // out, it reads as the player having two identical matches.
    const seen = new Set<string>();
    sections.forEach((section, index) => {
      for (const round of section.rounds) {
        for (const match of round.matches) {
          if (seen.has(match.id) || !searchText(match).includes(q)) continue;
          seen.add(match.id);
          found.push({ match, index, round: round.name, section: section.name });
        }
      }
    });
    return found;
  }, [sections, q]);

  const highlight = useMemo(() => new Set(hits.map((hit) => hit.match.id)), [hits]);

  // Searching moves you to wherever the player actually is; picking a result
  // from the list moves you to that one instead of the first.
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [q]);

  const active = Math.min(
    q && hits.length ? (picked ?? hits[0]?.index ?? tab) : tab,
    sections.length - 1,
  );
  const current = sections[active];

  const present = usePresent();

  // The draw wraps in both directions: on a screen nobody is standing at, an
  // end-stop is just a projector showing the same bracket until someone
  // notices.
  const step = (delta: number) => {
    setQuery("");
    setTab((index) => (index + delta + sections.length) % sections.length);
  };

  useEffect(() => {
    if (!present.on) return;
    const onKey = (event: KeyboardEvent) => {
      // Space and the arrows belong to whoever is typing a name, not to the
      // slideshow — otherwise searching for "Sai Ajay" walks the brackets.
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) return;

      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `step` closes over nothing that changes between renders of a live present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present.on, sections.length]);

  if (!current) return null;

  return (
    <div
      ref={present.ref}
      className={cn(
        "space-y-8",
        // Fullscreen paints its own black behind the element, and the fallback
        // needs to cover the page, so present mode carries its own surface.
        // `h-dvh` rather than the height `inset-0` implies: on a phone the two
        // differ by the browser's own chrome, and the navigator is the part
        // that would end up underneath it.
        present.on &&
          "fixed inset-0 z-50 flex h-dvh flex-col gap-4 space-y-0 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-10",
        present.on && !present.closing && "present-in",
        present.closing && "present-out",
      )}
    >
      {present.on ? (
        <header className="flex shrink-0 items-center justify-between gap-x-6 gap-y-3 border-b border-border pb-3 sm:pb-5">
          <div className="min-w-0">
            {title && <p className="eyebrow truncate text-muted-foreground">{title}</p>}
            <h2 className="truncate font-display text-xl font-extrabold sm:text-4xl">
              {current.name}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Finding a player matters more on a projector, not less: this is
                where someone in the room asks when they are playing. Typing
                jumps to whichever bracket they are in and lights their card. */}
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a player…"
                aria-label="Find a player"
                className="w-32 rounded border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent sm:w-64 sm:py-2.5 sm:text-lg"
              />
              {/* Absolutely placed so results never nudge the header around
                  while someone is still typing into it, and never take height
                  from the bracket underneath. */}
              {q && (
                <div className="absolute right-0 top-full z-10 mt-2 max-h-[60vh] w-72 overflow-y-auto overscroll-contain rounded-md border border-border bg-background p-3 shadow-lg sm:w-96">
                  <SearchResults
                    hits={hits}
                    query={query.trim()}
                    kind={kind}
                    courtLabel={courtLabel}
                    showSection={sectioned}
                    onPick={(index) => {
                      setPicked(index);
                      setTab(index);
                    }}
                    large
                  />
                </div>
              )}
            </label>

            <button
              type="button"
              onClick={present.exit}
              className="inline-flex shrink-0 items-center gap-2 rounded border border-border px-3 py-2 font-display text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Minimize2 className="size-4" /> Exit
            </button>
          </div>
        </header>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {sectioned &&
              sections.map((section, index) => (
                <button
                  key={section.name}
                  type="button"
                  onClick={() => {
                    setTab(index);
                    setQuery("");
                  }}
                  className={cn(
                    "rounded border px-3 py-1.5 font-display text-[0.72rem] font-bold uppercase tracking-[0.1em] transition-colors",
                    index === active
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {section.name}
                </button>
              ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Not tied to the draw having been cut: a single-section bracket is
                still a wall of names to find yourself in. */}
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a player…"
                aria-label="Find a player"
                className="w-52 rounded border border-border bg-card py-1.5 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent"
              />
            </label>
            {/* The point of the site for the business team is this bracket on a
                projector, so the way into that is never more than one press. */}
            <button
              type="button"
              onClick={present.enter}
              className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 font-display text-[0.72rem] font-bold uppercase tracking-[0.1em] transition-colors hover:border-accent hover:text-accent"
            >
              <Maximize2 className="size-3.5" /> Present
            </button>
          </div>
        </div>
      )}

      {!present.on && q && (
        <SearchResults
          hits={hits}
          query={query.trim()}
          kind={kind}
          courtLabel={courtLabel}
          showSection={sectioned}
          onPick={(index) => {
            setPicked(index);
            setTab(index);
          }}
        />
      )}

      <div className={cn(present.on && "min-h-0 flex-1")}>
        <Ladder
          key={current.name}
          rounds={current.rounds}
          kind={kind}
          courtLabel={courtLabel}
          showChampion={current.endsInChampion}
          highlight={highlight}
          fit={present.on}
        />
      </div>

      {/* The bronze match is a card beside the ladder; on a projector it would
          eat the height the bracket itself needs. */}
      {thirdPlace && current.endsInChampion && !present.on && (
        <ThirdPlace
          match={thirdPlace.matches[0] as BracketMatch}
          kind={kind}
          courtLabel={courtLabel}
        />
      )}

      {/* The navigator sits under the bracket it moves: at this size the top of
          the screen is a long way from where the eye already is. */}
      {present.on && sectioned && (
        <nav className="flex shrink-0 items-center justify-start gap-2 overflow-x-auto border-t border-border pt-3 sm:justify-center sm:pt-5">
          <StepButton label="Previous bracket" onClick={() => step(-1)}>
            <ChevronLeft className="size-6" />
          </StepButton>
          {sections.map((section, index) => (
            <button
              key={section.name}
              type="button"
              onClick={() => {
                setQuery("");
                setTab(index);
              }}
              className={cn(
                "shrink-0 rounded border px-3 py-2 font-display text-xs font-bold uppercase tracking-[0.1em] transition-colors sm:px-5 sm:py-2.5 sm:text-sm",
                index === active
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {section.name}
            </button>
          ))}
          <StepButton label="Next bracket" onClick={() => step(1)}>
            <ChevronRight className="size-6" />
          </StepButton>
        </nav>
      )}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="hidden size-11 shrink-0 items-center justify-center rounded border border-border text-foreground transition-colors hover:border-accent hover:text-accent sm:inline-flex"
    >
      {children}
    </button>
  );
}

/** How long the overlay takes to fade itself out when there is no fullscreen. */
const CLOSE_MS = 200;

/**
 * Fullscreen for one element, with the page-covering fallback that browsers
 * refusing the request (iOS Safari, an embedded webview) leave you needing.
 * Escape is the browser's own exit in real fullscreen and ours in the fallback.
 *
 * The order on the way out matters. Dropping the overlay's own background
 * first — which is what "set state, then exit" does — leaves the element
 * transparent for the frames the browser is still animating out of fullscreen,
 * and what shows through is the black `::backdrop`. So the fullscreen exit
 * comes first and the state follows the `fullscreenchange` it fires, which
 * also means Escape and the browser's own exit button take the identical path.
 */
function usePresent() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"off" | "on" | "closing">("off");
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setPhase("off");
    };
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      clearTimeout(closeTimer.current);
    };
  }, []);

  const on = phase !== "off";

  useEffect(() => {
    if (!on) return;
    // The fallback overlay sits over a page that would otherwise scroll behind
    // it — and on iOS that page keeps its scroll position only if we put the
    // property back exactly as we found it.
    const { overflow, overscrollBehavior } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.overscrollBehavior = overscrollBehavior;
    };
  }, [on]);

  const exit = () => {
    clearTimeout(closeTimer.current);
    if (document.fullscreenElement) {
      // Stay painted until the browser is actually out; `fullscreenchange`
      // finishes the job.
      void document.exitFullscreen().catch(() => setPhase("off"));
      return;
    }
    // No fullscreen to animate for us, so the overlay fades itself out.
    setPhase("closing");
    closeTimer.current = setTimeout(() => setPhase("off"), CLOSE_MS);
  };

  useEffect(() => {
    if (phase !== "on") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const enter = () => {
    clearTimeout(closeTimer.current);
    setPhase("on");
    void ref.current?.requestFullscreen?.().catch(() => {
      // Left in the fallback overlay, which is already showing.
    });
  };

  return { ref, on, closing: phase === "closing", enter, exit };
}

/**
 * What the search actually found, spelled out. A highlight on the ladder tells
 * you a player exists somewhere in the column you are already looking at; the
 * thing someone searching a draw wants to know is who they play, on which
 * board and at what time — so the answer is written out rather than pointed at.
 */
function SearchResults({
  hits,
  query,
  kind,
  courtLabel,
  onPick,
  showSection,
  large = false,
}: {
  hits: Hit[];
  query: string;
  kind: ParticipantKind;
  courtLabel?: string | undefined;
  onPick: (index: number) => void;
  /** Only worth naming the section when the draw was cut into several. */
  showSection: boolean;
  /** Present mode reads from across a room. */
  large?: boolean;
}) {
  if (!hits.length) {
    return (
      <p className={cn("text-muted-foreground", large ? "text-base" : "text-sm")}>
        Nobody matching “{query}”.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className={cn("text-muted-foreground", large ? "text-sm" : "text-xs")}>
        {hits.length} match{hits.length === 1 ? "" : "es"} for “{query}”
      </p>
      <ul className="space-y-2">
        {hits.map((hit) => (
          <li key={hit.match.id}>
            <button
              type="button"
              onClick={() => onPick(hit.index)}
              className={cn(
                "block w-full rounded-md border border-border bg-card text-left transition-colors hover:border-accent",
                large ? "px-4 py-3" : "px-3 py-2.5",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-display font-extrabold tracking-[0.1em] text-muted-foreground/70",
                    large ? "text-xs" : "text-[0.6rem]",
                  )}
                >
                  M{hit.match.matchNumber}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-muted-foreground",
                    large ? "text-sm" : "text-[0.66rem]",
                  )}
                >
                  {[showSection ? hit.section : "", hit.round].filter(Boolean).join(" · ")}
                </span>
                <StatusTag status={hit.match.status} compact={false} />
              </div>

              <div className="mt-1.5 space-y-0.5">
                <ResultSide slot={hit.match.a} won={hit.match.winner === "a"} large={large} />
                <ResultSide slot={hit.match.b} won={hit.match.winner === "b"} large={large} />
              </div>

              <p
                className={cn("mt-1.5 text-muted-foreground", large ? "text-sm" : "text-[0.7rem]")}
              >
                {[
                  hit.match.court ? [courtLabel, hit.match.court].filter(Boolean).join(" ") : "",
                  hit.match.time,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One side of a listed fixture: house, name, and how it stands. */
function ResultSide({ slot, won, large }: { slot: BracketSlot; won: boolean; large: boolean }) {
  const group = getGroup(slot.group);
  const name = slotLabel(slot);

  return (
    <div className="flex items-center gap-2">
      <span
        className="w-[3px] shrink-0 rounded-full"
        style={{
          height: large ? 18 : 14,
          backgroundColor: group?.color ?? "var(--border)",
          opacity: slot.players ? 1 : 0.25,
        }}
      />
      {group && slot.players && (
        <span
          className={cn(
            "shrink-0 font-display font-extrabold tracking-[0.04em]",
            large ? "w-[30px] text-[0.7rem]" : "w-[26px] text-[0.58rem]",
          )}
          style={{ color: `color-mix(in oklab, ${group.color} 78%, black)` }}
          title={group.name}
        >
          {group.code}
        </span>
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          large ? "text-base" : "text-sm",
          slot.players ? "font-medium" : "italic text-muted-foreground/70",
          won && "text-accent",
        )}
      >
        {name || "To be decided"}
      </span>
      {slot.score !== undefined && slot.score !== null && (
        <span
          className={cn(
            "shrink-0 tabular-nums",
            large ? "text-base" : "text-sm",
            won && "font-bold text-accent",
          )}
        >
          {slot.score}
        </span>
      )}
    </div>
  );
}

/** The bronze match, shown beside the ladder rather than inside it. */
function ThirdPlace({
  match,
  kind,
  courtLabel,
}: {
  match: BracketMatch;
  kind: ParticipantKind;
  courtLabel?: string | undefined;
}) {
  return (
    <section className="border-t border-border pt-6">
      <h4 className="font-display text-[0.78rem] font-extrabold uppercase tracking-[0.16em] text-foreground/80">
        Third place play-off
      </h4>
      <div className="relative mt-3" style={{ height: HEAD_H + 40 * 2, width: COL_W }}>
        <MatchCard
          match={match}
          kind={kind}
          rowH={40}
          compact={false}
          courtLabel={courtLabel}
          style={{ left: 0, top: 0, width: COL_W, height: HEAD_H + 40 * 2 }}
        />
      </div>
    </section>
  );
}
