import { useMemo } from "react";
import { Trophy } from "lucide-react";

import type { BracketMatch, BracketRound, BracketSlot, ParticipantKind } from "@/data/tournaments";
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

type SegState = "decided" | "live" | "pending";
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

function stateOf(match: BracketMatch): SegState {
  if (match.status === "completed") return "decided";
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
  style,
}: {
  match: BracketMatch;
  kind: ParticipantKind;
  rowH: number;
  compact: boolean;
  style: React.CSSProperties;
}) {
  const live = match.status === "live";
  const done = match.status === "completed";

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
      )}
    >
      <div
        className="flex items-center gap-2 border-b border-border/70 bg-secondary/40 px-3"
        style={{ height: HEAD_H }}
      >
        <span className="font-display text-[0.6rem] font-extrabold tracking-[0.1em] text-muted-foreground/70">
          M{match.matchNumber}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.66rem] text-muted-foreground">
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

export function Bracket({ rounds, kind }: { rounds: BracketRound[]; kind: ParticipantKind }) {
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

    if (finalCard && finalMatch) {
      const champState = stateOf(finalMatch);
      segments.push({
        key: "champ",
        d: `M ${finalCard.x + colW} ${champY} H ${champX - ARROW}`,
        state: champState,
      });
      arrows.push({ key: "champ-a", x: champX, y: champY, state: champState });
    }

    const champion =
      finalMatch?.status === "completed" && finalMatch.winner
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
      width: champX + champW,
      height: bottom + cardH / 2 + 24,
    };
  }, [rounds, cardH, slotH, colW, gutter, pitch, champW]);

  return (
    <div className="relative">
      <div className="-mx-5 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8">
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
          <div className="absolute" style={{ left: layout.champX, top: 0, width: champW }}>
            <h3 className="font-display text-[0.78rem] font-extrabold uppercase tracking-[0.16em] text-accent">
              Champion
            </h3>
            <div className="mt-1.5 text-[0.66rem] text-muted-foreground">
              {layout.champion ? "Decided" : "To be decided"}
            </div>
            <div className="mt-2 h-[3px] w-full rounded-full bg-accent/25" />
          </div>

          {/* Match cards */}
          {layout.cards.map((card) => (
            <MatchCard
              key={card.match.id}
              match={card.match}
              kind={kind}
              rowH={rowH}
              compact={isMobile}
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
        </div>
      </div>

      {/* scroll affordance */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-background to-transparent sm:block" />
      <p className="mt-1 text-[0.7rem] text-muted-foreground/70 sm:hidden">
        Swipe across to follow the ladder →
      </p>
    </div>
  );
}
