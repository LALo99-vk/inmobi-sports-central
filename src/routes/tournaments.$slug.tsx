import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CalendarDays, Clock, MapPin, Play, Trophy } from "lucide-react";

import { getTournament, tournaments } from "@/data/tournaments";
import { Bracket } from "@/components/bracket";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tournaments/$slug")({
  loader: ({ params }) => {
    const tournament = getTournament(params.slug);
    if (!tournament) throw notFound();
    return { tournament };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Tournament not found — InMobi Sports Day 2026" }, { name: "robots", content: "noindex" }],
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
  const { tournament: t } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("Details");

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Masthead */}
      <section className="relative isolate overflow-hidden ink-panel">
        <img
          src={t.image}
          alt={`${t.sport} at InMobi Sports Day 2026`}
          width={1280}
          height={960}
          className="absolute inset-0 size-full object-cover opacity-35"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.18 0.05 265 / 0.96) 10%, oklch(0.18 0.05 265 / 0.7) 100%)",
          }}
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
                  Round 1 → Round 2 → Quarter-Finals → Semi-Finals → Final
                </p>
              </div>
              <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="live-dot size-1.5 rounded-full bg-live" /> Live
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-accent" /> Winner
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-border" /> Upcoming
                </span>
              </div>
            </div>
            <div className="mt-10">
              <Bracket rounds={t.rounds} />
            </div>
          </section>
        )}
        {tab === "Gallery" && (
          <section>
            <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">
              Gallery
            </h2>
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
          </section>
        )}
        {tab === "Videos" && (
          <section>
            <h2 className="rule-ember font-display text-2xl font-extrabold sm:text-3xl">
              Videos
            </h2>
            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              {t.videos.map((v, i) => (
                <article key={i} className={cn(i === 0 && "lg:col-span-2")}>
                  <div className="group relative overflow-hidden rounded-md bg-primary">
                    <img
                      src={v.poster}
                      alt={v.title}
                      loading="lazy"
                      width={1280}
                      height={960}
                      className={cn(
                        "w-full object-cover opacity-80 transition-all duration-700 group-hover:scale-[1.02] group-hover:opacity-70",
                        i === 0 ? "h-64 sm:h-[26rem]" : "h-56",
                      )}
                    />
                    <button className="absolute inset-0 flex items-center justify-center">
                      <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:scale-105">
                        <Play className="size-6 translate-x-0.5 fill-current" />
                      </span>
                    </button>
                    <span className="absolute bottom-3 right-3 rounded bg-black/65 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
                      {v.duration}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.meta}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <OtherTournaments slug={t.slug} />
      <SiteFooter />
    </div>
  );
}

function Details({ t }: { t: NonNullable<ReturnType<typeof getTournament>> }) {
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
            <div key={k} className="flex gap-4 border-b border-border/70 pb-4 last:border-0 last:pb-0">
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

function OtherTournaments({ slug }: { slug: string }) {
  const others = tournaments.filter((t) => t.slug !== slug).slice(0, 4);
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
