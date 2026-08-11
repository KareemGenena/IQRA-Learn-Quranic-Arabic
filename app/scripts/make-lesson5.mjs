/**
 * Builds Lesson 5 — madd muttasil and munfasil before a hamza.
 *
 *   ../Word Tables/مد متصل ومنفصل قبل همزة.docx
 *   ../Audio/Audio - Madd/*.wav
 *
 * Two tables, two sections. Muttasil is a madd and its hamza inside ONE word;
 * munfasil is a madd ending a word with the hamza opening the next. Both are
 * held for four harakat — `timing.ts` already treats them as the same length,
 * and since `graphemes.ts` drops spaces it cannot tell them apart anyway.
 *
 * Rows numbered 23A / 23B are one card with two halves: the word alone, then
 * the word in context. That builds on the sun/moon lam lesson, which is what
 * the comments on those rows are pointing at.
 *
 * Run:  node scripts/make-lesson5.mjs
 */

import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';
import { addMaddSigns, normaliseZeros } from './lib/arabic.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'مد متصل ومنفصل قبل همزة.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - Madd');
const AUDIO_OUT = join(here, '..', 'public', 'audio', 'lesson05');
const LESSON_OUT = join(here, '..', 'public', 'lessons', 'lesson05', 'words.json');

const SECTIONS = [
  {
    id: 'muttasil',
    title: 'Madd Muttasil',
    titleArabic: 'المد الواجب المتصل',
    hint: 'The madd and the hamza are in the same word, so the madd is always held — four harakat, every time.',
  },
  {
    id: 'munfasil',
    title: 'Madd Munfasil',
    titleArabic: 'المد الجائز المنفصل',
    hint: 'The madd ends one word and the hamza opens the next. Held for four harakat, the same length as muttasil.',
  },
];

/**
 * The comments column, split by how it is meant to be read.
 *
 * Short recurring rule names become badges — they are revision cues, read at a
 * glance while teaching over a shared screen, and a tooltip nobody taps mid
 * sentence is no use for that. The two or three that need a whole sentence
 * stay in the (i), which is where the lesson-3 meanings already live.
 */
const BADGES = [
  [/lam shamsiyyah/i, 'Sun ل'],
  [/lam qamariyyah/i, 'Moon ل'],
  [/ghunna/i, 'Ghunna'],
  [/dagger alif/i, 'Dagger alif'],
  [/qalqal/i, 'Qalqala'],
  [/silent alif/i, 'Silent alif'],
  [/silent waw/i, 'Silent waw'],
  [/hamzat wasl/i, 'Hamzat wasl'],
];
/** Comments that are an explanation rather than a label. */
const EXPLAINS = [/hamza written over/i, /conditional silent alif/i, /small yaa/i];

function readComment(raw) {
  const text = (raw ?? '').trim();
  if (!text) return { badges: [], note: undefined };

  // A word carrying BOTH madds is the point of teaching it, and which comes
  // first is the whole lesson — so it gets a chip each, in order, rather than
  // a sentence nobody reads mid-drill. The explanation stays in the (i) for
  // whoever taps it. ("mutassil" is spelled both ways in the sheet.)
  if (/first madd is munfasil/i.test(text) && /second is mut+a?s+il/i.test(text)) {
    return { badges: ['Munfasil (1st)', 'Muttasil (2nd)'], note: text };
  }
  if (/first madd is mut+a?s+il/i.test(text) && /second is munfasil/i.test(text)) {
    return { badges: ['Muttasil (1st)', 'Munfasil (2nd)'], note: text };
  }
  const explains = EXPLAINS.some((re) => re.test(text));
  const badges = [];
  for (const [re, label] of BADGES) {
    if (!re.test(text)) continue;
    // "Conditional silent alif" is the rectangular zero, a different thing
    // from a plain silent alif — it gets the sentence, not the label.
    if (label === 'Silent alif' && /conditional silent alif/i.test(text)) continue;
    if (!badges.includes(label)) badges.push(label);
  }
  return { badges, note: explains ? text : undefined };
}

// ── read the docx ─────────────────────────────────────────────────────────
const xml = readZipEntry(DOCX, 'word/document.xml').toString('utf8');
const tables = xml.split('<w:tbl>').slice(1).map((t) =>
  t
    .split('</w:tbl>')[0]
    .split(/<w:tr[ >]/)
    .slice(1)
    .map((r) =>
      r
        .split('</w:tr>')[0]
        .split(/<w:tc[ >]/)
        .slice(1)
        .map((c) => {
          let s = '';
          for (const m of c.split('</w:tc>')[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) s += m[1];
          return s.trim();
        }),
    ),
);

if (tables.length !== 2) {
  console.error(`expected 2 tables, found ${tables.length}`);
  process.exit(1);
}

const problems = [];
const words = [];
const sections = [];
let id = 0;

/** Uthmani text, with the silent-letter circles put back on canon first. */
const clean = (s) => addMaddSigns(normaliseZeros(s));

for (const [index, section] of SECTIONS.entries()) {
  const rows = tables[index].slice(1).filter((cells) => (cells[1] ?? '').trim());
  sections.push({ id: section.id, title: section.title, titleArabic: section.titleArabic, hint: section.hint });

  // Group by the number in the first column, so 23A and 23B become one card.
  const groups = [];
  for (const cells of rows) {
    const label = (cells[0] ?? '').trim();
    const num = label.replace(/[^0-9]/g, '');
    const last = groups[groups.length - 1];
    if (last && last.num === num && num) last.rows.push(cells);
    else groups.push({ num, rows: [cells] });
  }

  for (const group of groups) {
    // The id belongs to the row, spent whether or not it has been recorded —
    // calibrations are keyed by it and must never shift underneath them.
    id += 1;
    const n = String(id).padStart(2, '0');
    const badges = [];
    let note;
    for (const cells of group.rows) {
      const read = readComment(cells[2]);
      for (const b of read.badges) if (!badges.includes(b)) badges.push(b);
      note ??= read.note;
    }

    const entry = { id, section: section.id, badges, timings: null };
    if (note) entry.meaning = note;

    if (group.rows.length === 1) {
      entry.text = clean(group.rows[0][1]);
      entry.audio = `word${n}.wav`;
    } else {
      if (group.rows.length !== 2) {
        problems.push(`#${id} (${group.num}): ${group.rows.length} rows share a number, expected 1 or 2`);
      }
      entry.forms = group.rows.slice(0, 2).map((cells, i) => ({
        text: clean(cells[1]),
        audio: `word${n}${'ab'[i]}.wav`,
        timings: null,
      }));
    }
    words.push(entry);
  }
}

// ── cut the audio ─────────────────────────────────────────────────────────
const MARKS = /[ً-ٰۖ-ۭـ]/g;
// Byte-identical to lessons 3 and 4, and therefore to what the intake tool
// derives a filename with. MARKS already covers U+06D6–U+06ED, so both silent
// circles fall out here too — stripping them again separately would only hide
// a future disagreement between the two.
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();

const byName = new Map();
let haveAudio = true;
try {
  for (const f of readdirSync(AUDIO_SRC)) {
    if (!f.toLowerCase().endsWith('.wav')) continue;
    const base = f.replace(/\.wav$/i, '');
    const numbered = /^(.*?)\s+(\d+)$/.exec(base);
    const k = key(numbered ? numbered[1] : base);
    const take = numbered ? Number(numbered[2]) : 1;
    const prev = byName.get(k);
    if (!prev || take > prev.take) byName.set(k, { file: f, take });
  }
} catch {
  haveAudio = false;
  problems.push(`no audio folder yet at ${AUDIO_SRC} — text built, clips skipped`);
}

mkdirSync(AUDIO_OUT, { recursive: true });
let written = 0;
const noAudio = [];
const used = new Set();

if (haveAudio) {
  for (const w of words) {
    const parts = w.forms ? w.forms : [{ text: w.text, audio: w.audio }];
    for (const part of parts) {
      const match = byName.get(key(part.text));
      if (!match) {
        noAudio.push(`#${w.id} ${key(part.text)}`);
        continue;
      }
      used.add(match.file);
      const wav = readWav(join(AUDIO_SRC, match.file));
      const { segments } = splitIntoN(wav, 1);
      writeSegment(wav, segments[0][0], segments[0][1], join(AUDIO_OUT, part.audio), { mono: true });
      written += 1;
    }
  }
  if (noAudio.length) problems.push(`no recording yet for ${noAudio.length}: ${noAudio.join(', ')}`);

  const unused = readdirSync(AUDIO_SRC)
    .filter((f) => f.toLowerCase().endsWith('.wav') && !used.has(f))
    .map((f) => f.replace(/\.wav$/i, ''));
  if (unused.length) problems.push(`${unused.length} recording(s) match no row: ${unused.join('، ')}`);
}

// Clips left over from a previous run are dead weight in the offline precache.
const referenced = new Set(words.flatMap((w) => (w.forms ? w.forms.map((f) => f.audio) : [w.audio])));
const orphans = readdirSync(AUDIO_OUT).filter((f) => f.endsWith('.wav') && !referenced.has(f));
if (orphans.length) problems.push(`${orphans.length} clip(s) no longer referenced: ${orphans.join(', ')}`);

// ── write the lesson ──────────────────────────────────────────────────────
const lesson = {
  lesson: 5,
  title: 'Madd before a Hamza',
  titleArabic: 'المد المتصل والمنفصل قبل همزة',
  kind: 'letters',
  audioPath: 'audio/lesson05/',
  perPage: 4,
  sections,
  words,
};
mkdirSync(dirname(LESSON_OUT), { recursive: true });
writeFileSync(LESSON_OUT, JSON.stringify(lesson, null, 2), 'utf8');

console.log(`${words.length} cards across ${sections.length} sections`);
for (const s of sections) {
  const mine = words.filter((w) => w.section === s.id);
  console.log(`  ${s.id.padEnd(9)} ${String(mine.length).padStart(2)} cards, ${mine.filter((w) => w.forms).length} of them pairs`);
}
console.log(`audio: wrote ${written} clips`);
const zeros = words.flatMap((w) => (w.forms ? w.forms.map((f) => f.text) : [w.text])).join('');
console.log(`silent-letter circles: ${(zeros.match(/۟/g) ?? []).length} round, ${(zeros.match(/۠/g) ?? []).length} rectangular`);
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');
