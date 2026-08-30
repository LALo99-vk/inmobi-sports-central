/**
 * Server functions. The handlers are stripped from the client bundle, so the
 * sheet credentials and the Google fetch never reach the browser.
 */
import { createServerFn } from "@tanstack/react-start";

import { loadSheetData } from "@/lib/sheets";

/** Every tournament, with sheet data merged over the sample ladders. */
export const getTournaments = createServerFn({ method: "GET" }).handler(async () => {
  const data = await loadSheetData();
  return {
    tournaments: data.tournaments,
    groups: data.groups,
    source: data.source,
    fromSheet: data.fromSheet,
    fetchedAt: data.fetchedAt,
  };
});

/**
 * The event-wide standings: every sport's points for all four house teams.
 */
export const getPointsTable = createServerFn({ method: "GET" }).handler(async () => {
  const data = await loadSheetData();
  return {
    points: data.points,
    source: data.source,
    fetchedAt: data.fetchedAt,
  };
});

/**
 * Diagnostics for the business team: what the sheet looked like on the last
 * read and every row the parser couldn't understand.
 */
export const getSheetStatus = createServerFn({ method: "GET" }).handler(async () => {
  const data = await loadSheetData();
  return {
    source: data.source,
    fromSheet: data.fromSheet,
    fetchedAt: new Date(data.fetchedAt).toISOString(),
    error: data.error ?? null,
    warnings: data.warnings,
    tournaments: data.tournaments.map((t) => ({
      slug: t.slug,
      rounds: t.rounds.length,
      matches: t.rounds.reduce((sum, round) => sum + round.matches.length, 0),
    })),
  };
});
