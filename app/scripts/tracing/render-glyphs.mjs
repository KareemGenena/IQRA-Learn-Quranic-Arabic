/**
 * Renders the 29 letters of lesson 20, large, in the app's own font, for
 * derive-strokes.mjs to thin. Headless Chrome draws a 6×5 grid of 600 px
 * cells at 400 px type into <workdir>/sheet.png and writes the letter list
 * beside it. Needs Chrome; the dev server is not needed (a file:// page).
 *
 *   node scripts/tracing/render-glyphs.mjs <workdir>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const work = resolve(process.argv[2] ?? join(here, 'work'));
mkdirSync(work, { recursive: true });

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  .find((p) => { try { readFileSync(p, { flag: 'r' }); return true; } catch { return false; } });
if (!CHROME) throw new Error('Need Chrome or Edge.');

const words = JSON.parse(readFileSync(join(here, '..', '..', 'public', 'lessons', 'lesson20', 'words.json'), 'utf8')).words;
const letters = words.map((w) => w.letter);
writeFileSync(join(work, 'letters.json'), JSON.stringify(letters));

const font = 'file:///' + resolve(here, '..', '..', 'public', 'fonts', 'UthmanicHafs1-Ver09.otf').replace(/\\/g, '/');
const CELL = 600, COLS = 6;
const html =
  `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:H;src:url("${font}")} body{margin:0;background:#fff}` +
  `.g{display:grid;grid-template-columns:repeat(${COLS},${CELL}px)} .c{width:${CELL}px;height:${CELL}px;display:flex;align-items:center;justify-content:center;font:400px H;color:#000;line-height:1}</style>` +
  `<div class="g">${letters.map((l) => `<div class="c" dir="rtl" lang="ar">${l}</div>`).join('')}</div>`;
const page = join(work, 'sheet.html');
writeFileSync(page, html);
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--window-size=${COLS * CELL},${Math.ceil(letters.length / COLS) * CELL}`, '--virtual-time-budget=6000',
  `--screenshot=${join(work, 'sheet.png')}`, 'file:///' + page.replace(/\\/g, '/'),
], { stdio: ['ignore', 'ignore', 'inherit'] });
console.log(`${letters.length} letters rendered: ${join(work, 'sheet.png')}`);
