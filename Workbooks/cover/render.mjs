/**
 * Renders the workbook cover and the copyright page's art with headless Chrome.
 *
 *   node Workbooks/cover/render.mjs
 *
 * Writes Workbooks/cover/out/:
 *   cover-L1.png … cover-L3.png              generic covers, "PRINTED BY" box empty
 *   cover-L1-icnbm.png … cover-L3-icnbm.png   the same with ICN Bellevue's logo and name
 *   lockup.png, divider.png, diamond.png     the copyright page's images (transparent)
 *   mark-small.png                           the IQRA mark for the section-opening headers
 *
 * Covers are US Letter at 300 dpi (2550 × 3300); `cover.html` draws them in units
 * of 0.01 in. Everything is line work on white — no tints, no gradients — so a
 * greyscale printer has nothing to turn into a smudge. Fonts are the brand's
 * Perpetua family (installed with Office); the cover is an image, so a machine
 * opening the .docx without Perpetua still prints it as designed.
 *
 * Logo clean-up, done first:
 *   - the IQRA mark comes from `New Logo/IQRA LMS - FAVICON.png` (the author's
 *     choice of mark); its near-white "cloud" behind the alif is made transparent;
 *   - ICN Bellevue's logo (`art/icnbm-logo-original.png`, 204 × 181, the copy that
 *     was in the workbooks) sits on cream; the cream is flood-filled away from the
 *     border so the logo sits on the white cover. Swap in their original file when
 *     they send it — nothing else changes.
 */
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const sharp = createRequire(resolve(ROOT, 'app/package.json'))('sharp');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
if (!CHROME) throw new Error('Need Chrome or Edge.');
const out = resolve(here, 'out');
mkdirSync(out, { recursive: true });

// ---- 1. logos -------------------------------------------------------------
{
  const { data, info } = await sharp(resolve(ROOT, 'New Logo/IQRA LMS - FAVICON.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3; if (Math.min(data[i], data[i + 1], data[i + 2]) < 190) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  x0 -= 6; y0 -= 6; x1 += 6; y1 += 6;            // the canvas's grey edge line sits further out
  const w = x1 - x0 + 1, h = y1 - y0 + 1, px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y + y0) * W + (x + x0)) * 3, o = (y * w + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const m = Math.min(r, g, b);                  // paper and the cloud are >= 242; fade 222..242
    const a = m >= 242 ? 0 : m <= 222 ? 255 : Math.round(255 * (242 - m) / 20), k = a / 255;
    const un = v => a ? Math.max(0, Math.min(255, Math.round((v - 255 * (1 - k)) / k))) : 0;
    px[o] = un(r); px[o + 1] = un(g); px[o + 2] = un(b); px[o + 3] = a;
  }
  await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toFile(resolve(here, 'art/iqra-mark.png'));
  await sharp(px, { raw: { width: w, height: h, channels: 4 } }).resize({ height: 300 }).png().toFile(resolve(out, 'mark-small.png'));
}
{
  const { data, info } = await sharp(resolve(here, 'art/icnbm-logo-original.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, seen = new Uint8Array(W * H), bg = new Uint8Array(W * H);
  const isBg = p => { const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2]; return r > 228 && g > 212 && b > 180 && r - b < 75; };
  const q = []; for (let x = 0; x < W; x++) q.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) q.push(y * W, y * W + W - 1);
  while (q.length) { const p = q.pop(); if (seen[p]) continue; seen[p] = 1; if (!isBg(p)) continue; bg[p] = 1;
    const x = p % W, y = (p / W) | 0; if (x > 0) q.push(p - 1); if (x < W - 1) q.push(p + 1); if (y > 0) q.push(p - W); if (y < H - 1) q.push(p + W); }
  const px = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    let a = bg[p] ? 0 : 255; if (!bg[p] && [-1, 1, -W, W].some(d => bg[p + d])) a = 170;   // soften the cut edge
    px[p * 4] = data[p * 3]; px[p * 4 + 1] = data[p * 3 + 1]; px[p * 4 + 2] = data[p * 3 + 2]; px[p * 4 + 3] = a;
  }
  await sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toFile(resolve(here, 'art/icnbm-logo.png'));
}

// ---- 2. Chrome renders --------------------------------------------------------
const url = (page, q) => `file:///${resolve(here, page).split('\\').join('/')}?${q}`;
const shot = (file, page, q, [w, h], dsf, transparent) => execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
  `--force-device-scale-factor=${dsf}`, `--window-size=${w},${h}`, '--virtual-time-budget=4000',
  ...(transparent ? ['--default-background-color=00000000'] : []),
  `--screenshot=${resolve(out, file)}`, url(page, q)], { stdio: ['ignore', 'ignore', 'ignore'] });

for (const L of [1, 2, 3]) {
  shot(`cover-L${L}.png`, 'cover.html', `level=${L}`, [2550, 3300], 1);
  shot(`cover-L${L}-icnbm.png`, 'cover.html', `level=${L}&printer=icnbm`, [2550, 3300], 1);
}
// copyright art at 600 dpi: CSS inches × 96 for the window, scale factor 6.25
const IN = v => Math.round(v * 96);
shot('lockup.png', 'copyright-art.html', 'part=lockup', [IN(2.4), IN(1.45)], 6.25, true);
shot('divider.png', 'copyright-art.html', 'part=divider', [IN(3.25), IN(0.14)], 6.25, true);
shot('diamond.png', 'copyright-art.html', 'part=diamond', [IN(0.12), IN(0.12)], 6.25, true);

for (const f of ['cover-L2.png', 'lockup.png', 'divider.png', 'diamond.png', 'mark-small.png']) {
  const m = await sharp(resolve(out, f)).metadata(); console.log(f.padEnd(16), `${m.width}×${m.height}`);
}
