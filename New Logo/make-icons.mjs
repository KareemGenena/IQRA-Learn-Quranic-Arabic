/**
 * Build the PWA icon set from the Canva exports in this folder.
 *
 *   node "New Logo/make-icons.mjs"           → New Logo/out/
 *   node "New Logo/make-icons.mjs" --install → also copy into app/public/
 *
 * Every icon uses the FAVICON file's mark — the mihrab with the single ٱ.
 * The three-line mark from the logo lockup was tried first and dropped:
 * اقرأ وارتق ورتل is unreadable at icon sizes (author's call, 2026-08-16).
 * The lockup remains the full logo for headers and print.
 *
 * The sources are 2000×2000 opaque PNGs. Corrections on the way through:
 *
 * - Text elements carry near-white fills that sit as faint rectangles on the
 *   cream interior. Interior, boxes and paper are all within ~5 levels of
 *   white, and the darkest ink is far below, so a white-point clip at 248
 *   flattens them into one uniform white without touching a stroke. The clip
 *   level was measured against these exact pixels — re-measure if the Canva
 *   files are re-exported.
 *
 * - Each mark is auto-trimmed to its bounding box and re-margined, so the
 *   composition does not depend on where the mark sat on the Canva canvas.
 *
 * The favicon's background is knocked out by FLOOD FILL from the image edges,
 * never by "remove white": the mihrab's interior is the same white as the
 * background, and only connectivity tells them apart. The mark is a solid
 * light shape, so it reads on dark browser tabs as a light silhouette.
 *
 * apple-touch-icon stays fully opaque: iOS composites transparency onto
 * black. The maskable icon keeps the mark inside the central 80% circle.
 */
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..', 'app');
const sharp = createRequire(resolve(app, 'package.json'))('sharp');

const FAV = resolve(here, 'IQRA LMS - FAVICON.png');
const out = resolve(here, 'out');
mkdirSync(out, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255 };

/** Flatten near-white to white, then trim to the mark's bounding box. */
async function mark(file, region) {
  const flat = await sharp(file)
    .extract(region)
    .linear(255 / 248, 0) // white-point clip: ≥248 → 255
    .toBuffer();
  return sharp(flat).trim({ background: '#ffffff', threshold: 12 }).toBuffer();
}

/**
 * Make the background transparent by flooding near-white pixels connected to
 * the image border — never by "remove white", because the mihrab interior is
 * the same white as the background and only connectivity tells them apart.
 *
 * A naive flood is not enough either: the white channel between the arch's
 * two outline strokes runs down to the feet and opens into the book area, so
 * an unconstrained fill goes around the strokes and hollows out the whole
 * mark (found by painting the flooded set red and looking at it). So the
 * flood is kept SEAL px away from any ink, which closes every channel — they
 * are all bounded by ink on both sides — and afterwards it reclaims just that
 * sealed margin with a BFS bounded to SEAL+3 steps, too short to travel a
 * channel. Throws if the interior went transparent anyway.
 */
async function knockout(markBuf) {
  const { data, info } = await sharp(markBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const SEAL = 6;
  const nearWhite = (p) => data[p * 4] >= 244 && data[p * 4 + 1] >= 244 && data[p * 4 + 2] >= 244;
  const neighbours = (p, fn) => {
    const x = p % W;
    if (x > 0) fn(p - 1);
    if (x < W - 1) fn(p + 1);
    if (p >= W) fn(p - W);
    if (p < W * (H - 1)) fn(p + W);
  };

  // Distance-to-ink, multi-source BFS, capped at SEAL.
  const dist = new Int8Array(W * H).fill(-1);
  let frontier = [];
  for (let p = 0; p < W * H; p++) if (!nearWhite(p)) { dist[p] = 0; frontier.push(p); }
  for (let d = 1; d <= SEAL && frontier.length; d++) {
    const next = [];
    for (const p of frontier) neighbours(p, (q) => { if (dist[q] === -1) { dist[q] = d; next.push(q); } });
    frontier = next;
  }
  const sealed = (p) => dist[p] !== -1; // within SEAL of ink

  // Pass 1: flood from the border, staying clear of the seal.
  const flooded = new Uint8Array(W * H);
  const queue = [];
  const seed = (p) => { if (!flooded[p] && nearWhite(p) && !sealed(p)) { flooded[p] = 1; queue.push(p); } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (queue.length) neighbours(queue.pop(), seed);

  // Pass 2: reclaim the sealed margin — a bounded BFS cannot travel a channel.
  let edge = [];
  for (let p = 0; p < W * H; p++) if (flooded[p]) edge.push(p);
  for (let d = 0; d < SEAL + 3; d++) {
    const next = [];
    for (const p of edge) neighbours(p, (q) => { if (!flooded[q] && nearWhite(q)) { flooded[q] = 1; next.push(q); } });
    edge = next;
  }

  for (let p = 0; p < W * H; p++) if (flooded[p]) data[p * 4 + 3] = 0;

  // The arch interior must have stayed opaque — probe the region around the ٱ.
  for (const [fx, fy] of [[0.5, 0.4], [0.5, 0.55], [0.4, 0.5], [0.6, 0.5]]) {
    const p = Math.round(fy * H) * W + Math.round(fx * W);
    if (data[p * 4 + 3] === 0) throw new Error(`flood fill leaked into the mark interior at ${fx},${fy}`);
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

/** Center `markBuf` on a square, its long side `frac` of the canvas. */
async function tile(markBuf, size, frac, file, background) {
  const box = Math.round(size * frac);
  const scaled = await sharp(markBuf)
    .resize(box, box, { fit: 'inside', kernel: 'lanczos3' })
    .toBuffer();
  const m = await sharp(scaled).metadata();
  const bg = background
    ? { width: size, height: size, channels: 3, background }
    : { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  await sharp({ create: bg })
    .composite([{ input: scaled, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(out, file));
  console.log(file.padEnd(22), `${size}×${size}  mark at ${Math.round(frac * 100)}%  ${background ? 'white plate' : 'transparent'}`);
}

// Region found by scanning for ink; trim() finds the exact box inside it.
// The bottom stops at y=1345: the book's tip ends there and the Canva canvas
// edge line sits at y≈1355 — leave it in and the line, not the mark, sets the
// trim box (it showed as a grey streak under the book in the first favicon).
const favMark = await mark(FAV, { left: 550, top: 450, width: 900, height: 895 });
const favMarkClear = await knockout(favMark);

await tile(favMark, 512, 0.84, 'pwa-512.png', WHITE);
await tile(favMark, 192, 0.84, 'pwa-192.png', WHITE);
await tile(favMark, 180, 0.80, 'apple-touch-icon.png', WHITE);
// maskable: launchers crop to a circle over the central 80% — everything
// outside it must be plain background. 0.62 keeps the full mark inside.
await tile(favMark, 512, 0.62, 'maskable-512.png', WHITE);
// The tab is the smallest canvas the brand ever gets: transparent, nearly
// full-bleed, so the mark is as large as the tab will allow.
await tile(favMarkClear, 256, 0.96, 'favicon.png');

if (process.argv.includes('--install')) {
  for (const f of ['pwa-512.png', 'pwa-192.png', 'apple-touch-icon.png', 'maskable-512.png', 'favicon.png']) {
    copyFileSync(resolve(out, f), resolve(app, 'public', f));
    console.log('installed', f);
  }
}
