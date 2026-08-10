/**
 * Proves that the browser's take checker and the generator's splitter are the
 * same algorithm.
 *
 * The intake system tells the author, in the room, whether a take will survive
 * `splitIntoN` later. That promise is only worth anything if the two agree, so
 * this runs both over every recording the project has — at one, two and three
 * pieces each — and compares the cut durations.
 *
 * `src/lib/takeCheck.ts` is TypeScript meant for the browser; Node strips the
 * types and runs it directly, so the file under test is the file that ships
 * rather than a copy that would drift.
 *
 * Run:  node scripts/check-take-parity.mjs
 */

import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readWav, splitIntoN } from './lib/wav.mjs';
import { checkTake } from '../src/lib/takeCheck.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

/** The first channel as floats — the same samples `readWav` reads. */
function channelZero(wav) {
  const { buf, dataStart, bytesPerFrame, frames } = wav;
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) out[f] = buf.readInt16LE(dataStart + f * bytesPerFrame) / 32768;
  return out;
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.toLowerCase().endsWith('.wav')) files.push(path);
  }
})(join(root, 'Audio'));

let compared = 0;
const mismatches = [];
for (const path of files) {
  const wav = readWav(path);
  const samples = channelZero(wav);
  for (const count of [1, 2, 3]) {
    const mine = checkTake(samples, wav.sampleRate, count);
    const theirs = splitIntoN(wav, count);
    compared += 1;

    const same =
      mine.durations.length === theirs.durations.length &&
      mine.durations.every((d, i) => Math.abs(d - theirs.durations[i]) < 1e-9) &&
      mine.suspicious === theirs.suspicious;
    if (!same) {
      mismatches.push(
        `${path.slice(root.length + 1)} @${count}\n` +
          `    generator: ${theirs.durations.map((d) => d.toFixed(3)).join(' / ')} (suspicious ${theirs.suspicious})\n` +
          `    intake:    ${mine.durations.map((d) => d.toFixed(3)).join(' / ')} (suspicious ${mine.suspicious})`,
      );
    }
  }
}

console.log(`${files.length} recordings · ${compared} comparisons`);
if (mismatches.length) {
  console.log(`\nDISAGREEMENTS (${mismatches.length}):\n  ${mismatches.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('parity: the intake gate and the generator cut identically');
}
