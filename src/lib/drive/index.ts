/**
 * Server-side loader for tournament gallery photos. Given a Drive folder ID,
 * returns the gallery items the tournament page renders. Never throws — if a
 * folder is unreachable the caller keeps whatever gallery it already had.
 */
import { fetchFileMedia, listFolderImages, readDriveConfig, type DriveFile } from "./client";

export type GalleryItem = { src: string; caption: string };

/** How long a folder listing is served before we re-read it from Drive. */
const TTL_MS = 60_000;

const cache = new Map<string, { items: GalleryItem[]; fetchedAt: number }>();
const inFlight = new Map<string, Promise<GalleryItem[]>>();

const stripExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, "");

function toGalleryItems(files: DriveFile[]): GalleryItem[] {
  return files.map((file) => ({
    src: `/api/drive-image/${file.id}`,
    caption: stripExtension(file.name),
  }));
}

async function readFolder(folderId: string): Promise<GalleryItem[]> {
  const config = readDriveConfig();
  if (!config) return cache.get(folderId)?.items ?? [];

  try {
    const files = await listFolderImages(config, folderId);
    const items = toGalleryItems(files);
    cache.set(folderId, { items, fetchedAt: Date.now() });
    return items;
  } catch (error) {
    console.error(`[drive] folder ${folderId} read failed:`, error);
    // Prefer the last good copy over dropping photos during the event.
    return cache.get(folderId)?.items ?? [];
  }
}

/** Cached per-folder read; concurrent callers for the same folder share one request. */
export async function loadGallery(
  folderId: string,
  options?: { force?: boolean },
): Promise<GalleryItem[]> {
  const cached = cache.get(folderId);
  if (!options?.force && cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.items;
  }

  const existing = inFlight.get(folderId);
  if (existing) return existing;

  const promise = readFolder(folderId).finally(() => {
    inFlight.delete(folderId);
  });
  inFlight.set(folderId, promise);
  return promise;
}

export { fetchFileMedia, readDriveConfig };
