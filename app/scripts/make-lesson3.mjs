/**
 * Builds Lesson 3 (the throat letters) from the source-of-truth docx and the
 * per-letter recordings.
 *
 *   ../Word Tables/حروف الحلق.docx
 *   ../Audio/Audio - Huroof Al-Halq/letter-*.wav, drill-pairs.wav
 *
 * Each take holds all of one letter's words; the count is known from the
 * table, so the audio is split into exactly that many pieces.
 *
 * Run:  node scripts/make-lesson3.mjs
 */

import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'حروف الحلق.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - Huroof Al-Halq');
const AUDIO_OUT = join(here, '..', 'public', 'audio', 'lesson03');
const LESSON_OUT = join(here, '..', 'public', 'lessons', 'lesson03', 'words.json');

/** Table row ranges (0-based, inclusive) for each letter, and its take. */
const SECTIONS = [
  { id: 'hamza', letter: 'ء', title: 'Hamza', titleArabic: 'الهمزة', rows: [1, 8], take: 'letter-hamza', hasForm: true,
    hint: 'The deepest of them all — a clean stop from the bottom of the throat.' },
  { id: 'haa', letter: 'ه', title: 'Haa', titleArabic: 'الهاء', rows: [10, 17], take: 'letter-haa',
    hint: 'Same place as the hamza, but breathed out softly instead of stopped.' },
  { id: 'hha', letter: 'ح', title: 'Hhaa', titleArabic: 'الحاء', rows: [19, 25], take: 'letter-hha',
    hint: 'From the middle of the throat — a warm, breathy sound with no rasp.' },
  { id: 'ayn', letter: 'ع', title: 'Ayn', titleArabic: 'العين', rows: [27, 33], take: 'letter-ayn',
    hint: 'The middle of the throat squeezed — voiced, the partner of ح.' },
  { id: 'ghayn', letter: 'غ', title: 'Ghayn', titleArabic: 'الغين', rows: [35, 41], take: 'letter-ghayn',
    hint: 'Nearest the mouth — a gargled sound, the voiced partner of خ.' },
  { id: 'kha', letter: 'خ', title: 'Khaa', titleArabic: 'الخاء', rows: [43, 50], take: 'letter-kha',
    hint: 'Nearest the mouth and unvoiced — the rasp of ح moved forward.' },
];

const DRILL_PAIRS = { id: 'pairs', title: 'Pair drills', titleArabic: 'تمارين', rows: [52, 57], take: 'drill-pairs',
  hint: 'Alternate the two letters until the difference is automatic.' };

// ── read the docx table ───────────────────────────────────────────────────
const xml = readZipEntry(DOCX, 'word/document.xml').toString('utf8');
const rows = xml.split(/<w:tr[ >]/).slice(1).map((r) =>
  r
    .split('</w:tr>')[0]
    .split(/<w:tc[ >]/)
    .slice(1)
    .map((c) => {
      let t = '';
      for (const m of c.split('</w:tc>')[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) t += m[1];
      return t.trim();
    }),
);

const problems = [];
const words = [];
const sections = [];
let id = 0;

for (const s of SECTIONS) {
  const [from, to] = s.rows;
  const rowsHere = rows.slice(from, to + 1);
  const entries = rowsHere.map((cells) => {
    // Hamza's table carries an extra leading Form column.
    const [form, text, position, meaning] = s.hasForm
      ? cells
      : [null, cells[0], cells[1], cells[2]];
    return { form, text, position, meaning };
  });

  const bad = entries.filter((e) => !e.text || !e.position || !e.meaning);
  if (bad.length) problems.push(`${s.id}: ${bad.length} row(s) missing a column`);

  sections.push({ id: s.id, title: `${s.title} ${s.letter}`, titleArabic: s.titleArabic, hint: s.hint });
  for (const e of entries) {
    id += 1;
    words.push({
      id,
      section: s.id,
      text: e.text,
      audio: `word${String(id).padStart(2, '0')}.wav`,
      timings: null,
      meaning: e.meaning,
      // The letter to light up inside the word, and which occurrence of it —
      // resolved to a cluster in the app, which already knows how to segment.
      target: { letter: e.form || s.letter, position: e.position },
      badges: [e.position, ...(e.form ? [e.form] : [])],
    });
  }
}

// Pair drills: one recording each, no meaning and nothing to highlight.
sections.push({ id: DRILL_PAIRS.id, title: DRILL_PAIRS.title, titleArabic: DRILL_PAIRS.titleArabic, hint: DRILL_PAIRS.hint });
const drillRows = rows.slice(DRILL_PAIRS.rows[0], DRILL_PAIRS.rows[1] + 1);
for (const cells of drillRows) {
  id += 1;
  words.push({
    id,
    section: DRILL_PAIRS.id,
    text: cells[1],
    audio: `word${String(id).padStart(2, '0')}.wav`,
    timings: null,
    badges: [cells[0]],
  });
}

// ── split the takes ───────────────────────────────────────────────────────
mkdirSync(AUDIO_OUT, { recursive: true });
let written = 0;
for (const s of [...SECTIONS, DRILL_PAIRS]) {
  const mine = words.filter((w) => w.section === s.id);
  const wav = readWav(join(AUDIO_SRC, `${s.take}.wav`));
  const { segments, durations, suspicious } = splitIntoN(wav, mine.length);
  if (segments.length !== mine.length) {
    problems.push(`${s.id}: split gave ${segments.length} pieces for ${mine.length} words`);
    continue;
  }
  if (suspicious) {
    const d = durations.map((x) => x.toFixed(2)).join(' ');
    problems.push(`${s.id}: uneven pieces, worth a listen — ${d}`);
  }
  segments.forEach(([a, b], i) => {
    writeSegment(wav, a, b, join(AUDIO_OUT, mine[i].audio), { mono: true });
    written += 1;
  });
}

// ── write the lesson ──────────────────────────────────────────────────────
const lesson = {
  lesson: 3,
  title: 'Throat Letters',
  titleArabic: 'حروف الحلق',
  kind: 'letters',
  audioPath: 'audio/lesson03/',
  perPage: 4,
  sections,
  words,
};
mkdirSync(dirname(LESSON_OUT), { recursive: true });
writeFileSync(LESSON_OUT, JSON.stringify(lesson, null, 2), 'utf8');

console.log(`${words.length} items across ${sections.length} sections`);
for (const s of sections) {
  console.log(`  ${s.id.padEnd(8)} ${words.filter((w) => w.section === s.id).length}`);
}
console.log(`audio: wrote ${written} clips`);
console.log(`missing meanings: ${words.filter((w) => w.section !== 'pairs' && !w.meaning).length}`);
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');
