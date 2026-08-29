/**
 * Minimal read-only Google Drive client, matching the style of
 * `../sheets/client.ts`: no `googleapis` dependency, WebCrypto JWT signing so
 * it runs the same on Node, Vercel and Cloudflare Workers.
 *
 * Reuses the same service account as the Sheets integration — nothing new to
 * configure beyond enabling the Drive API and sharing the photo folder(s)
 * with GOOGLE_SA_EMAIL.
 *
 * This module must only ever be imported from server code — it reads secrets.
 */
declare const process: { env: Record<string, string | undefined> };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export type DriveConfig = {
  clientEmail: string;
  privateKey: string;
};

/** Returns null when the service account isn't configured. */
export function readDriveConfig(): DriveConfig | null {
  const clientEmail = process.env["GOOGLE_SA_EMAIL"]?.trim();
  const rawKey = process.env["GOOGLE_SA_PRIVATE_KEY"];
  if (!clientEmail || !rawKey) return null;

  return {
    clientEmail,
    privateKey: rawKey
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\\n/g, "\n"),
  };
}

/* ------------------------------------------------------------------ *
 * JWT signing + token cache (identical approach to the Sheets client)
 * ------------------------------------------------------------------ */

function base64Url(bytes: ArrayBuffer | string) {
  const binary = typeof bytes === "string" ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(config: DriveConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(config.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );

  return `${header}.${claims}.${base64Url(signature)}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: DriveConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await signJwt(config),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google rejected the service account (${response.status}). ` +
        `Check GOOGLE_SA_EMAIL and GOOGLE_SA_PRIVATE_KEY. ${detail.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
  return payload.access_token;
}

/* ------------------------------------------------------------------ *
 * Listing a folder
 * ------------------------------------------------------------------ */

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

async function apiError(response: Response, config: DriveConfig): Promise<Error> {
  const detail = await response.text();

  if (response.status === 403 && detail.includes("PERMISSION_DENIED")) {
    return new Error(
      `Drive folder not shared. Open the folder, click Share, and add ` +
        `${config.clientEmail} as a Viewer.`,
    );
  }
  if (response.status === 403 && detail.includes("has not been used in project")) {
    return new Error(
      `The Google Drive API is not enabled for this project. Enable it in the ` +
        `Cloud console, then retry. ${detail.slice(0, 200)}`,
    );
  }
  if (response.status === 404) {
    return new Error(`Drive folder not found — check the folder ID/link.`);
  }
  return new Error(`Drive API error ${response.status}: ${detail.slice(0, 200)}`);
}

/** Every image directly inside a folder (non-recursive), newest first. */
export async function listFolderImages(
  config: DriveConfig,
  folderId: string,
): Promise<DriveFile[]> {
  const token = await getAccessToken(config);

  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, createdTime)",
      orderBy: "createdTime desc",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${DRIVE_API}/files?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw await apiError(response, config);

    const payload = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return files;
}

/** Streams a single file's bytes — used by the `/api/drive-image/:id` proxy. */
export async function fetchFileMedia(
  config: DriveConfig,
  fileId: string,
): Promise<{ body: ReadableStream<Uint8Array> | null; contentType: string }> {
  const token = await getAccessToken(config);
  const response = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw await apiError(response, config);

  return {
    body: response.body,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}
