import type { BracketMatch, BracketRound, BracketTeam } from "@/data/tournaments";
import { cn } from "@/lib/utils";

function StatusTag({ status }: { status: BracketMatch["status"] }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-live">
        <span className="live-dot inline-block size-1.5 rounded-full bg-live" />
        Live
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Final
      </span>
    );
  }
  return (
    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
      Upcoming
    </span>
  );
}

function TeamRow({
  team,
  isWinner,
  status,
}: {
  team: BracketTeam;
  isWinner: boolean;
  status: BracketMatch["status"];
}) {
  const decided = status === "completed";
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5",
        decided && !isWinner && "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-5 w-[3px] shrink-0 rounded-full",
          isWinner ? "bg-accent" : decided ? "bg-border" : "bg-border/70",
        )}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          isWinner ? "font-semibold text-foreground" : "font-medium",
          !team.name && "italic text-muted-foreground/60",
        )}
      >
        {team.name ?? "To be decided"}
      </span>
      {team.score !== null && team.score !== undefined && (
        <span
          className={cn(
            "font-display text-sm tabular-nums",
            isWinner ? "font-bold text-accent" : "text-muted-foreground",
          )}
        >
          {team.score}
        </span>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatch }) {
  return (
    <div
      className={cn(
        "group w-full overflow-hidden rounded-md border bg-card transition-colors",
        match.status === "live"
          ? "border-live/50 ring-1 ring-live/15"
          : "border-border hover:border-foreground/25",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-3.5 py-1.5">
        <span className="text-[0.68rem] font-medium text-muted-foreground">
          {match.time}
        </span>
        <StatusTag status={match.status} />
      </div>
      <div className="divide-y divide-border/60">
        <TeamRow team={match.a} isWinner={match.winner === "a"} status={match.status} />
        <TeamRow team={match.b} isWinner={match.winner === "b"} status={match.status} />
      </div>
    </div>
  );
}

export function Bracket({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8">
      <div className="flex min-w-max gap-6 sm:gap-10">
        {rounds.map((round, ri) => (
          <div key={round.name} className="flex w-[248px] shrink-0 flex-col sm:w-[268px]">
            <div className="mb-5 flex items-baseline justify-between border-b border-border pb-2">
              <h3 className="eyebrow text-muted-foreground">{round.name}</h3>
              <span className="text-[0.68rem] text-muted-foreground/70">
                {round.matches.length} {round.matches.length === 1 ? "match" : "matches"}
              </span>
            </div>
            <div
              className="flex flex-1 flex-col justify-around"
              style={{ gap: `${Math.max(0.75, 0.75 * 2 ** ri)}rem` }}
            >
              {round.matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
