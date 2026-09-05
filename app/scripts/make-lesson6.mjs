/**
 * Builds Lesson 6 — madd lāzim, madd ṣilah, and the madds that appear only at
 * a stop.
 *
 *   ../Word Tables/مد لازم صلة عوض +.docx
 *   ../Audio/Audio - Madd lazim and silah/*.wav
 *
 * The docx is five tables, each under a heading, and the lesson follows the
 * headings: one section per table, in the order they are written. The tables
 * do not share a column layout, so each is read by its header row rather than
 * by position.
 *
 * Two of the sections need the timing engine told something the text cannot
 * say on its own, and both are carried as flags on the word:
 *  - `letterNames` for the surah-opening letters (الٓمٓ), which are read as
 *    their names — حي طهر hold a natural madd that nothing in the text marks;
 *  - `waqf` for the rows whose Length column says "at waqf only" — ʿiwaḍ,
 *    ʿāriḍ and līn exist only because the reading stops, so the estimate has
 *    to know it stops.
 *
 * Meanings are Sahih International's, quoted from the sheet verbatim, and the
 * lesson says so (`meaningSource`); the (i) shows the credit under a quotation.
 *
 * Run:  node scripts/make-lesson6.mjs
 */

import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';
import { addMaddSigns, normaliseZeros } from './lib/arabic.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'مد لازم صلة عوض +.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - Madd lazim and silah');
const AUDIO_OUT = join(here, '..', 'public', 'audio', 'lesson06');
const LESSON_OUT = join(here, '..', 'public', 'lessons', 'lesson06', 'words.json');

/** Each heading in the sheet, matched loosely, and the section it becomes. */
const SECTIONS = [
  {
    match: /kalim/i,
    id: 'lazim-kalimi',
    title: 'Madd Lāzim Kalimī',
    titleArabic: 'المد اللازم الكلمي',
    hint: 'A madd that runs straight into a shadda (muthaqqal) or a permanent sukoon (mukhaffaf). Always six harakat — the longest madd there is.',
    letterNames: false,
  },
  {
    match: /ḥarf|harf/i,
    id: 'lazim-harfi',
    title: 'Madd Lāzim Ḥarfī',
    titleArabic: 'المد اللازم الحرفي',
    hint: 'The letters that open some surahs, each read as its name. The names in نقص عسلكم hold six harakat; those in حي طهر only two.',
    letterNames: true,
  },
  {
    match: /ṣughr|sughr/i,
    id: 'silah-sughra',
    title: 'Madd Ṣilah Ṣughrā',
    titleArabic: 'مد الصلة الصغرى',
    hint: 'The pronoun هُ or هِ between two voiced letters grows a long vowel, written only as a small و or ي. Two harakat.',
    letterNames: false,
  },
  {
    match: /kubr/i,
    id: 'silah-kubra',
    title: 'Madd Ṣilah Kubrā',
    titleArabic: 'مد الصلة الكبرى',
    hint: 'The same pronoun, but the next word opens with a hamza — so the small vowel is held four harakat, like munfasil, and the Mushaf marks it with a maddah.',
    letterNames: false,
  },
  {
    match: /other/i,
    id: 'other',
    title: 'Other Types of Madd',
    titleArabic: 'أنواع أخرى من المد',
    hint: 'Badal: a hamza before its own long vowel, two harakat. ʿIwaḍ, ʿāriḍ and līn appear only when you stop — the last vowel goes, and the madd before it may be held two, four or six.',
    letterNames: false,
  },
];

/**
 * The Type / Name column, turned into chips.
 *
 * These are the author's own categories, read at a glance while teaching, so
 * they are badges rather than sentences. Length, when the sheet gives one, is a
 * chip too — it is the thing the learner is listening for.
 */
const BADGES = [
  [/muthaqqal/i, 'Muthaqqal'],
  [/mukhaffaf/i, 'Mukhaffaf'],
  [/maḍm|madm/i, 'Hāʾ maḍmūma'],
  [/maks/i, 'Hāʾ maksūra'],
  [/badal/i, 'Madd Badal'],
  [/iwa[dḍ]/i, 'Madd ʿIwaḍ'],
  [/[āa]ri[dḍ]/i, 'Madd ʿĀriḍ'],
  [/l[īi]n\b/i, 'Madd Līn'],
];

function lengthBadge(length) {
  const t = (length ?? '').trim();
  if (!t) return [];
  const out = [];
  const range = t.match(/(\d)\s*,\s*(\d)\s*or\s*(\d)/);
  const single = t.match(/^(\d)\s*ḥ?arak/i);
  if (range) out.push(`${range[1]}–${range[3]} ḥarakāt`);
  else if (single) out.push(`${single[1]} ḥarakāt`);
  if (/waqf/i.test(t)) out.push('At waqf');
  return out;
}

/**
 * The lam rule, read off the text — the same test derivedSilent() makes in
 * the app, so the chip and the greying always agree. A sun lam is ٱل followed
 * by a doubled letter; a moon lam carries its own sukoon.
 */
function lamBadge(text) {
  if (/ٱلۡ/.test(text)) return 'Moon ل';
  if (/ٱل[^\sً-ْٰ]?[ً-ِ]?ّ/.test(text)) return 'Sun ل';
  return null;
}

// ── read the docx in document order: heading, table, heading, table … ─────
const xml = readZipEntry(DOCX, 'word/document.xml').toString('utf8');
const body = xml.split('<w:body>')[1];
const text = (s) => {
  let t = '';
  for (const m of s.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) t += m[1];
  return t.replace(/&amp;/g, '&').trim();
};

const blocks = [];
let heading = '';
for (const m of body.matchAll(/<w:p[ >][\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>/g)) {
  const chunk = m[0];
  if (!chunk.startsWith('<w:tbl>')) {
    const t = text(chunk);
    if (t) heading = t;
    continue;
  }
  const rows = chunk
    .split(/<w:tr[ >]/)
    .slice(1)
    .map((r) => r.split('</w:tr>')[0].split(/<w:tc[ >]/).slice(1).map((c) => text(c.split('</w:tc>')[0])));
  blocks.push({ heading, rows });
}

const problems = [];
const words = [];
const sections = [];
let id = 0;

/** Uthmani text, madd signs applied by rule. */
const clean = (s) => addMaddSigns(normaliseZeros(s));

/** Which column holds what, from the header row. */
function columns(header) {
  const find = (re) => header.findIndex((h) => re.test(h));
  return {
    word: find(/^word/i),
    type: find(/type of madd|name of madd/i),
    meaning: find(/meaning/i),
    location: find(/^location/i),
    length: find(/^length/i),
  };
}

for (const block of blocks) {
  const section = SECTIONS.find((s) => s.match.test(block.heading));
  if (!section) {
    problems.push(`table under "${block.heading}" matches no known section — skipped`);
    continue;
  }
  if (sections.some((s) => s.id === section.id)) {
    problems.push(`two tables under "${block.heading}"`);
  }
  sections.push({ id: section.id, title: section.title, titleArabic: section.titleArabic, hint: section.hint });

  const col = columns(block.rows[0]);
  if (col.word === -1) {
    problems.push(`"${block.heading}": no Word column found in header [${block.rows[0].join(' | ')}]`);
    continue;
  }

  for (const cells of block.rows.slice(1)) {
    const raw = (cells[col.word] ?? '').trim();
    if (!raw) continue;

    // The id belongs to the row and is spent whether or not it is recorded —
    // calibrations are keyed by it and must never shift underneath them.
    id += 1;
    const n = String(id).padStart(2, '0');

    const type = col.type >= 0 ? cells[col.type] ?? '' : '';
    const badges = [];
    for (const [re, label] of BADGES) if (re.test(type) && !badges.includes(label)) badges.push(label);
    for (const b of lengthBadge(col.length >= 0 ? cells[col.length] : '')) badges.push(b);
    const lam = lamBadge(raw);
    if (lam) badges.push(lam);

    // The (i): a quoted meaning where the sheet has one; for the opening
    // letters, which mean nothing, where they open.
    let meaning;
    if (col.meaning >= 0 && cells[col.meaning]) meaning = cells[col.meaning].trim();
    else if (col.location >= 0 && cells[col.location]) meaning = `Opens ${cells[col.location].trim()}`;

    const entry = {
      id,
      section: section.id,
      text: clean(raw),
      audio: `word${n}.wav`,
      timings: null,
      badges,
    };
    if (meaning) entry.meaning = meaning;
    if (section.letterNames) entry.letterNames = true;
    if (col.length >= 0 && /waqf/i.test(cells[col.length] ?? '')) entry.waqf = true;
    words.push(entry);
  }
}

// ── cut the audio ─────────────────────────────────────────────────────────
const MARKS = /[ً-ٰۖ-ۭـ]/g;
// Byte-identical to the other generators, and therefore to what the intake
// tool derives a filename with. MARKS covers U+06D6–U+06ED, so the ṣilah's
// small waw and yeh fall out here too.
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();

// Two rows that derive the same filename would share one recording, and one
// of them would play the wrong word. Caught here, before anyone records.
{
  const seen = new Map();
  for (const w of words) {
    const k = key(w.text);
    if (seen.has(k)) problems.push(`#${seen.get(k)} and #${w.id} both derive the filename "${k}"`);
    else seen.set(k, w.id);
  }
}

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
    const match = byName.get(key(w.text));
    if (!match) {
      noAudio.push(`#${w.id} ${key(w.text)}`);
      continue;
    }
    used.add(match.file);
    const wav = readWav(join(AUDIO_SRC, match.file));
    const { segments } = splitIntoN(wav, 1);
    writeSegment(wav, segments[0][0], segments[0][1], join(AUDIO_OUT, w.audio), { mono: true });
    written += 1;
  }
  if (noAudio.length) problems.push(`no recording yet for ${noAudio.length}: ${noAudio.join(', ')}`);

  // The intake tool's speaker profile lives beside the words and belongs to
  // the pronunciation corpus, not to a row.
  const unused = readdirSync(AUDIO_SRC)
    .filter((f) => f.toLowerCase().endsWith('.wav') && !used.has(f) && !f.startsWith('speaker-'))
    .map((f) => f.replace(/\.wav$/i, ''));
  if (unused.length) problems.push(`${unused.length} recording(s) match no row: ${unused.join('، ')}`);
}

const referenced = new Set(words.map((w) => w.audio));
const orphans = readdirSync(AUDIO_OUT).filter((f) => f.endsWith('.wav') && !referenced.has(f));
if (orphans.length) problems.push(`${orphans.length} clip(s) no longer referenced: ${orphans.join(', ')}`);

// ── write the lesson ──────────────────────────────────────────────────────
const lesson = {
  lesson: 6,
  title: 'Madd Lāzim, Ṣilah and More',
  titleArabic: 'المد اللازم ومد الصلة وغيرهما',
  kind: 'letters',
  audioPath: 'audio/lesson06/',
  // Three to a page: the ṣilah rows are three-word phrases, and a long phrase
  // shrinks to fit its card — fewer, wider cards keep that shrink small.
  perPage: 3,
  meaningSource: 'Sahih International',
  sections,
  words,
};
mkdirSync(dirname(LESSON_OUT), { recursive: true });
writeFileSync(LESSON_OUT, JSON.stringify(lesson, null, 2), 'utf8');

console.log(`${words.length} cards across ${sections.length} sections`);
for (const s of sections) {
  console.log(`  ${s.id.padEnd(13)} ${String(words.filter((w) => w.section === s.id).length).padStart(2)} cards`);
}
console.log(`flags: ${words.filter((w) => w.letterNames).length} read by letter name, ${words.filter((w) => w.waqf).length} at waqf`);
console.log(`audio: wrote ${written} clips`);
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');
