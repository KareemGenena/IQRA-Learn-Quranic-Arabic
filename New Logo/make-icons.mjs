/**
 * Build the PWA icon set from the two Canva exports in this folder.
 *
 *   node "New Logo/make-icons.mjs"           → New Logo/out/
 *   node "New Logo/make-icons.mjs" --install → also copy into app/public/
 *
 * The sources are 2000×2000 opaque PNGs. Two things are corrected on the way:
 *
 * - The text elements in the logo carry near-white fills, which sit as faint
 *   rectangles on the cream interior. Interior, boxes and paper are all within
 *   ~5 levels of white, and the darkest ink is far below, so a white-point
 *   clip at 248 flattens all three into one uniform white without touching a
 *   stroke. That is also why this must be re-run if the Canva files are
 *   re-exported — the clip level was measured against these exact pixels.
 *
 * - Each mark is auto-trimmed to its bounding box and re-margined, so the
 *   composition does not depend on where the mark happened to sit on the
 *   Canva canvas.
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

const LOGO = resolve(here, 'IQRA LMS - Recite and Rise - Logo.png');
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

/** Center `markBuf` on a white square, its long side `frac` of the canvas.
 *  The book's wings make the mark wider than it is tall, so sizing by height
 *  alone overflowed the canvas. */
async function plate(markBuf, size, frac, file) {
  const box = Math.round(size * frac);
  const scaled = await sharp(markBuf)
    .resize(box, box, { fit: 'inside', kernel: 'lanczos3' })
    .toBuffer();
  const m = await sharp(scaled).metadata();
  await sharp({ create: { width: size, height: size, channels: 3, background: WHITE } })
    .composite([{ input: scaled, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(out, file));
  console.log(file.padEnd(22), `${size}×${size}  mark at ${Math.round(frac * 100)}%`);
}

// Regions found by scanning for ink (see the README): the crop must stop
// short of the IQRA wordmark to the right and the canvas edge line below,
// or trim() dutifully keeps both. Ink box measured: x 328–890, y 463–1170.
const logoMark = await mark(LOGO, { left: 300, top: 430, width: 620, height: 770 });
const favMark = await mark(FAV, { left: 550, top: 450, width: 900, height: 1000 });

await plate(logoMark, 512, 0.82, 'pwa-512.png');
await plate(logoMark, 192, 0.82, 'pwa-192.png');
await plate(logoMark, 180, 0.78, 'apple-touch-icon.png');
// maskable: launchers crop to a circle over the central 80% — everything
// outside it must be plain background. 0.62 keeps the full mark inside.
await plate(logoMark, 512, 0.62, 'maskable-512.png');
await plate(favMark, 256, 0.86, 'favicon.png');

if (process.argv.includes('--install')) {
  for (const f of ['pwa-512.png', 'pwa-192.png', 'apple-touch-icon.png', 'maskable-512.png', 'favicon.png']) {
    copyFileSync(resolve(out, f), resolve(app, 'public', f));
    console.log('installed', f);
  }
}
