/**
 * Builds the IQRA Kids alphabet lessons from the source-of-truth docx.
 *
 *   ../Word Tables/الحروف الهجائية.docx
 *   ../Audio/Audio - Kids Alphabet/*.wav
 *
 * Seven headed tables in, four lessons out:
 *
 *   31  the alphabet song, sung as letter NAMES
 *   20  the letters — ONE lesson, four sections (ب–ز · س–ق · ك–هـ · the
 *       hamza, the madd letters, لا and ة), 36 cards
 *   32  the alphabet song, sung as letter SOUNDS ×3
 *   33  where the letters come from — the five places, as the workbook has them
 *
 * ONE RECORDING PER CARD (the author, 2026-10-10). The seventh table has one
 * row per letter: a slot that names the file, the whole line the teacher says
 * — the letter and its picture, then fat-ha, damma, kasra and the sukoon — and
 * the Arabic that lights up as it is said. The other tables are display data.
 * So every take is a single piece, never cut: 36 letters and 2 songs.
 *
 * A lesson's number is its identity, never its position — `order` in
 * lessons.ts decides where each is read. See Design/iqra-kids.md.
 *
 * Run:  node scripts/make-alphabet.mjs
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'الحروف الهجائية.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - Kids Alphabet');
const PUBLIC = join(here, '..', 'public');

/** Diacritics, Quranic annotation marks and tatweel — the same class the app's
 *  audioName.ts uses. The two must agree or a recording never finds its row. */
const MARKS = /[ً-ٰۖ-ۭـ]/g;
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();

const problems = [];
const pad2 = (n) => String(n).padStart(2, '0');

// ── read the seven tables ─────────────────────────────────────────────────
const unescape = (s) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const xml = readZipEntry(DOCX, 'word/document.xml').toString('utf8');
const allRows = xml
  .split(/<w:tr[ >]/)
  .slice(1)
  .map((r) =>
    r
      .split('</w:tr>')[0]
      .split(/<w:tc[ >]/)
      .slice(1)
      .map((c) => {
        let t = '';
        for (const m of c.split('</w:tc>')[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) t += m[1];
        return unescape(t.trim());
      }),
  );

const blocks = [];
for (const row of allRows) {
  if (row[0] === 'Letter' || row[0] === '#' || row[0].startsWith('Slot')) blocks.push({ head: row, rows: [] });
  else if (blocks.length) blocks[blocks.length - 1].rows.push(row);
}
if (blocks.length !== 9) problems.push(`expected 9 tables in the sheet, found ${blocks.length}`);
// 8: the two songs (slot · what is sung), 9: the letter names, one word each,
// for the tracing lesson (slot = the name · letter · what to say).
const [ORD1, ORD2, ORD3, SPECIAL, SONG1, SONG2, SCRIPT, SONGS, NAMES] = blocks;

// ── shape families, from song 1's table — the color every letter wears ────
/** bare letter → family index (0..16), consecutive shape groups in the usual order */
const FAMILY = new Map();
{
  let fam = -1;
  let last = null;
  for (const r of SONG1?.rows ?? []) {
    if (r[3] !== last) { fam += 1; last = r[3]; }
    FAMILY.set(key(r[1]), fam);
  }
  // Letters the song shows under another shape share its family — whichever
  // of them the song's table happens to write (the first letter is the plain
  // ا since 2026-10-24; it was أ).
  for (const kin of [['ا', 'أ', 'ء', 'ؤ', 'ئ', 'إ'], ['ى', 'ي'], ['ه', 'ة'], ['ل', 'لا']]) {
    const found = kin.find((k) => FAMILY.has(k));
    if (found !== undefined) for (const k of kin) if (!FAMILY.has(k)) FAMILY.set(k, FAMILY.get(found));
  }
}
const familyOf = (letter) => FAMILY.get(key(letter)) ?? 0;

/**
 * The one teaching line a card shows under its sounds, and the shape on the
 * back of a card. App wording, kept here rather than in the sheet: the
 * sheet's Note column is the author's margin, and what the teacher SAYS is
 * the script table. (The author, 2026-10-24: ى merges with يـ, the card
 * flips from the duck to the duck in the boat; alif gets بَا تَا ثَا and a
 * line on why it is a letter of madd.)
 */
const TIP = {
  'ى': 'At the beginning of a word, ى changes its shape to يـ and takes two dots below it.',
  'ا': 'Alif comes after a letter with a fat-ha and makes that fat-ha longer. That is why it is called a letter of madd — madd means to make longer.',
};
const FLIP = {
  'ى': {
    letter: 'يـ',
    image: 'ي.png',
    mnemonic: 'The duck jumps into the boat — two bubbles below',
    prompt: 'Tap me to see how I change shape at the beginning of a word',
    back: 'Show original form',
  },
};

const isHarakaTriple = (forms) =>
  forms.length >= 3 && forms.slice(0, 3).every((f) => f && key(f).length <= 2);

const IMAGE_FOR = { 'أ': 'ء' };
const imageOf = (letter, mnemonic) => {
  if (!mnemonic) return undefined;
  const k = key(letter);
  return `${IMAGE_FOR[k] ?? k}.png`;
};

const zoneOf = (makhraj) => {
  const m = (makhraj ?? '').trim();
  if (/^Throat/.test(m)) return 'throat';
  if (/^Lips/.test(m)) return 'lips';
  if (/^Empty/.test(m)) return 'jawf';
  if (/^Nose/.test(m)) return 'nose';
  return 'tongue';
};

// ── the letter cards ──────────────────────────────────────────────────────
let nextId = 0;
/** Every take the audio folder should hold: one whole recording per clip. */
const takes = [];
const scriptRows = SCRIPT?.rows ?? [];
let scriptAt = 0;

function letterCard(cells, { special, section }) {
  const letter = cells[0];
  const name = cells[1];
  const forms = special ? cells.slice(2, 7).filter(Boolean) : cells.slice(2, 6).filter(Boolean);
  const makhraj = special ? cells[7] : cells[6];
  const mnemonic = special ? cells[8] : cells[7];
  if (!letter) return null;
  if (!forms.length) { problems.push(`row "${letter}" has no forms`); return null; }

  const id = (nextId += 1);
  const n = pad2(id);
  const bare = key(letter);
  const triple = isHarakaTriple(forms);

  // The sheet's spoken line for this row — by position, checked by name.
  const sr = scriptRows[scriptAt];
  if (!sr) { problems.push(`no spoken line left for letter row "${letter}"`); return null; }
  if (!key(sr[0]).startsWith(bare)) problems.push(`spoken line ${scriptAt + 1} ("${sr[0]}") does not belong to letter row "${letter}"`);
  scriptAt += 1;
  const slot = key(sr[0]);
  const highlight = sr[2] || forms.join(' ');
  if (key(highlight) !== key(forms.join(' '))) problems.push(`#${id} ${letter}: the Arabic that lights up (${highlight}) is not the row's forms (${forms.join(' ')})`);

  // Alif first: its بَا تَا ثَا are two-letter keys and would pass for a
  // harakat triple.
  const labels = bare === 'ا'
    ? forms.map(() => 'Madd')
    : triple
      ? ['Fat-ha', 'Damma', 'Kasra', 'Sukoon', 'Madd'].slice(0, forms.length)
      : bare === 'لا' ? ['Alone', 'In a word']
      : forms.map(() => 'Word');

  takes.push({ key: slot, clip: `word${n}.wav`, of: `#${id} ${letter}` });

  return {
    id,
    section,
    letter,
    name: name || undefined,
    makhraj: makhraj || undefined,
    mnemonic: mnemonic || undefined,
    image: imageOf(letter, mnemonic),
    family: familyOf(letter),
    // no makhraj badge on a letter card; the field stays for the places page
    badges: [],
    text: highlight,
    audio: `word${n}.wav`,
    timings: null,
    parts: forms,
    labels,
    // By the letter as the sheet writes it, not its key: ىٰ keys to ى too,
    // and must not inherit the duck's back.
    tip: TIP[letter],
    flip: FLIP[letter],
    script: sr[1],
  };
}

const cardsFrom = (block, section, special = false) =>
  (block?.rows ?? []).map((cells) => letterCard(cells, { special, section })).filter(Boolean);

const HINT = 'Each letter: its name and its picture, then fat-ha, damma and kasra — then a sukoon after نَ.';
const L20 = {
  lesson: 20,
  title: 'The Letters',
  titleArabic: 'الحروف',
  kind: 'letters',
  audioPath: 'audio/lesson20/',
  imagePath: 'images/kids/',
  perPage: 1,
  sections: [
    { id: 'one', title: 'The Letters — ب to ز', titleArabic: 'الحروف ١', hint: HINT },
    { id: 'two', title: 'The Letters — س to ق', titleArabic: 'الحروف ٢', hint: HINT },
    { id: 'three', title: 'The Letters — ك to هـ', titleArabic: 'الحروف ٣', hint: HINT },
    // The author's order (2026-10-24): و ى ا ء. ىٰ، لا and ة left for a
    // lesson of their own.
    { id: 'special', title: 'The Letters — و ى ا ء', titleArabic: 'الحروف ٤', hint: 'و and ى, then the alif — a letter of madd — then the hamza. Take them slowly.' },
  ],
  words: [
    ...cardsFrom(ORD1, 'one'),
    ...cardsFrom(ORD2, 'two'),
    ...cardsFrom(ORD3, 'three'),
    ...cardsFrom(SPECIAL, 'special', true),
  ],
};
if (scriptAt !== scriptRows.length) problems.push(`${scriptRows.length - scriptAt} spoken line(s) belong to no letter row`);

// ── the two songs ─────────────────────────────────────────────────────────
/**
 * A song is ONE recording, never cut, and ONE card: a strip of letters that
 * glides so the sung letter is at the center. `song.steps` says what each step
 * shows, which group it belongs to (a shape family in song 1, a letter in song
 * 2) and its family color. Boundaries come from tapping along in the admin
 * calibration page — a sung rhythm has nothing to do with harakat weights.
 */
function songLesson(id, block, { title, titleArabic, blurb, sounds, file }) {
  const rows = block?.rows ?? [];
  const steps = [];
  rows.forEach((r, i) => {
    const family = familyOf(r[1]);
    if (sounds) for (const text of [r[2], r[3], r[4]]) steps.push({ text, group: i, family, zone: zoneOf(r[5]) });
    else steps.push({ text: r[1], group: family, family });
  });
  takes.push({ key: file, clip: `${file}.wav`, of: `lesson ${id} — the whole song` });
  return {
    lesson: id,
    title,
    titleArabic,
    kind: 'letters',
    audioPath: `audio/lesson${id}/`,
    imagePath: 'images/kids/',
    perPage: 1,
    sections: [{ id: 'song', title, titleArabic, hint: blurb }],
    song: { mode: sounds ? 'sounds' : 'names', steps },
    words: [{ id: 1, section: 'song', text: steps.map((s) => s.text).join(' '), audio: `${file}.wav`, timings: null, badges: [] }],
  };
}
const L31 = songLesson(31, SONG1, {
  file: 'song-names',
  title: 'The Alphabet Song — the Names',
  titleArabic: 'أنشودة الحروف — الأسماء',
  blurb: 'The 28 letters in their usual order. Sing along, and press pause whenever you like.',
});
const L32 = songLesson(32, SONG2, {
  file: 'song-sounds',
  sounds: true,
  title: 'The Alphabet Song — the Sounds',
  titleArabic: 'أنشودة الحروف — الحركات',
  blurb: 'Every letter sung with fat-ha, damma and kasra.',
});

// ── where the letters come from — the workbook's five places ──────────────
const PLACES = [
  { zone: 'jawf', title: 'Mouth space', titleArabic: 'الجوف', note: 'The madd letters.', letters: ['ا', 'و', 'ى'] },
  { zone: 'throat', title: 'Throat', titleArabic: 'الحلق', note: '6 letters.', letters: ['ء', 'ه', 'ع', 'ح', 'غ', 'خ'] },
  { zone: 'tongue', title: 'Tongue', titleArabic: 'اللسان', note: 'All the other 18 letters.', letters: ['ت', 'ث', 'ج', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ق', 'ك', 'ل', 'ن', 'ي'] },
  { zone: 'lips', title: 'Lips', titleArabic: 'الشفتان', note: '4 letters.', letters: ['ب', 'م', 'و', 'ف'] },
  { zone: 'nose', title: 'Nose', titleArabic: 'الخيشوم', note: 'Ghunna — 2 letters.', letters: ['ن', 'م'] },
];
const L33 = {
  lesson: 33,
  title: 'Where the Letters Come From',
  titleArabic: 'مخارج الحروف',
  kind: 'letters',
  audioPath: 'audio/lesson20/',
  imagePath: 'images/kids/',
  perPage: 1,
  sections: [{ id: 'places', title: 'Where the Letters Come From', titleArabic: 'مخارج الحروف', hint: 'Five places — mouth space, throat, tongue, lips and nose — as in the workbook.' }],
  words: PLACES.map((p, i) => ({
    id: i + 1,
    section: 'places',
    image: `makhraj-${p.zone}.png`,
    badges: [],
    place: { zone: p.zone, title: p.title, titleArabic: p.titleArabic, note: p.note, letters: p.letters.map((text) => ({ text, family: familyOf(text) })) },
  })),
};

// ── tracing the letters — one letter a screen, drawn live, then traced ─────
/**
 * Lesson 30: the same 29 letters in the same order, each with its stroke
 * template (`scripts/tracing/strokes.json`, derived from the font's own
 * glyphs — see scripts/tracing/README.md) and the recording of its NAME
 * (table 9: one word, said once), which plays as the card opens. A letter
 * without a template is still a card — it says so instead of tracing.
 */
const STROKES_PATH = join(here, 'tracing', 'strokes.json');
const STROKES = existsSync(STROKES_PATH) ? JSON.parse(readFileSync(STROKES_PATH, 'utf8')) : {};
const nameRows = NAMES?.rows ?? [];
if (SONGS && SONGS.rows.length !== 2) problems.push(`table 8 should hold the two songs, found ${SONGS.rows.length} rows`);
const L30 = {
  lesson: 30,
  title: 'Tracing the Letters',
  titleArabic: 'كتابة الحروف',
  kind: 'letters',
  audioPath: 'audio/lesson30/',
  imagePath: 'images/kids/',
  perPage: 1,
  sections: L20.sections.map((s) => ({
    ...s,
    hint: 'Watch the letter draw itself, then trace it with your finger: start at the dot and follow the line.',
  })),
  words: L20.words.map((w, i) => {
    const id = i + 1;
    const n = pad2(id);
    const nr = nameRows.find((r) => key(r[1]) === key(w.letter));
    if (!nr) problems.push(`table 9 has no name row for the letter ${w.letter}`);
    else takes.push({ key: key(nr[0]), clip: `name${n}.wav`, of: `#${id} ${w.letter} — its name` });
    const trace = STROKES[w.letter];
    if (!trace) problems.push(`no stroke template for ${w.letter} in scripts/tracing/strokes.json`);
    return {
      id,
      section: w.section,
      letter: w.letter,
      name: w.name,
      family: w.family,
      badges: [],
      text: w.name ?? w.letter,
      audio: nr ? `name${n}.wav` : undefined,
      timings: null,
      trace: trace ?? null,
    };
  }),
};

const LESSONS = [L31, L20, L32, L30, L33];

// ── audio: one piece per take, edges trimmed, mono ────────────────────────
const byName = new Map();
if (existsSync(AUDIO_SRC)) {
  for (const f of readdirSync(AUDIO_SRC)) {
    if (!f.toLowerCase().endsWith('.wav')) continue;
    const base = f.replace(/\.wav$/i, '');
    const numbered = /^(.*?)\s+(\d+)$/.exec(base);
    const k = key(numbered ? numbered[1] : base);
    const take = numbered ? Number(numbered[2]) : 1;
    const prev = byName.get(k);
    if (!prev || take > prev.take) byName.set(k, { file: f, take });
  }
} else problems.push(`no audio folder yet: ${AUDIO_SRC}`);

const clipHome = new Map();
for (const l of LESSONS) for (const w of l.words) if (w.audio) clipHome.set(w.audio, l.lesson);

const used = new Set();
const missing = [];
let written = 0;
for (const t of takes) {
  const match = byName.get(t.key);
  if (!match) { missing.push(`${t.key}.wav  (${t.of})`); continue; }
  used.add(match.file);
  const wav = readWav(join(AUDIO_SRC, match.file));
  const dir = join(PUBLIC, 'audio', `lesson${clipHome.get(t.clip)}`);
  mkdirSync(dir, { recursive: true });
  // One piece per take, but cut as every lesson's clips are: the splitter
  // at one piece drops the record click (every take here has one, 0.02–0.35
  // s, up to as loud as the voice), the beat of silence before the voice
  // and the stop click after it, and prints each decision. Copying the
  // take whole left the click in every clip (2026-10-25).
  const { segments } = splitIntoN(wav, 1);
  const [from, to] = segments[0] ?? [0, wav.frames];
  writeSegment(wav, from, to, join(dir, t.clip), { mono: true });
  written += 1;
}
if (existsSync(AUDIO_SRC)) {
  const unused = readdirSync(AUDIO_SRC).filter((f) => f.toLowerCase().endsWith('.wav') && !used.has(f) && !f.startsWith('speaker-')) /* the profile belongs beside the takes */.map((f) => f.replace(/\.wav$/i, ''));
  if (unused.length) problems.push(`${unused.length} recording(s) match no row: ${unused.join('، ')}`);
}

// ── write ─────────────────────────────────────────────────────────────────
for (const l of LESSONS) {
  const out = join(PUBLIC, 'lessons', `lesson${l.lesson}`, 'words.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(l, null, 2), 'utf8');
}

// ── report ────────────────────────────────────────────────────────────────
console.log('lessons written');
for (const l of LESSONS) console.log(`  ${l.lesson}  ${String(l.words.length).padStart(2)} cards   ${l.title}`);
console.log(`\ntakes expected: ${takes.length}  (every one a single piece — set the intake tool to 1)`);
console.log(`recorded      : ${takes.length - missing.length}`);
console.log(`clips written : ${written}`);
if (missing.length) {
  console.log(`\nNOT RECORDED YET — ${missing.length}: in the intake tool open the sheet and record table 7 (the spoken lines), table 8 (the two songs) and table 9 (the letter names), each by its Slot column, into Audio/Audio - Kids Alphabet/`);
  console.log('  ' + missing.map((m) => m.split('  ')[0]).join('  '));
}
const needsTap = takes.filter((t) => byName.has(t.key)).map((t) => t.of);
console.log(`\nNEEDS TAP CALIBRATION (admin → the lesson → Calibrate timings): ${needsTap.length} of ${takes.length} recorded`);
console.log(needsTap.length ? '  ' + needsTap.join(' · ') : '  nothing recorded yet. Every letter and both songs will need tapping once they are — a tap per Arabic letter, so بَ بُ بِ نَبۡ is five.');
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');

const wantImages = new Set();
for (const l of LESSONS) for (const w of l.words) {
  if (w.image) wantImages.add(w.image);
  if (w.flip?.image) wantImages.add(w.flip.image);
}
const have = new Set(existsSync(join(PUBLIC, 'images', 'kids')) ? readdirSync(join(PUBLIC, 'images', 'kids')) : []);
const noImage = [...wantImages].filter((f) => !have.has(f));
console.log(`\npictures: ${wantImages.size} wanted, ${wantImages.size - noImage.length} present${noImage.length ? `\n  missing: ${noImage.join(' ')}` : ''}`);
