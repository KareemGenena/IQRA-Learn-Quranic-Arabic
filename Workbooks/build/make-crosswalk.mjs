/**
 * The crosswalk between the practice workbooks and the app.
 *
 *   node Workbooks/build/make-crosswalk.mjs
 *
 * One artifact, declared once, rendered three ways: the app shows "See
 * workbook Level 1, page 6 for writing practice" under a lesson; the landing
 * page shows "for listening practice, see the app" under a workbook section;
 * and — when the app is complete — the workbooks will carry an "In the app"
 * line and a QR per section, resolved through this same file.
 *
 * What is GENERATED: every section of every level, with its printed page,
 * read from the master's own Table of Contents (the author's numbers), and its
 * physical page in the PDF (printed + 2: the cover and the copyright page are
 * unnumbered — the footer rule in make-editions.mjs). Nothing is typed, so a
 * new edition cannot leave a stale page number anywhere.
 *
 * What is DECLARED, by hand, in crosswalk.map.json: which app lessons a
 * workbook section matches. A teaching judgment, kept next to the workbooks.
 *
 * Why the app never stores a page number: the two sides will each have new
 * editions. The app stores a section ID (L1S3); this file turns it into
 * today's page. Rebuild and redeploy both sites after a workbook edition.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getEntry, readDocx, text } from './docx.mjs';

const WB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(WB, '..');
const EDITION = 'Edition 1.0, October 2026';   // keep in step with site/build.mjs
const BASE = 'https://iqra.muslimbynature.org/workbooks';
const APP = 'https://iqra---learn-quranic-arabic.web.app/';

const cellText = (c) => {
  let s = '';
  for (const m of c.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) s += m[1];
  return s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();
};

/** The sections of one level, from the master's Table of Contents table. */
function sectionsOf(level) {
  const xml = text(getEntry(readDocx(resolve(WB, `Practice Workbook Level ${level}.docx`)), 'word/document.xml'));
  const tables = xml.split('<w:tbl>').slice(1).map((t) => t.split('</w:tbl>')[0]);
  const rowsOf = (t) => (t.match(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g) ?? [])
    .map((r) => (r.match(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g) ?? []).map(cellText));
  const toc = tables.map(rowsOf).find((rows) => rows.some((r) => r[1] === 'Topic' && r[2] === 'Page'));
  if (!toc) throw new Error(`Level ${level}: no Table of Contents table in the master`);

  const sections = [];
  let cur = null;
  for (const r of toc) {
    if (r.length < 3 || r[1] === 'Topic') continue;
    const sec = /^Section (\d+)$/.exec(r[0]);
    const printed = /^\d+$/.test(r[2]) ? Number(r[2]) : null;
    if (sec) {
      cur = { id: `L${level}S${sec[1]}`, section: Number(sec[1]), title: r[1], printed, parts: [] };
      sections.push(cur);
    } else if (cur && r[1]) {
      cur.parts.push({ id: `${cur.id}.${cur.parts.length + 1}`, title: r[1], printed });
    }
  }
  for (const s of sections) {
    if (s.printed === null) s.printed = s.parts.find((p) => p.printed !== null)?.printed ?? null;
    s.physical = s.printed === null ? null : s.printed + 2;
    for (const p of s.parts) p.physical = p.printed === null ? null : p.printed + 2;
  }
  return sections;
}

/** The app's lessons — id, title, track — read from its registry. */
function lessonsOfApp() {
  const src = readFileSync(resolve(ROOT, 'app/src/lib/lessons.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const LESSONS'), src.indexOf('export function orderedLessons'));
  const out = new Map();
  // an entry may open with comment lines before its id
  for (const m of body.matchAll(/\{(?:\s*\/\/[^\n]*)*\s*id:\s*(\d+)[\s\S]*?\}/g)) {
    const b = m[0];
    const title = (b.match(/title:\s*'([^']*)'/) ?? [])[1] ?? `Lesson ${m[1]}`;
    const kids = /tracks:\s*\[\s*'kids'/.test(b);
    const id = Number(m[1]);
    out.set(id, { id, title, track: kids ? 'kids' : 'adults', url: `${APP}#/${kids ? 'kids/lesson' : 'lesson'}/${id}` });
  }
  return out;
}

const map = JSON.parse(readFileSync(resolve(WB, 'crosswalk.map.json'), 'utf8'));
const lessons = lessonsOfApp();
const out = { edition: EDITION, base: BASE, app: APP, levels: {} };
for (const L of [1, 2, 3]) {
  const sections = sectionsOf(L).map((s) => ({
    ...s,
    lessons: (map[s.id] ?? []).map((id) => {
      const l = lessons.get(id);
      if (!l) throw new Error(`${s.id} maps to lesson ${id}, which is not in lessons.ts`);
      return l;
    }),
  }));
  out.levels[L] = { file: `iqra-1447-workbook-level-${L}.pdf`, sections };
}
for (const id of Object.keys(map)) {
  if (id.startsWith('_')) continue; // the file's own note
  if (!Object.values(out.levels).some((lv) => lv.sections.some((s) => s.id === id))) throw new Error(`crosswalk.map.json: ${id} is not a section of any workbook`);
}

writeFileSync(resolve(WB, 'crosswalk.json'), JSON.stringify(out, null, 2) + '\n');
mkdirSync(resolve(ROOT, 'app/src/generated'), { recursive: true });
writeFileSync(
  resolve(ROOT, 'app/src/generated/crosswalk.ts'),
  `// GENERATED by Workbooks/build/make-crosswalk.mjs — do not edit. Run it after a workbook edition or a mapping change.\nexport const CROSSWALK = ${JSON.stringify(out, null, 2)} as const;\n`,
);

for (const [L, lv] of Object.entries(out.levels)) {
  for (const s of lv.sections) {
    const to = s.lessons.length ? `  ⇄  ${s.lessons.map((l) => `${l.id} ${l.title}`).join(' · ')}` : '';
    console.log(`L${L} §${String(s.section).padStart(2)}  p${String(s.printed).padStart(2)}→${String(s.physical).padStart(2)}  ${s.title}${to}`);
  }
}
const mapped = Object.values(out.levels).flatMap((lv) => lv.sections).filter((s) => s.lessons.length).length;
console.log(`\n${mapped} sections point at a lesson; written Workbooks/crosswalk.json and app/src/generated/crosswalk.ts`);
