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

import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';
import { addMaddSigns } from './lib/arabic.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'حروف الحلق.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - Huroof Al-Halq', 'Separated by row - new');
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

/** Each row is two words that differ only in the confusable letter, so the
 *  card carries both and each is playable on its own. */
/** Waveform screenshots, keyed by the drill they belong to. */
const IMAGES = { 'ه ح ه ح': 'drill-ha-hha.png' };
const key0 = (t) => t.replace(/[ً-ٰۖ-ۭـ]/g, '').replace(/\s+/g, ' ').trim();

const DRILL_CONTRAST = { id: 'contrast', title: 'Contrast drills', titleArabic: 'تمارين التمييز', rows: [59, 66],
  take: 'drill-contrast-v2',
  hint: 'Two words, one letter apart. Play them back to back and listen for the switch.' };

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
      text: addMaddSigns(e.text),
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
    text: addMaddSigns(cells[1]),
    audio: `word${String(id).padStart(2, '0')}.wav`,
    timings: null,
    badges: [cells[0]],
    // A picture of this drill's waveform: the ه and ح bursts look plainly
    // different, which is a teaching point in itself.
    image: IMAGES[key0(cells[1])],
  });
}

// Contrast drills: one card per row holding both words, split "A – B".
sections.push({ id: DRILL_CONTRAST.id, title: DRILL_CONTRAST.title, titleArabic: DRILL_CONTRAST.titleArabic, hint: DRILL_CONTRAST.hint });
const contrastRows = rows.slice(DRILL_CONTRAST.rows[0], DRILL_CONTRAST.rows[1] + 1);
const contrastClips = [];
for (const cells of contrastRows) {
  const parts = cells[1].split(/\s*[–—-]\s*/).filter(Boolean);
  if (parts.length !== 2) {
    problems.push(`contrast: "${cells[1]}" didn't split into two words`);
    continue;
  }
  id += 1;
  const n = String(id).padStart(2, '0');
  words.push({
    id,
    section: DRILL_CONTRAST.id,
    forms: parts.map((text, i) => ({ text: addMaddSigns(text), audio: `word${n}${'ab'[i]}.wav`, timings: null })),
    badges: [cells[0]],
  });
  contrastClips.push(`word${n}a.wav`, `word${n}b.wav`);
}

// ── one recording per table row, named after its words ───────────────────
// Matching on the words themselves rather than a number keeps the folder
// self-describing: renaming or re-recording a row needs no renumbering.
const MARKS = /[ً-ٰۖ-ۭـ]/g;
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();

/**
 * Recordings, keyed by the words in the filename.
 *
 * A re-recording is named after the same words with a take number on the end —
 * "جئت 2.wav" replaces "جئت.wav" — so the number is stripped before matching
 * and the highest take wins. Without this a new take is silently ignored and
 * the row just looks unrecorded, which is exactly how it went unnoticed once.
 */
const byName = new Map();
for (const f of readdirSync(AUDIO_SRC)) {
  if (!f.toLowerCase().endsWith('.wav')) continue;
  const base = f.replace(/\.wav$/i, '');
  const numbered = /^(.*?)\s+(\d+)$/.exec(base);
  const k = key(numbered ? numbered[1] : base);
  const take = numbered ? Number(numbered[2]) : 1;
  const prev = byName.get(k);
  if (!prev || take > prev.take) byName.set(k, { file: f, take });
}

mkdirSync(AUDIO_OUT, { recursive: true });
let written = 0;
const noAudio = [];
const used = new Set();
for (const w of words) {
  const texts = w.forms ? w.forms.map((f) => f.text) : [w.text];
  const match = byName.get(key(texts.join(' ')));
  if (!match) {
    noAudio.push(`#${w.id} ${key(texts.join(' '))}`);
    continue;
  }
  const { file } = match;
  used.add(file);
  const wav = readWav(join(AUDIO_SRC, file));
  const { segments, durations, suspicious } = splitIntoN(wav, texts.length);
  if (segments.length !== texts.length) {
    problems.push(`#${w.id} ${file}: split gave ${segments.length} of ${texts.length}`);
    continue;
  }
  if (suspicious && texts.length > 1) {
    problems.push(`#${w.id} ${file}: uneven halves — ${durations.map((d) => d.toFixed(2)).join(' / ')}`);
  }
  const outs = w.forms ? w.forms.map((f) => f.audio) : [w.audio];
  segments.forEach(([a, b], i) => {
    writeSegment(wav, a, b, join(AUDIO_OUT, outs[i]), { mono: true });
    written += 1;
  });
}
if (noAudio.length) {
  problems.push(`no recording yet for ${noAudio.length} row(s): ${noAudio.join(', ')}`);
}

// A recording that matches no row is a misnamed file or a word that isn't in
// the table — either way the author recorded something that will never play,
// and silence about it is how a new take gets lost.
const unused = readdirSync(AUDIO_SRC)
  .filter((f) => f.toLowerCase().endsWith('.wav') && !used.has(f))
  .map((f) => f.replace(/\.wav$/i, ''));
if (unused.length) {
  problems.push(`${unused.length} recording(s) match no row: ${unused.join('، ')}`);
}

// ── write the lesson ──────────────────────────────────────────────────────
const lesson = {
  lesson: 3,
  title: 'Throat Letters',
  titleArabic: 'حروف الحلق',
  kind: 'letters',
  audioPath: 'audio/lesson03/',
  imagePath: 'images/lesson03/',
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
const needsMeaning = words.filter((w) => !['pairs', 'contrast'].includes(w.section) && !w.meaning);
console.log(`missing meanings: ${needsMeaning.length}`);
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');
