/**
 * The makhraj pictures for IQRA Kids — six frames of ONE drawing.
 *
 *   node Design/kids-art/makhraj/make-makhraj.mjs        → six .svg files here
 *
 * A boy's head in profile, facing right, mouth open as he speaks, drawn soft
 * and rounded for toddlers: filled shapes with a warm outline, no facial
 * features (no eye, no brow — Islamic style), a green kufi, a green shirt.
 * The inside of the mouth is shown as a window: the tongue, a row of teeth,
 * the throat going down into the neck, the nasal passage above the palate.
 * The same drawing six times; only the highlighted region changes — the
 * workbook's five places, plus a plain frame.
 *
 * Rasterized to PNG by a separate step (sharp is not a dependency of the app):
 *   see render.mjs beside this file.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

const GOLD = '#C1A054';        // the highlight
const PALE_GOLD = '#E4D09A';   // the mouth space — lighter, still plainly gold
const INK = '#5A3A24';         // outlines
const SKIN = '#EFC39F';
const SKIN_DARK = '#E2AB84';
const GREEN = '#14513A';
const GREEN_LIGHT = '#2E7D5B';
const CAVITY = '#FFFBF3';
const TONGUE = '#F1B7AE';
const LIP = '#E59B8C';
const PASSAGE = '#FBF3E6';

/** Which region each frame lights, and with what. */
const FRAMES = {
  'makhraj': {},
  'makhraj-lips': { lips: GOLD },
  'makhraj-tongue': { tongue: GOLD },
  'makhraj-throat': { throat: GOLD },
  'makhraj-jawf': { cavity: PALE_GOLD, throat: PALE_GOLD },
  'makhraj-nose': { nose: GOLD },
};

function svg(lit) {
  const fill = (name, base) => lit[name] ?? base;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="#ffffff"/>
  <g stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">

    <!-- shirt -->
    <path d="M 95 600 C 110 525, 200 498, 310 498 C 420 498, 510 525, 525 600 Z" fill="${GREEN}"/>
    <path d="M 255 498 C 270 520, 350 520, 365 498" fill="none" stroke="${GREEN_LIGHT}" stroke-width="6"/>

    <!-- neck -->
    <path d="M 262 400 L 258 505 L 392 505 L 392 404 Z" fill="${SKIN_DARK}"/>

    <!-- head -->
    <path d="M 300 92
             C 170 92, 118 200, 135 300
             C 145 365, 180 405, 245 422
             C 305 438, 362 436, 402 424
             C 432 414, 446 384, 440 352
             C 437 343, 432 337, 428 333
             L 428 321
             C 434 315, 438 307, 436 299
             C 440 295, 447 293, 451 289
             C 464 282, 467 270, 456 260
             C 449 254, 443 247, 439 236
             C 448 170, 410 92, 300 92 Z" fill="${SKIN}"/>

    <!-- a little color in the cheek, below the window -->
    <ellipse cx="372" cy="392" rx="17" ry="9" fill="#F3B2A4" stroke="none"/>

    <!-- the window: throat, nasal passage, mouth space, tongue, teeth, lips.
         The throat and the nasal passage are thick strokes — an ink stroke
         with a colored one on top — so they are tubes with rounded ends. -->
    <path d="M 322 306 L 322 490" fill="none" stroke-width="44"/>
    <path d="M 322 306 L 322 490" fill="none" stroke="${fill('throat', PASSAGE)}" stroke-width="34"/>
    <path d="M 443 291 C 418 268, 372 264, 340 290" fill="none" stroke-width="22"/>
    <path d="M 443 291 C 418 268, 372 264, 340 290" fill="none" stroke="${fill('nose', PASSAGE)}" stroke-width="13"/>
    <path d="M 322 300 C 352 286, 402 286, 426 298 L 426 350 C 402 364, 352 364, 322 356 Z" fill="${fill('cavity', CAVITY)}" stroke-width="5"/>
    <path d="M 326 354 C 336 322, 376 312, 404 332 C 410 342, 408 352, 400 357 C 376 362, 348 362, 326 354 Z" fill="${fill('tongue', TONGUE)}" stroke-width="5"/>
    <g fill="#ffffff" stroke-width="4">
      <rect x="408" y="300" width="9" height="11" rx="2"/><rect x="418" y="300" width="9" height="11" rx="2"/>
      <rect x="408" y="340" width="9" height="11" rx="2"/><rect x="418" y="340" width="9" height="11" rx="2"/>
    </g>
    <ellipse cx="432" cy="309" rx="13" ry="10" fill="${fill('lips', LIP)}" stroke-width="5"/>
    <ellipse cx="433" cy="345" rx="14" ry="11" fill="${fill('lips', LIP)}" stroke-width="5"/>

    <!-- ear -->
    <ellipse cx="200" cy="300" rx="22" ry="31" fill="${SKIN}"/>
    <path d="M 206 286 C 196 292, 196 308, 206 314" fill="none" stroke-width="5"/>

    <!-- kufi: a dome over the whole top of the head, a lighter band at its edge -->
    <path d="M 140 238 C 140 18, 452 14, 450 242 C 350 264, 245 264, 140 238 Z" fill="${GREEN}"/>
    <path d="M 148 234 C 250 258, 345 258, 444 236" fill="none" stroke="${GREEN_LIGHT}" stroke-width="9"/>
  </g>
</svg>
`;
}

const out = join(here, 'svg');
mkdirSync(out, { recursive: true });
for (const [name, lit] of Object.entries(FRAMES)) writeFileSync(join(out, `${name}.svg`), svg(lit), 'utf8');
console.log(`wrote ${Object.keys(FRAMES).length} svg files to ${out}`);
