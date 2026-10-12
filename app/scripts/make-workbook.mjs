/**
 * The workbook companion — every item on every page of the practice
 * workbooks, with the clip that says it.
 *
 *   node scripts/make-workbook.mjs            all three levels
 *   node scripts/make-workbook.mjs 1 3        some
 *
 * Reads the generic masters, `Workbooks/Practice Workbook Level N.docx`,
 * page by page: every running-head paragraph ("IQRA 1447 · Quranic Arabic
 * Practice Workbook · Level N") opens a new physical page — checked against
 * the PDFs: 33, 59 and 34 content pages after the cover and the copyright
 * page, so physical = index + 3 — and a "Section N · Title — instruction"
 * paragraph names the section the page belongs to. In every drill table the
 * FIRST row holds the items and the second their captions ("Fat-ha", "د + ر",
 * "4●", "[ل silent] · طّ"); the rows below are the grey tracing copies and
 * are never read. A table whose first row has no Arabic (Level 2's Letter
 * Shapes) yields nothing.
 *
 * Audio, in order of preference, so a word recorded once serves both the
 * lesson it is taught in and the page it is traced on:
 *   1. a clip from lessons 1–7 whose text has the same key (`audioName.ts`
 *      rule: diacritics off, ٱ → ا) — the lesson's own clip, calibration and
 *      stop reading, untouched. Letter lessons (20+) are never reused: their
 *      clips are whole teacher lines.
 *   2. a take in `Audio/Audio - Workbook Level N/` (and its `وقف/`), cut into
 *      `public/audio/workbook0N/`, calibrated under lesson id 90 + N.
 *   3. nothing — the page shows the item without Play, and this run says so.
 *
 * Writes `public/workbook/levelN.json`. Never hand-edit it.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readZipEntry } from './lib/zip.mjs';
import { STOP_DIR, latestTakes } from './lib/stop.mjs';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const WB = join(root, 'Workbooks');
const PUB = join(here, '..', 'public');

/** Same as `audioKey` in src/lib/audioName.ts — the one filename rule. */
const MARKS = /[ً-ٰۖ-ۭـࣰ-ࣲ]/g;
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();
const hasArabic = (s) => /[؀-ۿ]/.test(s);

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const textOf = (xml) => decode([...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')).trim();

const levels = process.argv.slice(2).map(Number).filter(Boolean);
const LEVELS = levels.length ? levels : [1, 2, 3];
const PDF_PAGES = { 1: 35, 2: 61, 3: 36 }; // site/public/workbooks/meta.json

// ── 1. The lessons' clips, by key ──────────────────────────────────────────
const lessonClips = new Map();
for (let n = 1; n <= 7; n++) {
  const p = join(PUB, 'lessons', `lesson${String(n).padStart(2, '0')}`, 'words.json');
  if (!existsSync(p)) continue;
  const lesson = JSON.parse(readFileSync(p, 'utf8'));
  const add = (text, form, k) => {
    const kk = key(text);
    if (!kk || lessonClips.has(kk)) return;
    // Only a clip that is actually on disk: a text-only lesson (7, before it
    // is recorded) names clips it does not have, and the page would offer a
    // Play that fails.
    if (!existsSync(join(PUB, lesson.audioPath, form.audio))) return;
    const rec = { lesson: n, path: lesson.audioPath, file: form.audio, key: k };
    if (form.stop && existsSync(join(PUB, lesson.audioPath, form.stop.audio))) rec.stopFile = form.stop.audio;
    for (const f of ['waqf', 'waqfMadd', 'letterNames', 'dimFinalMark']) if (form[f] !== undefined) rec[f] = form[f];
    lessonClips.set(kk, rec);
  };
  for (const w of lesson.words) {
    if (w.arabic !== undefined) add(w.arabic, w, String(w.id));
    if (w.bare) {
      add(w.bare.text, w.bare, `${w.id}a`);
      add(w.withAl.text, w.withAl, `${w.id}b`);
    }
    if (w.forms) w.forms.forEach((f, i) => add(f.text, { ...w, ...f }, `${w.id}${'abcdefgh'[i] ?? i}`));
    else if (w.text !== undefined && w.audio) add(w.text, w, String(w.id));
  }
}
console.log(`${lessonClips.size} lesson clips indexed by key (lessons 1–7)`);

// ── 2. Each level ──────────────────────────────────────────────────────────
for (const L of LEVELS) {
  const xml = readZipEntry(join(WB, `Practice Workbook Level ${L}.docx`), 'word/document.xml').toString('utf8');
  const body = xml.slice(xml.indexOf('<w:body>'));
  const re = /<w:p\b[\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>/g;

  const pages = [];
  const sections = [];
  let section = null;
  let page = null;
  const ids = new Map();
  let m;
  while ((m = re.exec(body))) {
    const s = m[0];
    if (s.startsWith('<w:tbl>')) {
      if (!page) continue;
      const rows = [...s.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((r) =>
        [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => textOf(c[0])),
      );
      if (!rows.length) continue;
      const [first, captions = []] = rows;
      if (!first.some(hasArabic)) continue; // a header row, not items
      first.forEach((cell, i) => {
        if (!cell || !hasArabic(cell)) return;
        const base = `${section.id}:${key(cell)}`;
        const seen = ids.get(base) ?? 0;
        ids.set(base, seen + 1);
        const id = seen ? `${base}#${seen + 1}` : base;
        const caption = captions[i] && captions[i] !== cell ? captions[i] : '';
        page.items.push({ id, text: cell, caption });
      });
      continue;
    }
    const t = textOf(s);
    if (!t) continue;
    const h = /^Section (\d+) · (.+?)(?: — (.*))?$/.exec(t);
    if (h) {
      const n = Number(h[1]);
      const title = h[2].trim();
      let sec = sections.find((x) => x.n === n);
      if (!sec) {
        sec = { id: `L${L}S${n}`, n, title, instruction: (h[3] ?? '').trim(), firstPage: page?.physical ?? null };
        sections.push(sec);
      }
      section = sec;
      if (page) {
        page.section = sec.id;
        if (title !== sec.title) page.part = title; // "Lam Qamariyya (moon letters)"
        if (!sec.firstPage) sec.firstPage = page.physical;
      }
      continue;
    }
    if (/IQRA 1447.*Practice Workbook/.test(t)) {
      page = { physical: pages.length + 3, printed: pages.length + 1, section: section?.id ?? null, items: [] };
      pages.push(page);
    }
  }

  const expected = PDF_PAGES[L] - 2;
  if (pages.length !== expected) console.log(`  !! Level ${L}: ${pages.length} pages read, the PDF has ${expected} content pages`);

  // ── 3. Audio ─────────────────────────────────────────────────────────────
  const src = join(root, 'Audio', `Audio - Workbook Level ${L}`);
  const takes = latestTakes(src, key);
  const stops = latestTakes(join(src, STOP_DIR), key);
  const outDir = join(PUB, 'audio', `workbook0${L}`);
  const usedTakes = new Set();
  const usedStops = new Set();
  const tally = {};
  let ordinal = 0;
  for (const p of pages) {
    for (const it of p.items) {
      const t = (tally[p.section] ??= { items: 0, lesson: 0, workbook: 0 });
      t.items += 1;
      const k = key(it.text);
      const fromLesson = lessonClips.get(k);
      if (fromLesson) {
        it.audio = { ...fromLesson };
        t.lesson += 1;
        continue;
      }
      const take = takes.get(k);
      if (!take) continue;
      ordinal += 1;
      mkdirSync(outDir, { recursive: true });
      const file = `w${String(ordinal).padStart(4, '0')}.wav`;
      const wav = readWav(join(src, take.file));
      const { segments } = splitIntoN(wav, 1);
      writeSegment(wav, segments[0][0], segments[0][1], join(outDir, file), { mono: true });
      usedTakes.add(take.file);
      it.audio = { lesson: 90 + L, path: `audio/workbook0${L}/`, file, key: it.id };
      const stop = stops.get(k);
      if (stop) {
        const sf = file.replace(/\.wav$/, '-waqf.wav');
        const sw = readWav(join(src, STOP_DIR, stop.file));
        const { segments: ss } = splitIntoN(sw, 1);
        writeSegment(sw, ss[0][0], ss[0][1], join(outDir, sf), { mono: true });
        it.audio.stopFile = sf;
        usedStops.add(stop.file);
      }
      t.workbook += 1;
    }
  }

  // ── 4. Write and report ──────────────────────────────────────────────────
  const out = {
    level: L,
    pdf: `iqra-1447-workbook-level-${L}.pdf`,
    sections,
    pages,
  };
  mkdirSync(join(PUB, 'workbook'), { recursive: true });
  writeFileSync(join(PUB, 'workbook', `level${L}.json`), JSON.stringify(out, null, 1), 'utf8');

  console.log(`\nLevel ${L}: ${pages.length} pages, ${sections.length} sections`);
  for (const sec of sections) {
    const t = tally[sec.id] ?? { items: 0, lesson: 0, workbook: 0 };
    console.log(
      `  ${sec.id.padEnd(5)} p.${String(sec.firstPage).padStart(2)}  ${sec.title.padEnd(40)} ${String(t.items).padStart(4)} items · ${t.lesson} from lessons · ${t.workbook} recorded here`,
    );
  }
  const unusedTakes = [...takes.values()].map((v) => v.file).filter((f) => !usedTakes.has(f));
  const unusedStops = [...stops.values()].map((v) => v.file).filter((f) => !usedStops.has(f));
  if (unusedTakes.length) console.log(`  takes matching no item: ${unusedTakes.join(', ')}`);
  if (unusedStops.length) console.log(`  ${STOP_DIR}/ takes matching no item: ${unusedStops.join(', ')}`);
  if (!existsSync(src)) console.log(`  (no ${src.replace(root, '')} folder yet)`);
}
