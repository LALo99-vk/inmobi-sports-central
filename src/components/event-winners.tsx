/**
 * Who won one sport, as a podium.
 *
 * Lives in the Winners tab of a tournament page, where you already know which
 * sport you are looking at — so there is no sport picker, only a category one
 * for the sports that run more than one event. Reads the same `SportPoints`
 * the standings are built from, so a medal can never say one thing here and
 * another on the points table.
 */
import { useState } from "react";

import type { EventMedal, EventResult, Group, Medal, SportPoints } from "@/data/tournaments";
import { MEDALS } from "@/data/tournaments";
import { MedalDisc } from "@/components/medal-disc";
import { cn } from "@/lib/utils";

const MEDAL_LABEL: Record<Medal, string> = { gold: "Gold", silver: "Silver", bronze: "Bronze" };
const PLACE: Record<Medal, number> = { gold: 1, silver: 2, bronze: 3 };

/** The order they stand on a podium: silver left, gold centre, bronze right. */
const PODIUM_ORDER: Medal[] = ["silver", "gold", "bronze"];

/** A medal nobody has been given yet has nothing to put on a disc. */
const isDecided = (medal: EventMedal | undefined): medal is EventMedal => Boolean(medal?.team);

/** An event worth showing: at least one medal has a house against it. */
const hasResult = (event: EventResult) => event.medals.some(isDecided);

/**
 * The name that reads under the disc.
 *
 * A team sport has no individual to name, so the house is the winner — the
 * disc handles its own side of that by striking the house code into the face.
 */
function winnerName(medal: EventMedal, team: Group): string {
  const names = medal.winners ?? [];
  return names.length ? names.join(" & ") : team.name;
}

export function EventWinners({ sport, teams }: { sport: SportPoints; teams: Group[] }) {
  const events = sport.events.filter(hasResult);

  const [categoryName, setCategoryName] = useState<string | null>(null);
  const event = events.find((item) => item.category === categoryName) ?? events[0];

  const byCode = new Map(teams.map((team) => [team.code, team]));

  if (!event) return <NothingDecided sport={sport.sport} />;

  return (
    <div>
      {/* Badminton and table tennis run five categories; the two races run two.
          A sport with one event needs no picker at all. */}
      {events.length > 1 && (
        <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <div className="flex gap-5 pb-1">
            {events.map((item) => (
              <button
                key={item.category || "open"}
                type="button"
                onClick={() => setCategoryName(item.category)}
                aria-pressed={item === event}
                className={cn(
                  "shrink-0 border-b-2 py-1.5 text-sm font-medium transition-colors",
                  item === event
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.category || "Open"}
              </button>
            ))}
          </div>
        </div>
      )}

      <Podium event={event} slug={sport.slug ?? ""} byCode={byCode} />
      <RecordSheet event={event} byCode={byCode} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The podium
 * ------------------------------------------------------------------ */

function Podium({
  event,
  slug,
  byCode,
}: {
  event: EventResult;
  slug: string;
  byCode: Map<string, Group>;
}) {
  return (
    <div className="ink-panel mt-6 overflow-hidden px-4 pt-10 sm:px-8 sm:pt-14">
      <div className="mx-auto grid max-w-3xl grid-cols-[1fr_1.3fr_1fr] items-end gap-2 sm:gap-7">
        {PODIUM_ORDER.map((place) => {
          const medal = event.medals.find((item) => item.medal === place);
          const team = medal?.team ? byCode.get(medal.team) : undefined;
          const rank = PLACE[place];

          if (!isDecided(medal) || !team) {
            return <UndecidedSlot key={place} place={place} rank={rank} />;
          }

          const display = winnerName(medal, team);

          return (
            <div key={place} className="flex flex-col items-center text-center">
              <MedalDisc
                medal={place}
                houseColor={team.color}
                houseName={team.name}
                sportSlug={slug}
                names={medal.winners ?? []}
                foot="SPORTS DAY · 2026"
                label={`${MEDAL_LABEL[place]}: ${display}, ${team.name}`}
                className={cn("mx-auto", place === "gold" ? "max-w-[13rem]" : "max-w-[10rem]")}
              />

              <p
                className={cn(
                  "hidden font-medal font-semibold leading-[1.15] tracking-[0.015em] text-primary-foreground sm:mt-4 sm:block",
                  place === "gold"
                    ? "sm:text-[1.55rem] lg:text-[2.15rem]"
                    : "sm:text-[1.1rem] lg:text-[1.45rem]",
                )}
              >
                {display}
              </p>
              <span className="hidden items-center gap-2 text-primary-foreground/65 sm:mt-1.5 sm:flex sm:text-xs lg:text-sm">
                <span
                  className="h-3 w-[3px] shrink-0"
                  style={{ backgroundColor: team.color }}
                  aria-hidden
                />
                <span className="truncate">{team.name}</span>
              </span>

              <Plinth rank={rank} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A medal the sheet hasn't named yet — the step is still built, just empty. */
function UndecidedSlot({ place, rank }: { place: Medal; rank: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "mx-auto flex aspect-square w-full items-center justify-center rounded-full border border-dashed border-primary-foreground/25",
          place === "gold" ? "max-w-[9rem]" : "max-w-[7rem]",
        )}
      >
        <span className="text-[0.62rem] uppercase tracking-[0.14em] text-primary-foreground/40">
          {MEDAL_LABEL[place]}
        </span>
      </div>
      <p className="hidden font-medal text-lg font-medium italic leading-[1.15] tracking-[0.015em] text-primary-foreground/40 sm:mt-4 sm:block">
        To be decided
      </p>
      <Plinth rank={rank} />
    </div>
  );
}

/** The step itself. Gold stands tallest; the number is cut into the face. */
function Plinth({ rank }: { rank: number }) {
  return (
    <div
      className={cn(
        "mt-4 flex w-full justify-center border-t-2 border-primary-foreground/15",
        rank === 1 ? "h-24 bg-primary-foreground/[0.09]" : "bg-primary-foreground/[0.055]",
        rank === 2 && "h-16",
        rank === 3 && "h-11",
      )}
    >
      {/* Archivo, not the podium face: Cormorant sets old-style figures, where
          3 descends below the baseline and drops out of the short bronze step.
          These are wayfinding, so they want lining, tabular numerals. */}
      <span className="pt-2 font-display text-2xl font-bold leading-none tabular-nums text-primary-foreground/25">
        {rank}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The record
 * ------------------------------------------------------------------ */

/**
 * The same three results as plain rows.
 *
 * Deliberately redundant: the podium is the moment, this is the record — and
 * it is what a screen reader, a narrow phone and a skim-reader all get on
 * without having to parse an SVG.
 */
function RecordSheet({ event, byCode }: { event: EventResult; byCode: Map<string, Group> }) {
  return (
    <div className="border border-t-0 border-border bg-surface px-4 sm:px-7">
      {MEDALS.map((place) => {
        const medal = event.medals.find((item) => item.medal === place);
        const team = medal?.team ? byCode.get(medal.team) : undefined;
        const decided = isDecided(medal) && team;
        const display = decided ? winnerName(medal, team) : "To be decided";

        return (
          <div
            key={place}
            className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-4 border-b border-border py-4 last:border-b-0"
          >
            <span className="font-display text-base font-black tabular-nums text-muted-foreground/70">
              {PLACE[place]}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate font-display text-base font-bold",
                  !decided && "font-medium text-muted-foreground/60",
                )}
              >
                {display}
              </span>
              {decided && (
                <span className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    className="h-3 w-[3px] shrink-0"
                    style={{ backgroundColor: team.color }}
                    aria-hidden
                  />
                  <span className="truncate">{team.name}</span>
                </span>
              )}
            </span>
            <span className="font-display text-base font-extrabold tabular-nums">
              {decided ? `+${medal.points}` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Before anything has been played
 * ------------------------------------------------------------------ */

export function NothingDecided({ sport }: { sport?: string }) {
  return (
    <div className="border-y border-border py-20 text-center">
      <p className="font-display text-xl font-extrabold">No medals yet</p>
      <p className="mx-auto mt-3 max-w-md text-muted-foreground">
        {sport ? `${sport} hasn't been decided.` : "Nothing has been decided."} The podium fills in
        the moment a result reaches the sheet.
      </p>
    </div>
  );
}
