/**
 * Generates all PWA icons from the master logo:
 *   ../Manifest/IQRA Manifest.png  →  public/*.png
 * Run once (or after the logo changes):  node scripts/make-icons.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'Manifest', 'IQRA Manifest.png');
const out = (name) => join(here, '..', 'public', name);

await sharp(src).resize(512, 512).png().toFile(out('pwa-512.png'));
await sharp(src).resize(192, 192).png().toFile(out('pwa-192.png'));
await sharp(src).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
await sharp(src).resize(64, 64).png().toFile(out('favicon.png'));

// Maskable icon: logo shrunk into the 80% safe zone on a white field.
const inner = await sharp(src).resize(408, 408).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#ffffff' },
})
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('maskable-512.png'));

console.log('Icons written to public/');
