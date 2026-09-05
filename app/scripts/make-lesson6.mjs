/**
 * Builds Lesson 6 — madd lāzim, madd ṣilah, badal/ʿiwaḍ/līn, and madd ʿāriḍ.
 *
 *   ../Word Tables/مد لازم صلة عوض +.docx
 *   ../Audio/Audio - Madd Lazim Silah +/*.wav
 *
 * The docx is six tables, each under a heading, and the lesson follows the
 * headings: one section per table, in the order written. Each is read by its
 * header row, never by position.
 *
 * The sixth, madd ʿāriḍ, lists the badal and līn words once more with a
 * `وقف` tag in the Word cell; each becomes three cards — held 2, 4 and 6
 * harakat at the stop. Were that table ever missing, the section is DERIVED
 * from the badal table instead and the run says so; the sheet is the source of
 * truth for words, this file only for rules.
 *
 * ʿĀriḍ audio is ONE take per word said three ways, named `<word> وقف.wav`
 * and split into three — lesson 4's `<word> و ثم` convention. The intake tool
 * derives that name when the slot's line reads "<word> وقف" with expect 3, so
 * nothing is typed as a filename and nothing collides with the same word's
 * single-reading clip in the badal section.
 *
 * Two flags carry what the text cannot say to the timing engine:
 *  - `letterNames` for the surah-opening letters (الٓمٓ), read as their names;
 *  - `waqf` (+ `waqfMadd`) for rows read at a stop — ʿiwaḍ, ʿāriḍ and līn exist
 *    only because the reading stops, so the estimate has to know it stops.
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
const AUDIO_SRC = join(root, 'Audio', 'Audio - Madd Lazim Silah +');
const AUDIO_OUT = join(here, '..', 'public', 'audio', 'lesson06');
const LESSON_OUT = join(here, '..', 'public', 'lessons', 'lesson06', 'words.json');

/** The tag on an ʿāriḍ take's filename: the word said at the stop, three ways. */
const WAQF_TAG = 'وقف';
const ARID_LENGTHS = [2, 4, 6];

/** Each heading in the sheet, matched loosely, and the section it becomes. */
const SECTIONS = [
  {
    match: /kalim/i,
    id: 'lazim-kalimi',
    title: 'Madd Lāzim Kalimī',
    titleArabic: 'المد اللازم الكلمي',
    hint: 'A madd that runs straight into a shadda (muthaqqal) or a permanent sukoon (mukhaffaf). Always six harakat — the longest madd there is.',
  },
  {
    match: /ḥarf|harf/i,
    id: 'lazim-harfi',
    title: 'Madd Lāzim Ḥarfī',
    titleArabic: 'المد اللازم الحرفي',
    hint: 'The letters that open some surahs, each read as its name. The letters in نقص عسلكم hold six harakat; those in حي طهر only two.',
    letterNames: true,
  },
  {
    match: /ṣughr|sughr/i,
    id: 'silah-sughra',
    title: 'Madd Ṣilah Ṣughrā',
    titleArabic: 'مد الصلة الصغرى',
    hint: 'The pronoun هُ or هِ grows a natural madd when followed by a small و or ي. Two harakat.',
  },
  {
    match: /kubr/i,
    id: 'silah-kubra',
    title: 'Madd Ṣilah Kubrā',
    titleArabic: 'مد الصلة الكبرى',
    hint: 'The same pronoun, but the next word opens with a hamza — the madd is held four harakat, like munfasil, and the Mushaf marks it with a maddah.',
  },
  {
    match: /other|badal/i,
    id: 'badal-iwad-lin',
    title: 'Madd Badal, ʿIwaḍ and Līn',
    titleArabic: 'مد البدل والعوض واللين',
    hint: 'Badal: a hamza followed by a natural madd — two harakat. ʿIwaḍ appears when you stop at a tanween fatḥ and read it as an alif — two harakat. Līn is a و or ي with sukoon after a fatha — two harakat when recitation continues; two, four or six at waqf (see madd ʿāriḍ).',
    /** Rows typed ʿāriḍ belong to the section below, not here. */
    exclude: /[āa]ri[dḍ]/i,
  },
];

/** The ʿāriḍ section — read from the sheet if it has one, derived otherwise. */
const ARID = {
  match: /[āa]ri[dḍ]/i,
  id: 'arid',
  title: 'Madd ʿĀriḍ li-s-Sukūn',
  titleArabic: 'المد العارض للسكون',
  hint: 'Arises only at waqf. Stopping on a word drops its last vowel, and a natural madd, a līn madd or a badal madd just before that letter can then be held two, four or six harakat. When two reasons for madd meet in one word, the stronger takes precedence.',
};

/**
 * Corrections to the sheet — none at present. The pattern, when one is needed:
 * apply to ONE cell, spelled out by codepoint from the document itself, and
 * report on every run so the source is never edited behind the author's back
 * (see make-lesson2.mjs). The maddah on حَـٰٓ lived here for a day before the
 * author had it put in the sheet.
 */
const applied = [];
const correct = (s) => s;

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

const MARKS = /[ً-ٰۖ-ۭـ]/g;
const SHADDA = 'ّ';
const RECT_ZERO = '۠';

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

/** A doubled nūn or mīm always hums — the ghunna the learner is listening for. */
function ghunnaBadge(text) {
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== 'ن' && chars[i] !== 'م') continue;
    for (let j = i + 1; j < chars.length && MARKS.test(chars[j]) && (MARKS.lastIndex = 0, true); j++) {
      if (chars[j] === SHADDA) return 'Ghunna';
    }
  }
  return null;
}

/**
 * Ghunna inside the letter NAMES of a surah opener.
 *
 * Nothing in الٓمٓ is written with a nūn or mīm sākin — but "lām" ends in one,
 * and it meets the "mīm" that follows. The rules of nūn and mīm sākinah apply
 * to the names exactly as they would to written letters. The same table lives
 * in timing.ts, which gives the hum its time; this one only labels it.
 */
const NAME_ENDS_IN = { ل: 'م', م: 'م', س: 'ن', ع: 'ن', ن: 'ن' };
/** "Ṣād" ends in a sākin د — the one letter name that ends in a qalqalah letter. */
const NAME_ENDS_IN_QALQALAH = new Set('ص');
const IKHFA = new Set('تثجدذزسشصضطظفقك');
const IDGHAM_GHUNNA = new Set('ينمو');
function letterNameBadge(text) {
  const letters = [...text.replace(MARKS, '').replace(/\s+/g, '')];
  const found = new Set();
  if (letters.some((l) => NAME_ENDS_IN_QALQALAH.has(l))) found.add('Hidden Qalqala');
  for (let i = 0; i + 1 < letters.length; i++) {
    const end = NAME_ENDS_IN[letters[i]];
    const next = letters[i + 1];
    if (!end) continue;
    if (end === 'م' && (next === 'م' || next === 'ب')) found.add('Hidden Ghunna');
    if (end === 'ن') {
      if (IDGHAM_GHUNNA.has(next) || next === 'ب') found.add('Hidden Ghunna');
      else if (IKHFA.has(next)) found.add('Hidden Ikhfaa');
    }
  }
  return [...found];
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

/** Uthmani text: the sheet's corrections applied, then the madd sign by rule. */
const clean = (s) => addMaddSigns(normaliseZeros(correct(s.trim())));
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();

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

/** Rows set aside from the badal table for the ʿāriḍ section. */
const aridSource = [];
let aridTable = null;

for (const block of blocks) {
  if (ARID.match.test(block.heading)) {
    aridTable = block;
    continue;
  }
  const section = SECTIONS.find((s) => s.match.test(block.heading));
  if (!section) {
    problems.push(`table under "${block.heading}" matches no known section — skipped`);
    continue;
  }
  if (sections.some((s) => s.id === section.id)) problems.push(`two tables under "${block.heading}"`);
  sections.push({ id: section.id, title: section.title, titleArabic: section.titleArabic, hint: section.hint });

  const col = columns(block.rows[0]);
  if (col.word === -1) {
    problems.push(`"${block.heading}": no Word column in header [${block.rows[0].join(' | ')}]`);
    continue;
  }

  for (const cells of block.rows.slice(1)) {
    const raw = (cells[col.word] ?? '').trim();
    if (!raw) continue;
    const type = col.type >= 0 ? cells[col.type] ?? '' : '';
    const length = col.length >= 0 ? cells[col.length] ?? '' : '';
    let meaning;
    if (col.meaning >= 0 && cells[col.meaning]) meaning = cells[col.meaning].trim();
    else if (col.location >= 0 && cells[col.location]) meaning = `Opens ${cells[col.location].trim()}`;

    // Every badal/ʿāriḍ/līn word is also an ʿāriḍ word; the one typed ʿāriḍ
    // lives nowhere else.
    if (section.id === 'badal-iwad-lin' && !/iwa[dḍ]/i.test(type)) aridSource.push({ raw, meaning });
    if (section.exclude?.test(type)) continue;

    // The id belongs to the row and is spent whether or not it is recorded —
    // calibrations are keyed by it and must never shift underneath them.
    id += 1;
    const cleaned = clean(raw);
    const badges = [];
    for (const [re, label] of BADGES) if (re.test(type) && !badges.includes(label)) badges.push(label);
    badges.push(...lengthBadge(length));
    const lam = lamBadge(cleaned);
    if (lam) badges.push(lam);
    const ghunna = ghunnaBadge(cleaned);
    if (ghunna) badges.push(ghunna);
    if (section.letterNames) badges.push(...letterNameBadge(cleaned));
    // The rectangular zero: this alif sounds at a stop and vanishes when the
    // reading carries on (أَنَا۠ ٱللَّهُ). derivedSilent() greys it; this names it.
    if (cleaned.includes(RECT_ZERO)) badges.push('Conditional silent alif');

    const entry = { id, section: section.id, text: cleaned, audio: `word${String(id).padStart(2, '0')}.wav`, timings: null, badges };
    if (meaning) entry.meaning = meaning;
    if (section.letterNames) entry.letterNames = true;
    if (/waqf/i.test(length)) entry.waqf = true;
    words.push(entry);
  }
}

// ── the ʿāriḍ section: each word at the stop, held 2, 4 and 6 ─────────────
sections.push({ id: ARID.id, title: ARID.title, titleArabic: ARID.titleArabic, hint: ARID.hint });
let aridRows;
if (aridTable) {
  const col = columns(aridTable.rows[0]);
  // The Word cell reads "<word> وقف": the tag tells the intake tool what to
  // name the take, and is not part of the word. It comes off for the card and
  // goes back on for the filename.
  const untag = (s) => s.replace(new RegExp('\\s*' + WAQF_TAG + '\\s*$'), '').trim();
  aridRows = aridTable.rows
    .slice(1)
    .map((cells) => ({ raw: untag(cells[col.word] ?? ''), meaning: col.meaning >= 0 ? cells[col.meaning]?.trim() : undefined }))
    .filter((r) => r.raw);
} else {
  aridRows = aridSource;
  problems.push(`ʿāriḍ section derived from the badal table (${aridRows.length} words) — a "Madd ʿĀriḍ" table in the sheet would be read instead`);
}

/** The three cards of one ʿāriḍ word, grouped so one recording feeds all three. */
const aridGroups = [];
for (const row of aridRows) {
  const cleaned = clean(row.raw);
  const group = { key: key(cleaned), cards: [] };
  for (const n of ARID_LENGTHS) {
    id += 1;
    const entry = {
      id,
      section: ARID.id,
      text: cleaned,
      audio: `word${String(id).padStart(2, '0')}.wav`,
      timings: null,
      badges: ['Madd ʿĀriḍ', `${n} ḥarakāt`, 'At waqf'],
      waqf: true,
      waqfMadd: n,
      // The last vowel is greyed: it is written, and at the stop it is not said.
      dimFinalMark: true,
    };
    if (row.meaning) entry.meaning = row.meaning;
    words.push(entry);
    group.cards.push(entry);
  }
  aridGroups.push(group);
}

// ── cut the audio ─────────────────────────────────────────────────────────
{
  // Two rows that derive the same filename would share one recording, and one
  // of them would play the wrong word. The ʿāriḍ cards are meant to share —
  // they are cut from one take — so they are checked as groups.
  const seen = new Map();
  const claim = (k, who) => {
    if (seen.has(k)) problems.push(`${seen.get(k)} and ${who} both derive the filename "${k}"`);
    else seen.set(k, who);
  };
  for (const w of words) if (w.section !== ARID.id) claim(key(w.text), `#${w.id}`);
  for (const g of aridGroups) claim(`${g.key} ${WAQF_TAG}`, `ʿāriḍ ${g.cards.map((c) => '#' + c.id).join('/')}`);
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
    if (w.section === ARID.id) continue;
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

  // One take per ʿāriḍ word, said three ways: 2, then 4, then 6. Each should be
  // longer than the one before; anything else is worth a listen.
  for (const g of aridGroups) {
    const match = byName.get(`${g.key} ${WAQF_TAG}`);
    if (!match) {
      noAudio.push(`ʿāriḍ ${g.key} ${WAQF_TAG} (one take, said at 2, 4 and 6)`);
      continue;
    }
    used.add(match.file);
    const wav = readWav(join(AUDIO_SRC, match.file));
    const { segments, durations } = splitIntoN(wav, ARID_LENGTHS.length);
    if (segments.length !== ARID_LENGTHS.length) {
      problems.push(`${match.file}: split gave ${segments.length} pieces, expected ${ARID_LENGTHS.length}`);
      continue;
    }
    if (!(durations[0] < durations[1] && durations[1] < durations[2])) {
      problems.push(`${match.file}: lengths not rising — ${durations.map((d) => d.toFixed(2)).join(' / ')}`);
    }
    segments.forEach(([a, b], i) => {
      writeSegment(wav, a, b, join(AUDIO_OUT, g.cards[i].audio), { mono: true });
      written += 1;
    });
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
  // shrinks to fit its card — fewer, wider cards keep that shrink small. It
  // also puts one ʿāriḍ word's 2 / 4 / 6 side by side on one screen.
  perPage: 3,
  meaningSource: 'Sahih International',
  sections,
  words,
};
mkdirSync(dirname(LESSON_OUT), { recursive: true });
writeFileSync(LESSON_OUT, JSON.stringify(lesson, null, 2), 'utf8');

console.log(`${words.length} cards across ${sections.length} sections`);
for (const s of sections) {
  console.log(`  ${s.id.padEnd(15)} ${String(words.filter((w) => w.section === s.id).length).padStart(2)} cards`);
}
console.log(`flags: ${words.filter((w) => w.letterNames).length} read by letter name, ${words.filter((w) => w.waqf).length} at waqf`);
console.log(`audio: wrote ${written} clips`);
if (applied.length) console.log(`\nCORRECTIONS APPLIED (docx unchanged):\n  ${applied.join('\n  ')}`);
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');
