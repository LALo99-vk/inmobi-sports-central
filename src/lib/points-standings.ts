/**
 * Ordering the houses.
 *
 * Kept out of the route so the rule can be read — and checked — on its own:
 * points first, then the sheet's own tiebreak of gold, then silver, then bronze.
 */
import type { Group, PointsTable } from "@/data/tournaments";

export type Standing = {
  team: Group;
  total: number;
  gold: number;
  silver: number;
  bronze: number;
  /** Shared by houses that are level on points and on every medal. */
  rank: number;
  /** True when another house has the same points, so the tiebreak is doing work. */
  tied: boolean;
};

/**
 * Orders the houses by points, then by their own rule: gold, then silver, then
 * bronze. Only a house level on all four shares a rank.
 */
export function buildStandings(table: PointsTable): Standing[] {
  const ordered = table.teams
    .map((team) => {
      const medals = table.medals[team.code] ?? { gold: 0, silver: 0, bronze: 0, total: 0 };
      return {
        team,
        total: table.totals[team.code] ?? 0,
        gold: medals.gold,
        silver: medals.silver,
        bronze: medals.bronze,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.gold - a.gold ||
        b.silver - a.silver ||
        b.bronze - a.bronze ||
        a.team.name.localeCompare(b.team.name),
    );

  const level = (a: (typeof ordered)[number], b: (typeof ordered)[number]) =>
    a.total === b.total && a.gold === b.gold && a.silver === b.silver && a.bronze === b.bronze;

  let rank = 0;
  return ordered.map((entry, index) => {
    const previous = ordered[index - 1];
    if (!previous || !level(entry, previous)) rank = index + 1;
    // Level on points but separated by medals — worth saying so on the page.
    const tied = ordered.some(
      (other) => other !== entry && other.total === entry.total && !level(other, entry),
    );
    return { ...entry, rank, tied };
  });
}
