/**
 * Photograph every card of a lesson, as the app draws it, without a browser
 * in front of anyone: the dev server's `#/proof/N` page lists the words large,
 * headless Chrome screenshots it in chunks, and the PNGs can be read back —
 * by the author, or by a reviewer that reads images — to check every mark.
 *
 *   node scripts/snap-proof.mjs 7 [outDir] [perChunk]
 *
 * Needs the dev server running on :5173 (`npm run dev`), and Chrome.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const lessonNo = Number(process.argv[2] || 7);
const outDir = resolve(process.argv[3] || `proof-${lessonNo}`);
const per = Number(process.argv[4] || 12);
mkdirSync(outDir, { recursive: true });

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => { try { readFileSync(p, { flag: 'r' }); return true; } catch { return false; } });
if (!CHROME) throw new Error('Need Chrome or Edge.');

const words = JSON.parse(readFileSync(resolve(`public/lessons/lesson${String(lessonNo).padStart(2, '0')}/words.json`), 'utf8')).words;
const ids = words.map((w) => w.id);
const ROW = 150; // px per card on the proof page, see ProofPage.tsx

for (let k = 0; k < ids.length; k += per) {
  const chunk = ids.slice(k, k + per);
  const from = chunk[0];
  const to = chunk[chunk.length - 1];
  const file = resolve(outDir, `cards-${String(from).padStart(3, '0')}-${String(to).padStart(3, '0')}.png`);
  const height = chunk.length * ROW + 40;
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    `--window-size=1100,${height}`,
    '--virtual-time-budget=8000',
    `--screenshot=${file}`,
    `http://localhost:5173/#/proof/${lessonNo}?from=${from}&to=${to}`,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(file);
}
