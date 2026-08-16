/**
 * Build the IQRA brand artwork.
 *
 *   node Brand/build.mjs            everything
 *   node Brand/build.mjs sheet      one variant
 *
 * Why a renderer and not a drawing:
 *
 * The three lines in the mark are the hadith «ٱقۡرَأۡ وَٱرۡتَقِ وَرَتِّلۡ», and they are
 * set in the app's own KFGQPC Uthmanic Hafs — the same file `index.css` serves
 * to a learner. That is the whole point: the alif wasla keeps its صـ and the
 * sukoon is the head of khah (U+06E1), because the logo is spelled by the same
 * rules the lessons are. A traced or hand-drawn logo drifts from the text the
 * moment either changes; this one cannot.
 *
 * Headless Chrome does the shaping, so the mark positioning in the logo comes
 * out of HarfBuzz — the same engine that lays out the words in a lesson.
 *
 * The font is embedded into a generated `font.css` as a byte-identical base64
 * copy. It is never subset and never converted: the licence permits use and
 * redistribution but not modification, and the app has already learned once
 * that this font's mark positioning is the authority (see CLAUDE.md).
 * `font.css` is generated, so it is not committed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..', 'app');
const sharp = createRequire(resolve(app, 'package.json'))('sharp');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => { try { readFileSync(p, { flag: 'r' }); return true; } catch { return false; } });
if (!CHROME) throw new Error('Need Chrome or Edge to render the artwork.');

// A byte-identical copy of the shipped face, inlined so the page has no
// cross-origin font fetch to negotiate under file://.
const otf = readFileSync(resolve(app, 'public/fonts/UthmanicHafs1-Ver09.otf'));
writeFileSync(resolve(here, 'font.css'),
  `@font-face{font-family:'UH';src:url(data:font/otf;base64,${otf.toString('base64')}) format('opentype');font-display:block;}`);

const out = resolve(here, 'out');
mkdirSync(out, { recursive: true });

const jobs = [
  // variant     file                    w     h    supersample
  ['sheet',    'sheet.png',            1536, 1024, 1],
  ['proof',    'proof.png',             900,  700, 1],
  ['lockup',   'lockup.png',           1600,  560, 2],
  ['mark',     'mark-1024.png',         720, 1080, 2],
  ['icon',     'pwa-512.png',           512,  512, 2],
  ['icon',     'pwa-192.png',           192,  192, 4],
  ['square',   'apple-touch-icon.png',  180,  180, 4],
  ['maskable', 'maskable-512.png',      512,  512, 2],
  ['favicon',  'favicon.png',           256,  256, 4],
];

const only = process.argv[2];
for (const [v, file, w, h, ss] of jobs) {
  if (only && v !== only && !file.includes(only)) continue;

  /* Supersampling is done by drawing the artwork `ss` times larger in CSS, not
   * with --force-device-scale-factor: that flag divides the window into CSS
   * pixels, so the artwork overflowed a viewport a quarter of its size and the
   * 192 icon came out as a sliver of green. Size in, size out. */
  const size = (['sheet', 'proof', 'lockup', 'mark'].includes(v) ? Math.min(w, h) : w) * ss;
  const raw = resolve(out, `_raw-${file}`);
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--default-background-color=00000000',
    `--window-size=${w * ss},${h * ss}`,
    '--virtual-time-budget=6000',
    `--screenshot=${raw}`,
    `file:///${resolve(here, 'art.html').replace(/\\/g, '/')}?v=${v}&s=${size}`,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });

  await sharp(raw)
    .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(resolve(out, file));
  rmSync(raw);
  console.log(`${file.padEnd(22)} ${w}×${h}${ss > 1 ? `  (rendered ${ss}× and downsampled)` : ''}`);
}
