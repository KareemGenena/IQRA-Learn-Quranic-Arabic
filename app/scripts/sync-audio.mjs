/**
 * Copies the master recordings into the app:
 *   ../Audio - 5 letters/*.wav  →  public/audio/lesson01/
 * Run after re-recording any word:  npm run sync-audio
 */
import { copyFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'Audio - 5 letters');
const dst = join(here, '..', 'public', 'audio', 'lesson01');

let count = 0;
for (const file of readdirSync(src)) {
  if (file.toLowerCase().endsWith('.wav')) {
    copyFileSync(join(src, file), join(dst, file));
    count++;
  }
}
console.log(`Copied ${count} recordings into public/audio/lesson01/`);
