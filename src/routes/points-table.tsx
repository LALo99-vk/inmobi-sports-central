import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ChevronRight, RefreshCw, Trophy } from "lucide-react";

import type { EventResult, Group, Medal, PointsTable, SportPoints } from "@/data/tournaments";
import { MEDALS } from "@/data/tournaments";
import { buildStandings, type Standing } from "@/lib/points-standings";
import { teamLogo } from "@/data/team-logos";
import { getPointsTable } from "@/lib/tournament-data";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/points-table")({
  loader: async () => {
    const { points, fetchedAt } = await getPointsTable();
    return { points, fetchedAt };
  },
  head: () => ({
    meta: [
      { title: "Points Table — InMobi Sports Day 2026" },
      {
        name: "description",
        content:
          "The overall standings for InMobi Sports Day 2026: every point scored by all four houses, across all ten sports.",
      },
      { property: "og:title", content: "Points Table — InMobi Sports Day 2026" },
      {
        property: "og:description",
        content: "Live overall standings across every tournament of InMobi Sports Day 2026.",
      },
    ],
  }),
  component: PointsTablePage,
});

const MEDAL_ICON: Record<Medal, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
const MEDAL_LABEL: Record<Medal, string> = { gold: "Gold", silver: "Silver", bronze: "Bronze" };

function PointsTablePage() {
  const { points, fetchedAt } = Route.useLoaderData();
  useAutoRefresh(60_000);

  const standings = buildStandings(points);
  const leaderPoints = standings[0]?.total ?? 0;
  const started = points.awarded > 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Masthead */}
      <section className="relative isolate overflow-hidden ink-panel">
        <Trophy
          className="pointer-events-none absolute -right-10 top-1/2 size-[26rem] -translate-y-1/2 text-accent opacity-15 sm:right-0"
          strokeWidth={0.6}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/70 transition-colors hover:text-accent"
          >
            <ArrowLeft className="size-4" /> Back to the event
          </Link>
          <p className="eyebrow mt-8 text-accent">Overall standings</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-primary-foreground sm:text-6xl">
            Points Table
          </h1>
          <p className="mt-5 max-w-xl text-lg text-primary-foreground/75">
            Every sport is worth 50 points.
          </p>

          <CarnivalProgress table={points} />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        {/* Leaderboard */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">
              The standings
            </h2>
            <LastUpdated fetchedAt={fetchedAt} />
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {standings.map((entry) => (
              <TeamCard
                key={entry.team.code}
                entry={entry}
                leaderPoints={leaderPoints}
                started={started}
              />
            ))}
          </div>

          <StandingsTable standings={standings} leaderPoints={leaderPoints} started={started} />
        </section>

        {/* Sport by sport */}
        <section className="mt-20 sm:mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">
              Sport by sport
            </h2>
            <p className="text-xs text-muted-foreground">Select a sport for its events</p>
          </div>

          {points.sports.length === 0 ? (
            <div className="mt-10 border-t border-border py-20 text-center">
              <p className="font-display text-xl font-extrabold">Nothing scored yet</p>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                Each of the ten sports appears here once the results start coming in.
              </p>
            </div>
          ) : (
            <BreakdownTable table={points} />
          )}
        </section>

        <HowPointsWork />
      </div>

      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * How far through the carnival we are
 * ------------------------------------------------------------------ */

function CarnivalProgress({ table }: { table: PointsTable }) {
  const share = table.pool > 0 ? (table.awarded / table.pool) * 100 : 0;

  return (
    <div className="mt-10 border-t border-primary-foreground/15 pt-6">
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3 text-sm text-primary-foreground/80">
        <span>
          <span className="font-display text-2xl font-extrabold text-primary-foreground tabular-nums">
            {table.awarded}
          </span>
          <span className="text-primary-foreground/60"> / {table.pool}</span> points awarded
        </span>
        <span>
          <span className="font-display text-2xl font-extrabold text-primary-foreground tabular-nums">
            {table.eventsDecided}
          </span>
          <span className="text-primary-foreground/60"> / {table.eventsTotal}</span> events decided
        </span>
      </div>

      <div
        className="mt-5 h-1.5 w-full max-w-xl bg-primary-foreground/15"
        role="progressbar"
        aria-valuenow={table.awarded}
        aria-valuemin={0}
        aria-valuemax={table.pool}
        aria-label="Points awarded so far"
      >
        <div
          className="h-1.5 bg-accent transition-[width] duration-700"
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Leaderboard
 * ------------------------------------------------------------------ */

/** The medal line that decides ties, e.g. "🥇 3 · 🥈 1 · 🥉 2". */
function MedalLine({ entry, className }: { entry: Standing; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3 tabular-nums", className)}>
      {MEDALS.map((medal) => (
        <span key={medal} className="relative flex items-center gap-1">
          <span aria-hidden>{MEDAL_ICON[medal]}</span>
          <span className="sr-only">{MEDAL_LABEL[medal]}</span>
          {entry[medal]}
        </span>
      ))}
    </span>
  );
}

function TeamCard({
  entry,
  leaderPoints,
  started,
}: {
  entry: Standing;
  leaderPoints: number;
  started: boolean;
}) {
  const logo = teamLogo(entry.team);
  const isLeader = started && entry.rank === 1;
  const behind = leaderPoints - entry.total;

  return (
    // A row on a phone, the full card from sm up. Four portrait cards stacked
    // on a narrow screen pushed the standings table three scrolls down.
    <article
      className={cn(
        "relative flex items-center gap-4 border border-border bg-card px-4 py-3.5 transition-colors",
        "sm:flex-col sm:items-stretch sm:gap-0 sm:p-6",
        isLeader && "border-accent/60 bg-secondary/40",
      )}
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: entry.team.color }}
        aria-hidden
      />

      <span className="w-6 shrink-0 font-display text-sm font-bold tabular-nums text-muted-foreground/70 sm:hidden">
        {started ? `#${entry.rank}` : "—"}
      </span>

      {logo && (
        <img
          src={logo}
          alt=""
          className="size-11 shrink-0 object-contain sm:order-2 sm:mt-4 sm:size-16 sm:self-start"
          width={64}
          height={64}
        />
      )}

      <div className="hidden items-start justify-between gap-3 sm:order-1 sm:flex">
        <span className="font-display text-sm font-bold tabular-nums text-muted-foreground/70">
          {started ? `#${entry.rank}` : "—"}
        </span>
        {isLeader && <span className="eyebrow text-[0.62rem] text-accent">Leading</span>}
      </div>

      <div className="min-w-0 flex-1 sm:order-3 sm:flex-none">
        <h3 className="font-display text-base font-extrabold leading-tight sm:mt-4 sm:text-lg">
          {entry.team.name}
        </h3>
        <p className="hidden text-sm text-muted-foreground sm:block">{entry.team.code}</p>
        <MedalLine entry={entry} className="mt-1 text-xs sm:hidden" />
      </div>

      <div className="shrink-0 text-right sm:order-4 sm:text-left">
        <p className="font-display text-2xl font-extrabold tabular-nums sm:mt-6 sm:text-4xl">
          {entry.total}
        </p>
        <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground sm:text-xs">
          points
          {/* "· 9 behind" costs width a phone row hasn't got; the standings
              table right underneath carries the same comparison. */}
          {started && entry.rank !== 1 && (
            <span className="hidden sm:inline"> · {behind} behind</span>
          )}
        </p>
      </div>

      <MedalLine
        entry={entry}
        className="hidden sm:order-5 sm:mt-4 sm:flex sm:border-t sm:border-border sm:pt-4 sm:text-sm"
      />
    </article>
  );
}

function StandingsTable({
  standings,
  leaderPoints,
  started,
}: {
  standings: Standing[];
  leaderPoints: number;
  started: boolean;
}) {
  return (
    <div className="-mx-5 mt-12 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border text-left">
            <th className="w-12 py-3 pr-3 font-medium text-muted-foreground">#</th>
            <th className="py-3 pr-4 font-medium text-muted-foreground">House</th>
            {MEDALS.map((medal) => (
              <th
                key={medal}
                className="relative w-14 py-3 text-right font-medium text-muted-foreground"
              >
                <span aria-hidden>{MEDAL_ICON[medal]}</span>
                <span className="sr-only">{MEDAL_LABEL[medal]}</span>
              </th>
            ))}
            <th className="hidden py-3 pl-6 pr-6 font-medium text-muted-foreground md:table-cell">
              Against the leader
            </th>
            <th className="py-3 pl-4 text-right font-medium text-muted-foreground">Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry) => {
            const share = leaderPoints > 0 ? (entry.total / leaderPoints) * 100 : 0;
            return (
              <tr key={entry.team.code} className="border-b border-border">
                <td className="py-4 pr-3 font-display font-bold tabular-nums text-muted-foreground/70">
                  {started ? entry.rank : "—"}
                </td>
                <td className="py-4 pr-4">
                  <span className="flex items-center gap-3">
                    <span
                      className="h-8 w-1 shrink-0"
                      style={{ backgroundColor: entry.team.color }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-display text-base font-bold">
                        {entry.team.name}
                      </span>
                      {started && entry.tied && (
                        <span className="block text-xs text-muted-foreground">
                          Level on points — split on medals
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                {MEDALS.map((medal) => (
                  <td key={medal} className="py-4 text-right tabular-nums text-muted-foreground">
                    {entry[medal]}
                  </td>
                ))}
                <td className="hidden py-4 pl-6 pr-6 md:table-cell">
                  <span className="block h-2 w-full bg-secondary">
                    <span
                      className="block h-2 transition-[width] duration-500"
                      style={{ width: `${share}%`, backgroundColor: entry.team.color }}
                    />
                  </span>
                </td>
                <td className="py-4 pl-4 text-right font-display text-lg font-extrabold tabular-nums">
                  {entry.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sport-by-sport breakdown
 * ------------------------------------------------------------------ */

/** Codes tied at the top of a sport's row, so the leader can be marked. */
function leadersOf(sport: SportPoints): Set<string> {
  const scores = Object.entries(sport.points);
  const best = Math.max(...scores.map(([, value]) => value), 0);
  if (best <= 0) return new Set();
  return new Set(scores.filter(([, value]) => value === best).map(([code]) => code));
}

function BreakdownTable({ table }: { table: PointsTable }) {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (sport: string) =>
    setOpen((current) =>
      current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport],
    );

  return (
    <div className="-mx-5 mt-10 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead>
          <tr className="border-y border-border">
            <th className="py-3 pr-4 text-left font-medium text-muted-foreground">Sport</th>
            {table.teams.map((team) => (
              <th key={team.code} className="py-3 pl-4 text-right font-medium">
                <span className="flex items-center justify-end gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color }}
                    aria-hidden
                  />
                  <span className="hidden lg:inline">{team.name}</span>
                  <span className="lg:hidden">{team.code}</span>
                </span>
              </th>
            ))}
            <th className="w-32 py-3 pl-6 text-right font-medium text-muted-foreground">Awarded</th>
          </tr>
        </thead>

        {table.sports.map((sport) => {
          const leaders = leadersOf(sport);
          const expanded = open.includes(sport.sport);

          return (
            <tbody key={sport.sport}>
              <tr className={cn("border-b border-border", !expanded && "hover:bg-secondary/50")}>
                <td className="py-4 pr-4">
                  <button
                    type="button"
                    onClick={() => toggle(sport.sport)}
                    aria-expanded={expanded}
                    className="flex items-center gap-2 text-left transition-colors hover:text-accent"
                  >
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        expanded && "rotate-90",
                      )}
                      aria-hidden
                    />
                    <span>
                      <span className="block font-display text-base font-bold">{sport.sport}</span>
                      <span className="block text-xs text-muted-foreground">
                        {sport.events.length === 1 ? "1 event" : `${sport.events.length} events`}
                      </span>
                    </span>
                  </button>
                </td>

                {table.teams.map((team) => {
                  const value = sport.points[team.code] ?? 0;
                  return (
                    <td
                      key={team.code}
                      className={cn(
                        "py-4 pl-4 text-right tabular-nums",
                        value === 0 && "text-muted-foreground/50",
                        leaders.has(team.code) && "font-display font-extrabold text-foreground",
                      )}
                    >
                      {value}
                    </td>
                  );
                })}

                <td className="py-4 pl-6 text-right">
                  <AwardedCell sport={sport} />
                </td>
              </tr>

              {expanded &&
                sport.events.map((event) => (
                  <EventRow
                    key={`${sport.sport}-${event.category}`}
                    event={event}
                    teams={table.teams}
                    slug={sport.slug}
                  />
                ))}
            </tbody>
          );
        })}

        <tfoot>
          <tr className="border-b-2 border-foreground/80">
            <td className="py-4 pr-4 font-display text-base font-extrabold">Total</td>
            {table.teams.map((team) => (
              <td
                key={team.code}
                className="py-4 pl-4 text-right font-display text-lg font-extrabold tabular-nums"
              >
                {table.totals[team.code] ?? 0}
              </td>
            ))}
            <td className="py-4 pl-6 text-right font-display text-lg font-extrabold tabular-nums">
              {table.awarded} / {table.pool}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** "30 / 50" with a bar, or "Not played" before a sport starts. */
function AwardedCell({ sport }: { sport: SportPoints }) {
  if (sport.status === "pending") {
    return (
      <span className="text-xs uppercase tracking-wider text-muted-foreground/60">Not played</span>
    );
  }

  const share = sport.pool > 0 ? (sport.awarded / sport.pool) * 100 : 0;
  return (
    <span className="inline-flex flex-col items-end gap-1.5">
      <span className="tabular-nums text-muted-foreground">
        {sport.awarded} / {sport.pool}
      </span>
      <span className="block h-1 w-20 bg-secondary">
        <span
          className={cn("block h-1 transition-[width] duration-500", "bg-accent")}
          style={{ width: `${share}%` }}
        />
      </span>
    </span>
  );
}

/** One of the 19 events, shown under its sport: who took each medal. */
function EventRow({
  event,
  teams,
  slug,
}: {
  event: EventResult;
  teams: Group[];
  slug?: string | undefined;
}) {
  const byCode = new Map(teams.map((team) => [team.code, team]));

  return (
    <tr className="border-b border-border/60 bg-secondary/30">
      <td className="py-3 pl-10 pr-4">
        {slug ? (
          <Link
            to="/tournaments/$slug"
            params={{ slug }}
            className="text-sm transition-colors hover:text-accent"
          >
            {event.category || "Open"}
          </Link>
        ) : (
          <span className="text-sm">{event.category || "Open"}</span>
        )}
      </td>

      <td colSpan={teams.length} className="py-3 pl-4">
        {event.status === "pending" ? (
          <span className="text-xs uppercase tracking-wider text-muted-foreground/60">
            Not played
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {event.medals.map((medal) => {
              const team = medal.team ? byCode.get(medal.team) : undefined;
              return (
                <span key={medal.medal} className="relative flex items-center gap-2 text-sm">
                  <span aria-hidden>{MEDAL_ICON[medal.medal]}</span>
                  <span className="sr-only">{MEDAL_LABEL[medal.medal]}</span>
                  {team ? (
                    <>
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: team.color }}
                        aria-hidden
                      />
                      <span className="font-medium">{team.name}</span>
                      <span className="tabular-nums text-muted-foreground">+{medal.points}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/60">To be decided</span>
                  )}
                </span>
              );
            })}
          </span>
        )}
      </td>

      <td className="py-3 pl-6 text-right tabular-nums text-muted-foreground">
        {event.awarded} / {event.pool}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * The scoring system, in three lines
 * ------------------------------------------------------------------ */

function HowPointsWork() {
  return (
    <section className="mt-20 border-t border-border pt-10 sm:mt-24">
      <h2 className="font-display text-lg font-extrabold">How points work</h2>
      <div className="mt-5 grid gap-x-10 gap-y-4 text-sm text-muted-foreground sm:grid-cols-3">
        <p>
          <span className="font-semibold text-foreground">Sports are worth 40 or 50 points</span>,
          450 in total. Cricket, football, badminton, table tennis and the races carry 50; chess,
          carrom, dart, foosball and the relay carry 40.
        </p>
        <p>
          <span className="font-semibold text-foreground">Gold 25, silver 15, bronze 10</span> for
          cricket and football; 18/13/9 for chess, carrom, dart, foosball and the relay. Badminton
          and table tennis split their 50 across five categories (5/3/2 each); the two 100 m races
          are worth 25 each (12/8/5).
        </p>
        <p>
          <span className="font-semibold text-foreground">Points go to the house</span>, never the
          individual. Level on points is settled by gold medals, then silver, then bronze.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Freshness
 * ------------------------------------------------------------------ */

function LastUpdated({ fetchedAt }: { fetchedAt: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const updated = new Date(fetchedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      // Re-reads the sheet server-side, then re-runs the loader to pick it up.
      await fetch("/api/tournaments?refresh=1", { cache: "no-store" });
      await router.invalidate();
    } catch {
      // Leave the current table on screen — a failed refresh should never blank
      // the standings. The next attempt, or the 60s cache, will catch up.
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1",
          "font-medium transition-colors hover:border-accent hover:text-accent",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <RefreshCw className={cn("size-3", busy && "animate-spin")} />
        {busy ? "Updating" : "Refresh"}
      </button>
      <span className="text-muted-foreground/70">Updated {updated}</span>
    </span>
  );
}
