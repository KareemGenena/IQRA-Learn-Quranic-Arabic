/**
 * Copies the master lesson 1 recordings into the app, converting them to
 * mono on the way (single-voice speech, so it halves the size the PWA has
 * to cache with no audible difference). Silence is left intact — the app
 * trims it at playback time.
 *
 * Run after re-recording any word:  npm run sync-audio
 */
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, writeSegment } from './lib/wav.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'Audio', 'Audio - 5 letters');
const dst = join(here, '..', 'public', 'audio', 'lesson01');

let count = 0;
let bytesIn = 0;
let bytesOut = 0;
for (const file of readdirSync(src)) {
  if (!file.toLowerCase().endsWith('.wav')) continue;
  const wav = readWav(join(src, file));
  bytesIn += wav.frames * wav.bytesPerFrame;
  writeSegment(wav, 0, wav.frames, join(dst, file), { mono: true });
  bytesOut += wav.frames * 2;
  count++;
}
console.log(
  `Copied ${count} recordings into public/audio/lesson01/ ` +
    `(${(bytesIn / 1048576).toFixed(1)} MB → ${(bytesOut / 1048576).toFixed(1)} MB mono)`,
);
