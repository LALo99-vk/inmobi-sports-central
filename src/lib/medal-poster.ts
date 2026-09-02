/**
 * Turns a medal on the podium into something a winner can post.
 *
 * The disc is inline SVG, so the only way to keep it today is a screenshot and
 * a crop. This paints a square poster instead — the disc, the name, the house
 * and the event — and saves it as a PNG.
 *
 * The one real difficulty is fonts. An SVG loaded into an `<img>` is its own
 * document: it cannot reach this page's stylesheets, so `var(--font-display)`
 * resolves to nothing and the engraving around the rim comes out in whatever
 * the browser falls back to. So the clone gets literal family names and the
 * font itself inlined as base64 before it is serialised. Everything drawn
 * directly on the canvas is fine as-is — `fillText` uses the document's fonts.
 */

/** The poster is square: it survives WhatsApp, Slack and Instagram unchanged. */
const SIZE = 1080;

/** The site's ink, from `public/favicon.svg` — the one place it is a literal. */
const INK = "#1B2044";
const INK_DEEP = "#141936";
const PAPER = "#F7F5F0";
const MUTED = "rgba(247, 245, 240, 0.62)";
const ACCENT = "#E9661F";

const DISPLAY = "Archivo, ui-sans-serif, system-ui, sans-serif";
const BODY = "Barlow, ui-sans-serif, system-ui, sans-serif";
const MEDAL_FACE = '"Cormorant Garamond", ui-serif, Georgia, serif';

/**
 * Archivo, the face the disc engraves with. Only the weights the disc actually
 * uses, and only the latin block — the whole family would be several hundred
 * kilobytes for a handful of glyphs.
 */
const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&display=swap";

/** Fetched once per page load, however many medals get saved. */
let facesPromise: Promise<string> | null = null;

async function inlinedFontFaces(): Promise<string> {
  facesPromise ??= (async () => {
    try {
      const css = await fetch(FONT_CSS_URL).then((r) => (r.ok ? r.text() : ""));
      const blocks = css.match(/@font-face\s*{[^}]+}/g) ?? [];
      // Google splits a family across unicode-ranges; the latin one carries
      // every character a name on this medal can contain.
      const latin = blocks.filter((b) => b.includes("U+0000-00FF"));
      const inlined = await Promise.all(
        latin.map(async (block) => {
          const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
          if (!url) return "";
          const buffer = await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null));
          if (!buffer) return "";
          let binary = "";
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
          const data = `url("data:font/woff2;base64,${btoa(binary)}") format("woff2")`;
          return block.replace(/src:[^;]+;/, `src: ${data};`);
        }),
      );
      return inlined.filter(Boolean).join("\n");
    } catch {
      // A poster with the wrong face still beats no poster; the caller is not
      // told, because there is nothing useful for a winner to do about it.
      return "";
    }
  })();
  return facesPromise;
}

/** The disc, as an image, with its fonts baked in. */
async function discImage(
  svg: SVGSVGElement,
  width: number,
  height: number,
): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("class");

  // Custom properties do not exist inside the detached document.
  clone.querySelectorAll("[font-family]").forEach((node) => {
    if ((node.getAttribute("font-family") ?? "").includes("var(")) {
      node.setAttribute("font-family", DISPLAY);
    }
  });

  const faces = await inlinedFontFaces();
  if (faces) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = faces;
    clone.insertBefore(style, clone.firstChild);
  }

  const markup = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  image.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The medal could not be drawn."));
    image.src = url;
  });
  return image;
}

/**
 * Shrinks text until it fits, then wraps if shrinking alone is not enough.
 * "Venkataramanan Subramanian" has to land as gracefully as "Anees".
 */
function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  maxWidth: number,
  start: number,
  min: number,
): { lines: string[]; size: number } {
  let size = start;
  while (size > min) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) return { lines: [text], size };
    size -= 2;
  }

  ctx.font = font(size);
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return { lines, size };
}

export type PosterInput = {
  /** The rendered disc, taken straight off the podium. */
  disc: SVGSVGElement;
  /** Who won: already joined, e.g. "Anees & Anubhav". */
  name: string;
  house: string;
  houseColor: string;
  sport: string;
  /** "Men's Singles", or empty for a sport with one event. */
  category: string;
  place: "Gold" | "Silver" | "Bronze";
};

/** Paints the poster and hands back a PNG. */
export async function buildPoster(input: PosterInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the poster.");

  // Ground, matching the ink panel the podium sits on.
  const ground = ctx.createLinearGradient(0, 0, SIZE * 0.4, SIZE);
  ground.addColorStop(0, INK);
  ground.addColorStop(1, INK_DEEP);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // The disc keeps its own 200x246 proportions, ribbon included.
  const discW = 500;
  const discH = (discW / 200) * 246;
  const image = await discImage(input.disc, discW * 2, discH * 2);
  ctx.drawImage(image, (SIZE - discW) / 2, 96, discW, discH);

  await document.fonts.ready;
  ctx.textAlign = "center";

  // The event, over the name.
  const eventLine = [input.sport, input.category].filter(Boolean).join(" · ").toUpperCase();
  ctx.font = `600 26px ${BODY}`;
  ctx.fillStyle = ACCENT;
  ctx.letterSpacing = "4px";
  ctx.fillText(eventLine, SIZE / 2, 812);
  ctx.letterSpacing = "0px";

  // The name, in the podium's own face.
  const { lines, size } = fitLines(
    ctx,
    input.name,
    (s) => `600 ${s}px ${MEDAL_FACE}`,
    SIZE - 140,
    82,
    46,
  );
  ctx.fillStyle = PAPER;
  ctx.font = `600 ${size}px ${MEDAL_FACE}`;
  lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, 888 + i * (size * 1.1)));

  const afterName = 888 + (lines.length - 1) * (size * 1.1);

  // The house, with its colour beside it.
  ctx.font = `500 30px ${BODY}`;
  const houseWidth = ctx.measureText(input.house).width;
  const barX = SIZE / 2 - houseWidth / 2 - 24;
  ctx.fillStyle = input.houseColor;
  ctx.fillRect(barX, afterName + 26, 6, 30);
  ctx.fillStyle = MUTED;
  ctx.fillText(input.house, SIZE / 2 + 8, afterName + 50);

  // The footer, quiet.
  ctx.font = `600 22px ${DISPLAY}`;
  ctx.fillStyle = "rgba(247, 245, 240, 0.38)";
  ctx.letterSpacing = "3px";
  ctx.fillText(`${input.place.toUpperCase()} · INMOBI SPORTS DAY 2026`, SIZE / 2, SIZE - 54);
  ctx.letterSpacing = "0px";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The poster could not be saved."))),
      "image/png",
    );
  });
}

/** A filename someone can find again in their downloads. */
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Saves the poster to the visitor's downloads. */
export function downloadPoster(blob: Blob, input: PosterInput): void {
  const filename = `${slugify(input.sport)}-${slugify(input.name)}-${input.place.toLowerCase()}.png`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking in the same tick cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
