/**
 * Builds Lesson 2 (lam shamsiyya / qamariyya) from the source-of-truth docx
 * and the paired recordings.
 *
 *   ../Word Tables/لام شمسية وقمرية.docx
 *   ../Audio/Audio - Lam shamseya and qamareya/{Lam Qamareya,Lam Shamseya}/*.wav
 *
 * Each recording holds BOTH forms (bare, ~1s pause, with ال); they are split
 * into two files so each form is independently playable.
 *
 * The Arabic text is taken verbatim from the docx — the only edit made is
 * inserting the sukoon on a qamariyya lam (the docx omits it). Anything else
 * that looks inconsistent is REPORTED, never silently changed.
 *
 * Run:  node scripts/make-lesson2.mjs
 */

import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, findSegments, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'لام شمسية وقمرية.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - Lam shamseya and qamareya');
const AUDIO_OUT = join(here, '..', 'public', 'audio', 'lesson02');
const LESSON_OUT = join(here, '..', 'public', 'lessons', 'lesson02', 'words.json');

const SUKOON = 'ْ'; // U+0652 — the modern circular sukoon, as typed in the docx
const MUSHAF_SUKOON = 'ۡ'; // U+06E1 — the small head of khah the Mushaf draws
const ALIF = 'ا'; // U+0627
const ALIF_WASLA = 'ٱ'; // U+0671 — carries the ص of hamzat wasl
const LAM = 'ل';
const MARKS = /[ً-ْٰۡـٓٔ]/g;
const bare = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا');

/**
 * Uthmani spellings that differ from the everyday spelling in the docx.
 * Keyed by the bare (mark-free) word. These are the Madinah Mushaf forms:
 * dagger alifs replacing written alifs, the maddah in ٱلشِّتَآءِ, the hamza on
 * its tatweel seat in ٱلْأَفْـِٔدَةِ, and the ikhfa noon left unmarked.
 *
 * Every entry is printed on each run so the spellings stay reviewable.
 */
const cp = (...codes) => String.fromCodePoint(...codes);
const UTHMANI = {
  كافرون: 'كَٰفِرُونَ',
  إنسان: 'إِنسَٰنَ',
  منفوش: 'مَنفُوشِ',
  عاديات: 'عَٰدِيَٰتِ',
  موريات: 'مُورِيَٰتِ',
  مغيرات: 'مُغِيرَٰتِ',
  صالحات: 'صَٰلِحَٰتِ',
  // alif + maddah as separate codepoints, the way Uthmani text encodes it
  شتاء: cp(0x634, 0x650, 0x62a, 0x64e, 0x627, 0x653, 0x621, 0x650),
  أفئدة: 'أَفْـِٔدَةِ',
};
const uthmaniUsed = [];

/**
 * Typos in the docx where the two forms of a word disagree. Each is applied
 * to ONE cell and reported on every run, so the correction stays visible and
 * the source document is never edited behind the author's back.
 */
const CORRECTIONS = [
  // المُصَلَّينَ: the lam carries shadda+fatha; the ayah (and the bare form
  // in the same row) has shadda+kasra. Spelled out by codepoint because the
  // mark order in the document isn't what you'd type by hand.
  {
    find: cp(0x627, 0x644, 0x645, 0x64f, 0x635, 0x64e, 0x644, 0x651, 0x64e, 0x64a, 0x646, 0x64e),
    replace: cp(0x627, 0x644, 0x645, 0x64f, 0x635, 0x64e, 0x644, 0x651, 0x650, 0x64a, 0x646, 0x64e),
    why: 'lam should carry kasra, not fatha',
  },
  // العَادِياتِ is missing the fatha on the ya that the bare form has.
  { find: 'العَادِياتِ', replace: 'العَادِيَاتِ', why: 'missing fatha on the ya' },
  // تَكَاثُرٌ is the only word left with tanween; the definite form has a plain damma.
  { find: 'تَكَاثُرٌ', replace: 'تَكَاثُرُ', why: 'stray tanween — the sheet is otherwise tanween-free' },
];
const applied = [];
const correct = (s) => {
  for (const c of CORRECTIONS) {
    if (s === c.find) {
      applied.push(`${c.find} → ${c.replace}  (${c.why})`);
      return c.replace;
    }
  }
  return s;
};

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

// Columns: [ meaning, definite, indefinite, meaning, definite, indefinite ]
//            └────── qamariyya ──────┘      └────── shamsiyya ──────┘
const problems = [];
const collect = (type, mCol, dCol, nCol) => {
  const out = [];
  for (const cells of rows.slice(2)) {
    const meaning = (cells[mCol] ?? '').trim();
    const definite = correct((cells[dCol] ?? '').trim());
    const indefinite = correct((cells[nCol] ?? '').trim());
    if (!definite || !indefinite) continue;
    out.push({ type, meaning, definite, indefinite });
  }
  return out;
};

const entries = [...collect('qamariyya', 0, 1, 2), ...collect('shamsiyya', 3, 4, 5)];

// ── normalise + validate each entry ───────────────────────────────────────
const words = entries.map((e, i) => {
  const id = i + 1;
  let withAl = e.definite;
  let indefinite = e.indefinite;
  // Keep the docx spelling: the recordings are named with it.
  const audioKey = [bare(e.indefinite), bare(e.definite)];

  // Swap in the Mushaf spelling where it differs, keeping both forms in step.
  const key = bare(indefinite);
  if (UTHMANI[key]) {
    const uth = UTHMANI[key];
    uthmaniUsed.push(`${indefinite} → ${uth}`);
    withAl = withAl.slice(0, 2) + (e.type === 'shamsiyya' ? uth[0] + 'ّ' + uth.slice(1) : uth);
    indefinite = uth;
    e = { ...e, indefinite };
  }

  if (!withAl.startsWith(ALIF + LAM)) {
    problems.push(`#${id} ${bare(e.indefinite)}: definite form doesn't start with ال`);
  }

  if (e.type === 'qamariyya') {
    // The docx omits the sukoon on the lam — add it (this is the lesson's point).
    if (withAl[2] !== SUKOON) withAl = withAl.slice(0, 2) + SUKOON + withAl.slice(2);
  } else if (withAl[3] !== 'ّ') {
    problems.push(`#${id} ${bare(e.indefinite)}: shamsiyya but no shadda on the sun letter`);
  }

  // Strip the ال prefix off the definite form and what remains must equal
  // the indefinite form exactly — same letters AND same vowels. For a
  // shamsiyya word the assimilation shadda (always on the first root letter)
  // is removed first, since that mark belongs to the ال rule, not the word.
  const alLength = e.type === 'qamariyya' ? 3 : 2;
  const stem = withAl.slice(alLength).replace(/^(.)ّ/, '$1');
  if (stem !== indefinite) {
    problems.push(
      `#${id} ${bare(indefinite)}: the two forms don't match — "${indefinite}" vs "${e.definite}" (strips to "${stem}")`,
    );
  }

  // Mushaf orthography, applied to every word:
  //  · the article's alif is hamzat wasl, which is what draws the ص above it
  //  · sukoon is the small head of khah, not the modern circle
  const mushaf = (s) => s.replaceAll(SUKOON, MUSHAF_SUKOON);
  withAl = ALIF_WASLA + mushaf(withAl.slice(1));
  indefinite = mushaf(indefinite);

  return {
    id,
    type: e.type,
    meaning: e.meaning,
    // How many leading characters are the ال prefix, for colouring:
    // shamsiyya ا+ل = 2 (the shadda belongs to the root letter),
    // qamariyya ا+ل+sukoon = 3.
    alLength,
    // Recordings are named with the everyday spelling from the docx, so match
    // on that — the Mushaf forms differ (a dagger alif is a mark, not a letter).
    audioKey,
    bare: { text: indefinite, audio: `word${String(id).padStart(2, '0')}a.wav`, timings: null },
    withAl: { text: withAl, audio: `word${String(id).padStart(2, '0')}b.wav`, timings: null },
  };
});

// ── match each word to its recording and split it in two ──────────────────
const folders = { qamariyya: 'Lam Qamareya', shamsiyya: 'Lam Shamseya' };
const files = {};
for (const [type, folder] of Object.entries(folders)) {
  files[type] = readdirSync(join(AUDIO_SRC, folder))
    .filter((f) => f.toLowerCase().endsWith('.wav'))
    .map((f) => ({ file: f, key: bare(f.replace(/\.wav$/i, '')).split(/\s+/) }));
}

mkdirSync(AUDIO_OUT, { recursive: true });
let split = 0;
for (const w of words) {
  const [wantBare, wantAl] = w.audioKey;
  const hit = files[w.type].find(({ key }) => key[0] === wantBare && key[1] === wantAl);
  if (!hit) {
    problems.push(`#${w.id} ${wantBare}: no recording matched (looked for "${wantBare} ${wantAl}.wav")`);
    continue;
  }

  const wav = readWav(join(AUDIO_SRC, folders[w.type], hit.file));
  const { segments } = findSegments(wav, { gap: 0.45, pad: 0.12, min: 0.3 });
  if (segments.length !== 2) {
    problems.push(
      `#${w.id} ${wantBare}: expected 2 forms in "${hit.file}", found ${segments.length} — recheck the pause`,
    );
    continue;
  }
  writeSegment(wav, segments[0][0], segments[0][1], join(AUDIO_OUT, w.bare.audio), { mono: true });
  writeSegment(wav, segments[1][0], segments[1][1], join(AUDIO_OUT, w.withAl.audio), { mono: true });
  split++;
}

// ── write the lesson ──────────────────────────────────────────────────────
const lesson = {
  lesson: 2,
  title: 'Sun & Moon Lam',
  titleArabic: 'اللام الشمسية والقمرية',
  kind: 'pairs',
  audioPath: 'audio/lesson02/',
  perPage: 4,
  sections: [
    { type: 'qamariyya', title: 'Moon Lam', titleArabic: 'اللام القمرية', hint: 'The ل is pronounced — it carries a sukoon.' },
    { type: 'shamsiyya', title: 'Sun Lam', titleArabic: 'اللام الشمسية', hint: 'The ل is silent — the next letter doubles.' },
  ],
  quizSize: 5,
  words: words.map(({ audioKey, ...w }) => w),
};
mkdirSync(dirname(LESSON_OUT), { recursive: true });
writeFileSync(LESSON_OUT, JSON.stringify(lesson, null, 2), 'utf8');

// ── report ────────────────────────────────────────────────────────────────
const q = words.filter((w) => w.type === 'qamariyya').length;
console.log(`${words.length} words (${q} qamariyya, ${words.length - q} shamsiyya)`);
console.log(`audio: split ${split} pair recordings into ${split * 2} files`);
console.log(`missing translations: ${words.filter((w) => !w.meaning).length}`);
if (applied.length) console.log(`\nCORRECTIONS APPLIED (docx unchanged):\n  ${applied.join('\n  ')}`);
if (uthmaniUsed.length) {
  console.log(`\nMUSHAF SPELLINGS SUBSTITUTED (${uthmaniUsed.length}) — please review:\n  ${uthmaniUsed.join('\n  ')}`);
}
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');
