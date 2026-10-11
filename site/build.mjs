/**
 * Runs before every deploy of the landing page (firebase.json predeploy).
 *
 * Copies the three generic workbook PDFs from Workbooks/ into
 * site/public/workbooks/ under plain URL names, and writes meta.json with each
 * file's size and page count, which the page reads. So the page always offers
 * the PDFs that are in Workbooks/, and its numbers cannot go stale.
 *
 * The copies are build output (git-ignored); Workbooks/ holds the originals.
 * Only the generic edition is published here — never a masjid's edition.
 */
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'site/public/workbooks');
const EDITION = 'Edition 1.0, October 2026';   // keep in step with Workbooks/build/make-editions.mjs

mkdirSync(OUT, { recursive: true });
const meta = {};
for (const L of [1, 2, 3]) {
  const src = resolve(ROOT, `Workbooks/IQRA 1447 Practice Workbook - Level ${L}.pdf`);
  const pdf = readFileSync(src).toString('latin1');
  if (!pdf.startsWith('%PDF')) throw new Error(`not a PDF: ${src}`);
  // (the text inside these PDFs is compressed glyph codes, so the edition cannot be
  // checked by searching it: the rule is the folder — generic PDFs live in Workbooks/,
  // a masjid's edition in its own subfolder, and only the former are read here)
  const pages = (pdf.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  const dest = `iqra-1447-workbook-level-${L}.pdf`;
  copyFileSync(src, resolve(OUT, dest));
  meta[`level${L}`] = { file: dest, bytes: statSync(src).size, pages, edition: EDITION };
  console.log(`Level ${L}: ${dest}  ${pages} pages  ${(statSync(src).size / 1048576).toFixed(1)} MB`);
}
writeFileSync(resolve(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

// The workbook ↔ app crosswalk (Workbooks/build/make-crosswalk.mjs): the page
// reads it to say, under each workbook, which app lessons match its sections.
copyFileSync(resolve(ROOT, 'Workbooks/crosswalk.json'), resolve(OUT, 'crosswalk.json'));
console.log('crosswalk.json copied');
