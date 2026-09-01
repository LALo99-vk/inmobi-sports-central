import "./lib/error-capture";

import { fetchFileMedia, fetchFileThumbnail, readDriveConfig } from "./lib/drive";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { loadSheetData } from "./lib/sheets";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/** Forced refreshes are throttled so the button can't be used to spam Google. */
const FORCE_REFRESH_GAP_MS = 5_000;
let lastForcedRefresh = 0;

const summarise = (data: Awaited<ReturnType<typeof loadSheetData>>) => ({
  tournaments: data.tournaments,
  groups: data.groups,
  points: data.points,
  source: data.source,
  fromSheet: data.fromSheet,
  fetchedAt: data.fetchedAt,
});

const json = (body: unknown, cacheControl: string, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl },
  });

/**
 * Plain HTTP endpoints for the tournament data.
 *
 * Kept separate from the app's server functions on purpose: these are cacheable
 * GETs, so a CDN can absorb polling traffic instead of every viewer costing us
 * a server invocation and, eventually, a Google API call.
 *
 * Returns null for anything that isn't one of ours, so the app handles it.
 */
async function handleApi(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/api/")) return null;

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, "no-store", 405);
  }

  if (pathname === "/api/tournaments") {
    // ?refresh=1 skips the cache and re-reads the sheet — this is what the
    // Refresh button calls, so an edit shows up immediately instead of waiting
    // out the TTL. Throttled so it can't be used to hammer Google's quota.
    const forced = new URL(request.url).searchParams.get("refresh") === "1";
    if (forced) {
      const now = Date.now();
      if (now - lastForcedRefresh < FORCE_REFRESH_GAP_MS) {
        const data = await loadSheetData();
        return json({ ...summarise(data), throttled: true }, "no-store");
      }
      lastForcedRefresh = now;
      const data = await loadSheetData({ force: true });
      return json({ ...summarise(data), refreshed: true }, "no-store");
    }

    const data = await loadSheetData();
    // Served from the edge briefly, then refreshed in the background while the
    // stale copy keeps answering — viewers never wait on Google.
    return json(summarise(data), "public, max-age=0, s-maxage=10, stale-while-revalidate=60");
  }

  if (pathname.startsWith("/api/drive-image/")) {
    const fileId = pathname.slice("/api/drive-image/".length);
    // Drive file IDs are alphanumeric plus - and _ — reject anything else
    // before it reaches the Drive API URL.
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return json({ error: "Invalid file id" }, "no-store", 400);
    }

    const config = readDriveConfig();
    if (!config) return json({ error: "Drive not configured" }, "no-store", 404);

    try {
      const { body, contentType } = await fetchFileMedia(config, fileId);
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": contentType,
          // File IDs are stable even when a photo is renamed, so this is safe
          // to cache hard — a CDN can serve it without hitting Drive again.
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      console.error("[drive] image proxy failed:", error);
      return json({ error: "Image not found" }, "no-store", 404);
    }
  }

  if (pathname.startsWith("/api/drive-thumb/")) {
    const fileId = pathname.slice("/api/drive-thumb/".length);
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return json({ error: "Invalid file id" }, "no-store", 400);
    }

    const config = readDriveConfig();
    if (!config) return json({ error: "Drive not configured" }, "no-store", 404);

    try {
      const { body, contentType } = await fetchFileThumbnail(config, fileId);
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": contentType,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      console.error("[drive] thumbnail proxy failed:", error);
      // Drive hasn't finished processing a fresh upload yet, most likely. Say
      // so briefly rather than caching a miss for a year.
      return json({ error: "Thumbnail not available" }, "no-store", 404);
    }
  }

  if (pathname === "/api/sheet-status") {
    const data = await loadSheetData();
    return json(
      {
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
      },
      // Diagnostics must never be stale — that is the whole point of them.
      "no-store",
    );
  }

  return json({ error: "Not found" }, "no-store", 404);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const api = await handleApi(request);
      if (api) return api;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
