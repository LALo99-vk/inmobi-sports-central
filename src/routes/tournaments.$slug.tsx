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

import { getTournaments } from "@/lib/tournament-data";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import type { Tournament } from "@/data/tournaments";
import { Bracket } from "@/components/bracket";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SportMotif } from "@/components/sport-motif";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tournaments/$slug")({
  loader: async ({ params }) => {
    const { tournaments, source, fetchedAt } = await getTournaments();
    const tournament = tournaments.find((t) => t.slug === params.slug);
    if (!tournament) throw notFound();
    return { tournament, others: tournaments, source, fetchedAt };
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

const TABS = ["Details", "Matches", "Gallery", "Videos"] as const;
type Tab = (typeof TABS)[number];

function TournamentPage() {
  const { tournament: t, others, fetchedAt } = Route.useLoaderData();
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
                      alt={g.caption}
                      loading="lazy"
                      width={1280}
                      height={960}
                      className={cn(
                        "w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]",
                        i === 0 ? "h-72 sm:h-[33rem]" : "h-56",
                      )}
                    />
                    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {g.caption}
                    </figcaption>
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
              <div className="mt-10 grid gap-8 lg:grid-cols-2">
                {t.videos.map((v, i) => (
                  <VideoCard key={v.id} video={v} feature={i === 0} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <OtherTournaments slug={t.slug} all={others} />
      <SiteFooter />
    </div>
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
 * The poster is only a picture until someone presses play — then it is swapped
 * for Drive's own player. Mounting an iframe per video up front would pull in
 * Google's whole player for every clip on the page, so the click is what pays
 * for it.
 *
 * Both the poster and the player load straight from Google in the visitor's
 * browser, so unlike the photos these files must be shared "anyone with the
 * link". When they are not, the thumbnail 404s and we say so plainly rather
 * than leaving a black box.
 */
function VideoCard({ video, feature }: { video: Tournament["videos"][number]; feature: boolean }) {
  const [playing, setPlaying] = useState(false);
  const height = feature ? "h-64 sm:h-[26rem]" : "h-56";

  return (
    <article className={cn(feature && "lg:col-span-2")}>
      <div className={cn("group relative overflow-hidden rounded-md bg-primary", height)}>
        {playing ? (
          <iframe
            src={`https://drive.google.com/file/d/${video.id}/preview`}
            title={video.title}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="size-full"
          />
        ) : !video.shared ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Play className="size-7 text-primary-foreground/40" />
            <p className="font-display text-sm font-bold text-primary-foreground/90">
              This video isn&rsquo;t shared yet
            </p>
            <p className="text-xs text-primary-foreground/60">
              In Drive, set it to &ldquo;Anyone with the link&rdquo; and it will play here.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="size-full"
            aria-label={`Play ${video.title}`}
          >
            <img
              src={`https://drive.google.com/thumbnail?id=${video.id}&sz=w1280`}
              alt=""
              loading="lazy"
              className="size-full object-cover opacity-80 transition-all duration-700 group-hover:scale-[1.02] group-hover:opacity-70"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:scale-105">
                <Play className="size-6 translate-x-0.5 fill-current" />
              </span>
            </span>
            {video.duration && (
              <span className="absolute bottom-3 right-3 rounded bg-black/65 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
                {video.duration}
              </span>
            )}
          </button>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-bold">{video.title}</h3>
      {video.meta && <p className="text-sm text-muted-foreground">{video.meta}</p>}
    </article>
  );
}

function Details({ t }: { t: Tournament }) {
  return (
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
