/**
 * Who won one sport, as a podium.
 *
 * Lives in the Winners tab of a tournament page, where you already know which
 * sport you are looking at — so there is no sport picker, only a category one
 * for the sports that run more than one event. Reads the same `SportPoints`
 * the standings are built from, so a medal can never say one thing here and
 * another on the points table.
 */
import { useRef, useState, type RefObject } from "react";
import { Check, Download, Loader2 } from "lucide-react";

import type { EventMedal, EventResult, Group, Medal, SportPoints } from "@/data/tournaments";
import { MEDALS } from "@/data/tournaments";
import { MedalDisc } from "@/components/medal-disc";
import { buildPoster, downloadPoster } from "@/lib/medal-poster";
import { cn } from "@/lib/utils";

const MEDAL_LABEL: Record<Medal, string> = { gold: "Gold", silver: "Silver", bronze: "Bronze" };
const PLACE: Record<Medal, number> = { gold: 1, silver: 2, bronze: 3 };

/** Live handles on the three discs, so the rows below can paint from them. */
type DiscHandles = RefObject<Map<Medal, SVGSVGElement | null>>;

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

  // The poster is painted from the disc already on screen, so the two can never
  // drift. The discs live on the podium and the save buttons live in the rows
  // below it, so the handles are held here, where both can reach them.
  const discs = useRef(new Map<Medal, SVGSVGElement | null>());

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

      <Podium event={event} slug={sport.slug ?? ""} byCode={byCode} discs={discs} />
      <RecordSheet event={event} sport={sport.sport} byCode={byCode} discs={discs} />
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
  discs,
}: {
  event: EventResult;
  slug: string;
  byCode: Map<string, Group>;
  discs: DiscHandles;
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
            <Slot
              key={place}
              place={place}
              rank={rank}
              team={team}
              display={display}
              slug={slug}
              names={medal.winners ?? []}
              discs={discs}
            />
          );
        })}
      </div>
    </div>
  );
}

/** One step of the podium: the medal, and who won it. */
function Slot({
  place,
  rank,
  team,
  display,
  slug,
  names,
  discs,
}: {
  place: Medal;
  rank: number;
  team: Group;
  display: string;
  slug: string;
  names: string[];
  discs: DiscHandles;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <MedalDisc
        ref={(node) => {
          discs.current.set(place, node);
        }}
        medal={place}
        houseColor={team.color}
        houseName={team.name}
        sportSlug={slug}
        names={names}
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
function RecordSheet({
  event,
  sport,
  byCode,
  discs,
}: {
  event: EventResult;
  sport: string;
  byCode: Map<string, Group>;
  discs: DiscHandles;
}) {
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
            className="grid grid-cols-[1.75rem_1fr_auto_auto] items-center gap-3 border-b border-border py-4 last:border-b-0 sm:gap-4"
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
            {decided ? (
              <SaveMedal
                place={place}
                name={display}
                team={team}
                sport={sport}
                category={event.category}
                discs={discs}
              />
            ) : (
              <span className="w-8" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Keeping a medal
 * ------------------------------------------------------------------ */

/**
 * Paints this row's medal into a poster and saves it.
 *
 * It sits in the record rather than on the podium: the podium is the moment
 * and putting three buttons across it crowded the medals, while hiding them
 * until hover — which is what the podium did — meant nobody on a phone could
 * find them and few on a desktop ever would. Here it is the same control
 * everywhere, beside the name it belongs to.
 */
function SaveMedal({
  place,
  name,
  team,
  sport,
  category,
  discs,
}: {
  place: Medal;
  name: string;
  team: Group;
  sport: string;
  category: string;
  discs: DiscHandles;
}) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  async function save() {
    const disc = discs.current.get(place);
    if (!disc || state === "working") return;
    setState("working");
    try {
      const input = {
        disc,
        name,
        house: team.name,
        houseColor: team.color,
        sport,
        category,
        place: MEDAL_LABEL[place] as "Gold" | "Silver" | "Bronze",
      };
      downloadPoster(await buildPoster(input), input);
      setState("done");
      setTimeout(() => setState("idle"), 2400);
    } catch {
      // Nothing was saved, so put the button back rather than claim otherwise.
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={state === "working"}
      title={`Save ${name}'s medal`}
      aria-label={`Save ${name}'s medal as an image`}
      className={cn(
        "inline-flex size-8 items-center justify-center border border-border text-muted-foreground",
        "transition-colors hover:border-accent hover:text-accent",
        "disabled:cursor-not-allowed disabled:opacity-60",
        state === "done" && "border-accent text-accent",
      )}
    >
      {state === "working" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : state === "done" ? (
        <Check className="size-3.5" />
      ) : (
        <Download className="size-3.5" />
      )}
    </button>
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
        {sport ? `${sport} hasn't been decided yet.` : "Nothing has been decided yet."} The podium
        fills in as soon as the results come in.
      </p>
    </div>
  );
}
