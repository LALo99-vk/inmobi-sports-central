import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, Clock, MapPin } from "lucide-react";

import heroImg from "@/assets/hero.jpg";
import { groups } from "@/data/tournaments";
import { teamLogo } from "@/data/team-logos";
import { getTournaments } from "@/lib/tournament-data";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InMobi Sports Day 2026 — Play. Compete. Connect." },
      {
        name: "description",
        content:
          "Eight tournaments, four teams, one InMobi spirit. Schedules, brackets, galleries and videos for InMobi Sports Day 2026.",
      },
      { property: "og:title", content: "InMobi Sports Day 2026" },
      {
        property: "og:description",
        content:
          "Eight tournaments across cricket, football, badminton and more. Follow every bracket from Round 1 to the Final.",
      },
    ],
  }),
  loader: async () => {
    const { tournaments } = await getTournaments();
    return { tournaments };
  },
  component: Home,
});

const schedule = [
  {
    dates: "31 Aug – 09 Sep",
    day: "Mon – Fri",
    sports: "Chess · Carrom · Darts · Foosball · Table Tennis",
    time: "4:00 PM – 7:00 PM",
    venue: "Cafeteria, Ground Floor",
  },
  {
    dates: "05 Sep – 06 Sep",
    day: "Sat – Sun",
    sports: "Cricket · Football · Races & Relay",
    time: "7:00 AM – 6:00 PM",
    venue: "Sports Square, Sarjapur – Marathahalli Road",
  },
  {
    dates: "21 Sep – 25 Sep",
    day: "Mon – Fri",
    sports: "Badminton",
    time: "6:00 PM – 9:30 PM",
    venue: "11 Point Club, Kadubeesanahalli",
  },
  {
    dates: "26 Sep – 27 Sep",
    day: "Sat – Sun",
    sports: "Cricket · Football · Races & Relay",
    time: "7:00 AM – 6:00 PM",
    venue: "Sports Square, Sarjapur – Marathahalli Road",
  },
];

function Home() {
  const { tournaments } = Route.useLoaderData();
  useAutoRefresh(60_000);
  const count = tournaments.length;
  const venues = new Set(tournaments.map((t) => t.venue)).size;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative isolate overflow-hidden ink-panel">
        <img
          src={heroImg}
          alt="Athletes competing at InMobi Sports Day"
          width={1920}
          height={1088}
          className="absolute inset-0 size-full object-cover opacity-60"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.18 0.05 265 / 0.97) 0%, oklch(0.18 0.05 265 / 0.82) 45%, oklch(0.18 0.05 265 / 0.25) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32 lg:py-40">
          <p className="eyebrow rise-in text-accent">Play · Compete · Connect</p>
          <h1 className="rise-in mt-5 max-w-3xl font-display text-5xl font-extrabold leading-[0.95] text-primary-foreground sm:text-7xl lg:text-8xl">
            Sports Day
            <span className="block text-accent">2026</span>
          </h1>
          <p className="rise-in mt-6 max-w-xl text-lg text-primary-foreground/75">
            Four teams. One month of it&rsquo;s-all-about-celebrating one InMobi spirit.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-primary-foreground/15 pt-6 text-primary-foreground/80">
            <span className="flex items-center gap-2 text-sm">
              <CalendarDays className="size-4 text-accent" />
              31 Aug – 27 Sep 2026
            </span>
            <span className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-accent" />
              Bengaluru{venues > 0 && ` · ${venues} venue${venues === 1 ? "" : "s"}`}
            </span>
            {count > 0 && (
              <span className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-accent" />
                {count} tournament{count === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <a
            href="#tournaments"
            className="mt-10 inline-flex items-center gap-2 border-b-2 border-accent pb-1 font-display text-sm font-bold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:text-accent"
          >
            Explore tournaments
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </section>

      {/* Teams strip */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-4 px-5 py-5 sm:px-8">
          <span className="eyebrow text-muted-foreground">Four teams</span>
          {groups.map((team) => (
            <span key={team.code} className="flex items-center gap-3">
              <img src={teamLogo(team)} alt="" className="h-14 w-14 object-contain object-center" />
              <span className="font-display text-sm font-bold tracking-tight">{team.name}</span>
            </span>
          ))}
          <Link
            to="/points-table"
            className="ml-auto inline-flex items-center gap-1.5 border-b-2 border-accent pb-0.5 font-display text-sm font-bold uppercase tracking-[0.14em] transition-colors hover:text-accent"
          >
            Points table
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Tournaments */}
      <section
        id="tournaments"
        className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
      >
        <div className="max-w-2xl">
          <h2 className="rule-ember font-display text-3xl font-extrabold sm:text-4xl">
            Tournaments
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every sport runs as a straight knockout ladder — Round 1 through to the Final. Pick a
            tournament to follow its bracket, gallery and videos.
          </p>
        </div>

        {count === 0 && (
          <div className="mt-12 border-t border-border py-20 text-center">
            <p className="font-display text-xl font-extrabold">Tournaments are being finalised</p>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Schedules and brackets will appear here as soon as they&rsquo;re published.
            </p>
          </div>
        )}

        <ul className={cn("mt-12 border-t border-border", count === 0 && "hidden")}>
          {tournaments.map((t, i) => (
            <li key={t.slug}>
              <Link
                to="/tournaments/$slug"
                params={{ slug: t.slug }}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-5 gap-y-1 border-b border-border py-6 transition-colors hover:bg-secondary/60 sm:grid-cols-[3rem_1.1fr_1fr_auto] sm:gap-x-8 sm:px-3"
              >
                <span className="font-display text-sm font-bold tabular-nums text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-xl font-extrabold sm:text-2xl">
                    {t.sport}
                  </h3>
                  <p className="truncate text-sm text-muted-foreground">{t.name}</p>
                </div>
                <div className="col-span-2 col-start-2 text-sm text-muted-foreground sm:col-span-1 sm:col-start-3">
                  <p className="truncate">{t.dates}</p>
                  <p className="truncate text-muted-foreground/75">{t.venue}</p>
                </div>
                <ArrowUpRight className="size-5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Schedule */}
      <section id="schedule" className="scroll-mt-20 border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="rule-ember font-display text-3xl font-extrabold sm:text-4xl">
            Event schedule
          </h2>
          <div className="mt-10 divide-y divide-border border-t border-border">
            {schedule.map((row) => (
              <div
                key={row.dates}
                className="grid gap-2 py-6 sm:grid-cols-[10rem_1fr_9rem_14rem] sm:items-baseline sm:gap-8"
              >
                <div>
                  <p className="font-display text-lg font-bold">{row.dates}</p>
                  <p className="text-xs uppercase tracking-wider text-accent">{row.day}</p>
                </div>
                <p className="font-medium">{row.sports}</p>
                <p className="text-sm text-muted-foreground">{row.time}</p>
                <p className="text-sm text-muted-foreground">{row.venue}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Detailed schedules for each sport are published on the tournament pages.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
