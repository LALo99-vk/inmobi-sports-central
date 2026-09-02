import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Clock,
  MapPin,
  Play,
  RefreshCw,
  Trophy,
} from "lucide-react";

import { getPointsTable, getTournaments } from "@/lib/tournament-data";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import type { Group, SportPoints, Tournament } from "@/data/tournaments";
import { Bracket } from "@/components/bracket";
import { EventWinners, NothingDecided } from "@/components/event-winners";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SportMotif } from "@/components/sport-motif";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tournaments/$slug")({
  loader: async ({ params }) => {
    // Both server functions read the same cached copy of the sheet, so asking
    // for the standings alongside the draw costs no extra fetch.
    const [{ tournaments, source, fetchedAt }, { points }] = await Promise.all([
      getTournaments(),
      getPointsTable(),
    ]);
    const tournament = tournaments.find((t) => t.slug === params.slug);
    if (!tournament) throw notFound();

    // The Results tab writes sport names, not slugs, so a sport only carries a
    // slug once it also has a row on the Tournaments tab. Fall back to matching
    // the name, which keeps the podium showing if the two tabs ever drift —
    // "Dart" against "Darts", say.
    const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const sportKey = key(tournament.sport);
    const winners =
      points.sports.find((sport) => sport.slug === params.slug) ??
      points.sports.find((sport) => {
        const name = key(sport.sport);
        return name === sportKey || `${name}s` === sportKey || name === `${sportKey}s`;
      }) ??
      null;

    return { tournament, others: tournaments, source, fetchedAt, winners, teams: points.teams };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Tournament not found — InMobi Sports Day 2026" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const t = loaderData.tournament;
    const title = `${t.sport} — ${t.name} | InMobi Sports Day 2026`;
    const description = `${t.tagline} ${t.dates} at ${t.venue}. Follow the ${t.sport.toLowerCase()} bracket, gallery and videos.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: TournamentPage,
});

const TABS = ["Details", "Matches", "Gallery", "Videos", "Winners"] as const;
type Tab = (typeof TABS)[number];

function TournamentPage() {
  const { tournament: t, others, fetchedAt, winners, teams } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("Details");
  useAutoRefresh(60_000);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Masthead */}
      <section className="relative isolate overflow-hidden ink-panel">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.18 0.05 265 / 0.98) 0%, oklch(0.18 0.05 265 / 0.85) 45%, oklch(0.18 0.05 265 / 0.55) 100%)",
          }}
        />
        {/* Sport motif instead of stock photography — on-brand, weightless, and
            different for every tournament. Sits above the wash so the line-work
            stays crisp rather than being dimmed into the background. */}
        <SportMotif
          slug={t.slug}
          className="pointer-events-none absolute -right-8 top-1/2 h-[165%] -translate-y-1/2 text-accent opacity-25 sm:right-0 sm:h-[180%]"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/70 transition-colors hover:text-accent"
          >
            <ArrowLeft className="size-4" /> All tournaments
          </Link>
          <p className="eyebrow mt-8 text-accent">{t.sport}</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-primary-foreground sm:text-6xl">
            {t.name}
          </h1>
          <p className="mt-3 max-w-xl text-primary-foreground/70">{t.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-primary-foreground/15 pt-5 text-sm text-primary-foreground/80">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              {t.dates}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-accent" />
              {t.time}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-4 text-accent" />
              {t.venue} · {t.venueNote}
            </span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-8 overflow-x-auto px-5 sm:px-8">
          {TABS.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={cn(
                "-mb-px shrink-0 border-b-2 py-4 font-display text-sm font-bold uppercase tracking-[0.14em] transition-colors",
                tab === item
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        {tab === "Details" && <Details t={t} />}
        {tab === "Matches" && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">
                  Knockout bracket
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Follow the arrows — every winner advances into the next round.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:gap-5">
                <RefreshButton fetchedAt={fetchedAt} />
                <span className="flex items-center gap-2">
                  <span className="h-[3px] w-6 rounded-full bg-accent" /> Winner advances
                </span>
                <span className="flex items-center gap-2">
                  <span className="live-dot h-[3px] w-6 rounded-full bg-live" /> Being played
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-[3px] w-6 rounded-full bg-border" /> Yet to be decided
                </span>
              </div>
            </div>
            <div className="mt-10">
              <Bracket
                rounds={t.rounds}
                kind={t.participants}
                courtLabel={t.courtLabel}
                title={`${t.sport} — ${t.name}`}
              />
            </div>
          </section>
        )}
        {tab === "Gallery" && (
          <section>
            <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">Gallery</h2>
            {t.gallery.length === 0 ? (
              <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-md bg-secondary py-24 text-center">
                <Camera className="size-8 text-muted-foreground" />
                <p className="font-display text-lg font-bold">Photos are on their way</p>
                <p className="text-sm text-muted-foreground">Check back soon.</p>
              </div>
            ) : (
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {t.gallery.map((g, i) => (
                  <figure
                    key={i}
                    className={cn(
                      "group relative overflow-hidden rounded-md bg-secondary",
                      i === 0 && "sm:col-span-2 sm:row-span-2",
                    )}
                  >
                    <img
                      src={g.src}
                      // The only caption we have is the Drive filename, which
                      // describes nothing — better silence than "chess3".
                      alt=""
                      loading="lazy"
                      width={1280}
                      height={960}
                      className={cn(
                        "w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]",
                        i === 0 ? "h-72 sm:h-[33rem]" : "h-56",
                      )}
                    />
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "Videos" && (
          <section>
            <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">Videos</h2>
            {t.videos.length === 0 ? (
              <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-md bg-secondary py-24 text-center">
                <Play className="size-8 text-muted-foreground" />
                <p className="font-display text-lg font-bold">Videos are on their way</p>
                <p className="text-sm text-muted-foreground">Check back soon.</p>
              </div>
            ) : (
              <div className="mt-10 grid grid-cols-2 items-start gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {t.videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "Winners" && <Winners sport={winners} teams={teams} name={t.sport} />}
      </main>

      <OtherTournaments slug={t.slug} all={others} />
      <SiteFooter />
    </div>
  );
}

/**
 * Who took the medals in this sport.
 *
 * `winners` is null when the Results tab has no rows for this slug at all —
 * a sport the sheet hasn't started tracking, which reads the same to a visitor
 * as one that hasn't been played.
 */
function Winners({
  sport,
  teams,
  name,
}: {
  sport: SportPoints | null;
  teams: Group[];
  name: string;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">Winners</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The points go to the house; the medal goes to whoever won it.
          </p>
        </div>
        <Link
          to="/points-table"
          className="text-xs text-muted-foreground transition-colors hover:text-accent"
        >
          See the full standings
        </Link>
      </div>
      <div className="mt-10">
        {sport ? <EventWinners sport={sport} teams={teams} /> : <NothingDecided sport={name} />}
      </div>
    </section>
  );
}

/**
 * Pulls the latest sheet data on demand. The business team edits the sheet and
 * presses this rather than waiting out the cache or reloading the page.
 */
function RefreshButton({ fetchedAt }: { fetchedAt: number }) {
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
      // Leave the current data on screen — a failed refresh should never blank
      // the bracket. The next attempt, or the 60s cache, will catch up.
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
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

/**
 * A Drive video.
 *
 * The card is a poster and nothing else until someone presses play — then the
 * clip opens in a lightbox rather than inside the grid cell. Playing in place
 * is what forced every card to be big enough to watch in; with the player
 * lifted out, the shelf can be sized for scanning and the video gets the room
 * it actually needs.
 *
 * The poster comes through our own proxy, so it needs nothing more than the
 * folder being shared with the reader account. The player is still Drive's own
 * iframe, which loads in the visitor's browser and so does need the file itself
 * to be "anyone with the link" — when it isn't, we say so on the card.
 */
function VideoCard({ video }: { video: Tournament["videos"][number] }) {
  const [open, setOpen] = useState(false);
  // Drive reports the encoded dimensions, and a phone clip can be stored
  // landscape with the rotation held separately — so the poster, which Drive
  // renders the right way up, gets the last word once it has actually loaded.
  const [aspect, setAspect] = useState(video.aspect);

  const frame = "relative w-full overflow-hidden rounded-xl bg-primary ring-1 ring-border/70";

  return (
    <article className="group">
      {video.shared ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ aspectRatio: aspect }}
          className={cn(
            frame,
            "cursor-pointer transition duration-300",
            "hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-18px_rgba(20,20,50,0.55)] hover:ring-accent/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          )}
          aria-label={`Play ${video.title}`}
        >
          <img
            src={video.poster}
            alt=""
            loading="lazy"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setAspect(naturalWidth / naturalHeight);
              }
            }}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {/* A scrim only where the controls sit, so the frame keeps its colour. */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/50 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-accent group-hover:ring-accent">
              <Play className="size-4 translate-x-px fill-white text-white" />
            </span>
          </span>
          {video.duration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[0.68rem] font-medium tabular-nums text-white">
              {video.duration}
            </span>
          )}
        </button>
      ) : (
        <div
          style={{ aspectRatio: aspect }}
          className={cn(
            frame,
            "flex flex-col items-center justify-center gap-1.5 px-4 text-center",
          )}
        >
          <Play className="size-5 text-primary-foreground/40" />
          <p className="font-display text-xs font-bold text-primary-foreground/90">
            Not shared yet
          </p>
          <p className="text-[0.68rem] leading-snug text-primary-foreground/60">
            Set it to &ldquo;Anyone with the link&rdquo; in Drive.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-none border-0 bg-transparent p-0 text-white shadow-none">
          <DialogTitle className="sr-only">{video.title}</DialogTitle>
          {/* Width is capped by the viewport on both axes at once, so the clip
              fills the frame exactly and never letterboxes inside it. */}
          <div
            className="overflow-hidden rounded-xl bg-black"
            style={{ width: `min(92vw, ${(aspect * 82).toFixed(2)}vh)`, aspectRatio: aspect }}
          >
            {open && (
              <iframe
                src={`https://drive.google.com/file/d/${video.id}/preview`}
                title={video.title}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="size-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

/**
 * The referees' rulebook for this sport, boiled down to a line per topic.
 * Rendered only when the tournament actually has one, so sports without a
 * rulebook show nothing rather than borrowed rules from another game.
 */
function Rules({ rules }: { rules: NonNullable<Tournament["rules"]> }) {
  return (
    <section className="mt-16 border-t border-border pt-12">
      <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">Rules</h2>
      <p className="mt-5 text-sm text-muted-foreground">
        A short summary of the official tournament rules.
      </p>
      <dl className="mt-10 grid gap-x-12 gap-y-6 sm:grid-cols-2">
        {rules.map((rule) => (
          <div key={rule.section} className="border-t border-border pt-4">
            <dt className="eyebrow text-muted-foreground">{rule.section}</dt>
            <dd className="mt-2 text-sm leading-relaxed">{rule.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Details({ t }: { t: Tournament }) {
  return (
    <>
      <section className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
        <div>
          <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">
            About the tournament
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{t.about}</p>
          <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {t.info.map((row) => (
              <div key={row.label} className="border-t border-border pt-4">
                <dt className="eyebrow text-muted-foreground">{row.label}</dt>
                <dd className="mt-1.5 font-display text-lg font-bold">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <aside className="h-fit border-t-2 border-accent bg-surface p-6 sm:p-8">
          <p className="eyebrow text-muted-foreground">At a glance</p>
          <dl className="mt-6 space-y-5 text-sm">
            {[
              ["Format", t.format],
              ["Field", t.teams],
              ["Days", t.day],
              ["Time", t.time],
              ["Venue", `${t.venue}, ${t.venueNote}`],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex gap-4 border-b border-border/70 pb-4 last:border-0 last:pb-0"
              >
                <dt className="w-20 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-7 flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="size-4 text-accent" /> Winner announced at the closing ceremony.
          </p>
        </aside>
      </section>
      {t.rules?.length ? <Rules rules={t.rules} /> : null}
    </>
  );
}

function OtherTournaments({ slug, all }: { slug: string; all: Tournament[] }) {
  const others = all.filter((t) => t.slug !== slug).slice(0, 4);
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <h2 className="eyebrow text-muted-foreground">More tournaments</h2>
        <div className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((o) => (
            <Link
              key={o.slug}
              to="/tournaments/$slug"
              params={{ slug: o.slug }}
              className="group border-t border-border pt-4 transition-colors hover:border-accent"
            >
              <p className="font-display text-lg font-bold transition-colors group-hover:text-accent">
                {o.sport}
              </p>
              <p className="text-sm text-muted-foreground">{o.dates}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
