/**
 * Splits ONE long WAV take into per-word files, cutting on the silences.
 *
 * Record a batch of words in a single take, leaving a clear pause (~1s)
 * between words, and this carves it into individual files. Nothing is
 * re-encoded — the samples are copied verbatim into new WAVs.
 *
 * Examples:
 *   node scripts/split-recording.mjs take1.wav --dry
 *   node scripts/split-recording.mjs take1.wav --out "../Audio/x" --start 5 --pairs
 *
 * Options:
 *   --gap N    silence (seconds) that separates words   (default 0.6)
 *   --pad N    padding kept around each word            (default 0.15)
 *   --floor N  silence threshold, share of peak level   (default 0.06)
 *   --min N    ignore blips shorter than this (seconds) (default 0.35)
 */

import { mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { readWav, findSegments, writeSegment } from './lib/wav.mjs';

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

if (!input) {
  console.error('Usage: node scripts/split-recording.mjs <take.wav> [--out DIR] [--start N] [--pairs] [--dry]');
  process.exit(1);
}

const outDir = resolve(flag('out', '.'));
const start = Number(flag('start', 1));
const pairs = has('pairs');
const dry = has('dry');
const opts = {
  gap: Number(flag('gap', 0.6)),
  pad: Number(flag('pad', 0.15)),
  floor: Number(flag('floor', 0.06)),
  min: Number(flag('min', 0.35)),
};

const wav = readWav(resolve(input));
const { segments, dropped } = findSegments(wav, opts);
const sec = (frames) => (frames / wav.sampleRate).toFixed(2);

const name = (i) => {
  if (!pairs) return `word${String(start + i).padStart(2, '0')}.wav`;
  const wordNo = start + Math.floor(i / 2);
  return `word${String(wordNo).padStart(2, '0')}${i % 2 === 0 ? 'a' : 'b'}.wav`;
};

console.log(`${input}: ${wav.channels}ch ${wav.sampleRate}Hz, ${sec(wav.frames)}s`);
console.log(`Found ${segments.length} word(s):`);
segments.forEach(([a, b], i) =>
  console.log(`  ${name(i).padEnd(14)} ${sec(a)}s → ${sec(b)}s  (${sec(b - a)}s)`),
);

if (dropped.length) {
  console.log(`\nIgnored ${dropped.length} short blip(s) under ${opts.min}s (breaths/clicks):`);
  for (const [a, b] of dropped) console.log(`  ${sec(a)}s  (${sec(b - a)}s)`);
  console.log('  If one of those was a real word, lower --min.');
}

if (dry) {
  console.log('\n--dry: nothing written. Check the count matches your word list, then rerun without --dry.');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
segments.forEach(([a, b], i) => writeSegment(wav, a, b, join(outDir, name(i))));
console.log(`\nWrote ${segments.length} file(s) to ${outDir}`);
