/**
 * Server-side loader for a tournament's Drive folder. One folder holds both the
 * photos and the videos; this splits them by mime type so the page can show
 * each in its own tab.
 *
 * Never throws — if a folder is unreachable the caller keeps whatever it had.
 */
import {
  fetchFileMedia,
  fetchFileThumbnail,
  listFolderMedia,
  readDriveConfig,
  type DriveFile,
} from "./client";

export type GalleryItem = { src: string; caption: string };

export type VideoItem = {
  /** Drive file id — the page builds the player and poster URLs from it. */
  id: string;
  title: string;
  /** "1:42", or empty while Drive is still processing the upload. */
  duration: string;
  /**
   * Width over height, so the card can be given the shape the clip actually is.
   * Everything here is filmed on a phone and most of it is portrait; pouring
   * that into a 16:9 box is what produces the black pillars either side.
   */
  aspect: number;
  /** Poster frame, through our own proxy — see `fetchFileThumbnail`. */
  poster: string;
  meta: string;
  /**
   * Whether a visitor can actually watch it. Photos come through our own proxy
   * so folder sharing is enough, but a video plays straight from Google in the
   * visitor's browser and needs "anyone with the link".
   */
  shared: boolean;
};

export type FolderMedia = { gallery: GalleryItem[]; videos: VideoItem[] };

/** How long a folder listing is served before we re-read it from Drive. */
const TTL_MS = 60_000;

const EMPTY: FolderMedia = { gallery: [], videos: [] };

const cache = new Map<string, { media: FolderMedia; fetchedAt: number }>();
const inFlight = new Map<string, Promise<FolderMedia>>();

const stripExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, "");

/**
 * Width over height. Falls back to 16:9 rather than guessing: an unknown shape
 * drawn wide is the layout we already had, while an unknown shape drawn tall
 * would be a new way to be wrong.
 */
function aspectOf(meta: DriveFile["videoMediaMetadata"]): number {
  const width = Number(meta?.width);
  const height = Number(meta?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 16 / 9;
  }
  return width / height;
}

/** 102000 -> "1:42". Empty when Drive hasn't reported a duration yet. */
function formatDuration(millis: string | undefined): string {
  const total = Number(millis);
  if (!Number.isFinite(total) || total <= 0) return "";
  const seconds = Math.round(total / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Drive serves a thumbnail only for a file anyone with the link can open;
 * everything else ends up at a sign-in page instead. So ask for the thumbnail
 * as a visitor's browser would and see whether an actual image comes back.
 *
 * Note the redirect: this endpoint always bounces to Google's image host, for
 * public and private files alike, so the redirect itself says nothing. Only
 * what it lands on does.
 */
async function isPubliclyViewable(id: string): Promise<boolean> {
  try {
    const response = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w320`);
    const isImage =
      response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
    await response.body?.cancel();
    return isImage;
  } catch {
    return false;
  }
}

function split(files: DriveFile[]): FolderMedia {
  const gallery: GalleryItem[] = [];
  const videos: VideoItem[] = [];

  for (const file of files) {
    const title = stripExtension(file.name);
    if (file.mimeType.startsWith("video/")) {
      videos.push({
        id: file.id,
        title,
        duration: formatDuration(file.videoMediaMetadata?.durationMillis),
        aspect: aspectOf(file.videoMediaMetadata),
        poster: `/api/drive-thumb/${file.id}`,
        meta: "",
        shared: false, // filled in below
      });
    } else if (file.mimeType.startsWith("image/")) {
      // Photos are proxied through us, so the folder only ever needs sharing
      // with the reader account. Videos are different — see the page.
      gallery.push({ src: `/api/drive-image/${file.id}`, caption: title });
    }
  }

  return { gallery, videos };
}

async function readFolder(folderId: string): Promise<FolderMedia> {
  const config = readDriveConfig();
  if (!config) return cache.get(folderId)?.media ?? EMPTY;

  try {
    const media = split(await listFolderMedia(config, folderId));
    const videos = await Promise.all(
      media.videos.map(async (video) => ({
        ...video,
        shared: await isPubliclyViewable(video.id),
      })),
    );
    const withSharing = { ...media, videos };
    cache.set(folderId, { media: withSharing, fetchedAt: Date.now() });
    return withSharing;
  } catch (error) {
    console.error(`[drive] folder ${folderId} read failed:`, error);
    // Prefer the last good copy over dropping photos during the event.
    return cache.get(folderId)?.media ?? EMPTY;
  }
}

/** Cached per-folder read; concurrent callers for the same folder share one request. */
export async function loadFolderMedia(
  folderId: string,
  options?: { force?: boolean },
): Promise<FolderMedia> {
  const cached = cache.get(folderId);
  if (!options?.force && cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.media;
  }

  const existing = inFlight.get(folderId);
  if (existing) return existing;

  const promise = readFolder(folderId).finally(() => {
    inFlight.delete(folderId);
  });
  inFlight.set(folderId, promise);
  return promise;
}

export { fetchFileMedia, fetchFileThumbnail, readDriveConfig };
