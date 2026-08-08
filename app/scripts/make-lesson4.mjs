/**
 * Builds Lesson 4 — hamzat wasl after وَ and ثُمَّ.
 *
 *   ../Word Tables/لام شمسية وقمرية مع همزة وصل.docx
 *   ../Audio/Audio - 2 Lam shamseya and qamareya/*.wav
 *
 * Each recording holds the SAME word three times: alone, then after وَ, then
 * after ثُمَّ. That is the whole lesson — the ٱ of ٱل is pronounced when the
 * word stands alone and swallowed the moment anything runs into it, while the
 * lam keeps behaving by its own sun/moon rule underneath.
 *
 * Rows the author hasn't recorded yet are simply skipped, so this can be run
 * repeatedly as more arrive.
 *
 * Run:  node scripts/make-lesson4.mjs
 */

import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';
import { addMaddSigns } from './lib/arabic.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'لام شمسية وقمرية مع همزة وصل.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - 2 Lam shamseya and qamareya');
const AUDIO_OUT = join(here, '..', 'public', 'audio', 'lesson04');
const LESSON_OUT = join(here, '..', 'public', 'lessons', 'lesson04', 'words.json');

const SUKOON = 'ْ';
const MUSHAF_SUKOON = 'ۡ';
const ALIF = 'ا';
const ALIF_WASLA = 'ٱ';
const SHADDA = 'ّ';
const MARKS = /[ً-ٰۖ-ۭـ]/g;
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();

// ت ث د ذ ر ز س ش ص ض ط ظ ل ن
const SUN = new Set('تثدذرزسشصضطظلن');

/** Mushaf orthography: hamzat wasl, and the sukoon drawn as a head of khah. */
const mushaf = (s) => addMaddSigns(s.replaceAll(SUKOON, MUSHAF_SUKOON));

/**
 * Where the definite article sits.
 *
 * "ال" also occurs INSIDE words — قَالَتِ has one — so a naive search corrupts
 * the wrong word. An article that follows a space is unambiguous, so prefer
 * that; only fall back to the first occurrence for forms like وَالنَّاسِ, where
 * the article is glued straight onto a prefix letter.
 */
function findArticle(text) {
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === ALIF && text[i + 1] === 'ل' && (i === 0 || /\s/.test(text[i - 1]))) return i;
  }
  return text.indexOf(ALIF + 'ل');
}

/** The letter the article is attached to decides sun or moon. */
function articleLetter(text) {
  const i = findArticle(text);
  if (i === -1) return '';
  return text.slice(i + 2).replace(MARKS, '')[0] ?? '';
}

/** Put the ٱ in, and the lam's sukoon when the lam is actually spoken. */
function definite(text, isSun) {
  // The docx writes the article as plain ا ل; swap in the wasla alif, and for
  // a moon word add the sukoon the source leaves off.
  const idx = findArticle(text);
  if (idx === -1) return mushaf(text);
  const before = text.slice(0, idx);
  let rest = text.slice(idx + 2);
  if (!isSun && rest[0] !== SUKOON && rest[0] !== MUSHAF_SUKOON) rest = SUKOON + rest;
  return mushaf(`${before}${ALIF_WASLA}ل${rest}`);
}

// ── read the docx ─────────────────────────────────────────────────────────
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

// Columns, right to left: [ثم-form, و-form, bare] for qamariyya, then the
// same three for shamsiyya.
const GROUPS = [
  { id: 'shamsiyya', cols: [5, 4, 3], title: 'Sun Lam', titleArabic: 'اللام الشمسية',
    hint: 'The ل stays silent throughout — listen for the ٱ disappearing after وَ and ثُمَّ.' },
  { id: 'qamariyya', cols: [2, 1, 0], title: 'Moon Lam', titleArabic: 'اللام القمرية',
    hint: 'The ل is always spoken; it is the ٱ before it that drops away.' },
];

const problems = [];
const words = [];
const sections = [];
let id = 0;

/**
 * The recordings, in the two shapes the author makes them.
 *
 * `combined` — one take holding the word three times, named "<word> و ثم.wav".
 * `single`   — one take per form, each named after the words actually said in
 *              it: "وسواس.wav", "والوسواس.wav", "ثم الوسواس.wav".
 *
 * They are kept in separate maps on purpose. Folding them together is what
 * broke وسواس: its bare-word file keyed to the same name as a combined take,
 * so a recording of the word said ONCE was being cut into three, and all
 * three forms played fragments of the single utterance.
 *
 * A trailing number is a take number, not part of the word, and the highest
 * take wins — so a re-recording replaces the old one by being named "… 2".
 */
const combined = new Map();
const single = new Map();
for (const f of readdirSync(AUDIO_SRC)) {
  if (!f.toLowerCase().endsWith('.wav')) continue;
  const base = f.replace(/\.wav$/i, '');
  const numbered = /^(.*?)\s+(\d+)$/.exec(base);
  const name = numbered ? numbered[1] : base;
  const take = numbered ? Number(numbered[2]) : 1;

  const bareTag = /\s*و\s*ثم\s*$/;
  const target = bareTag.test(name) ? combined : single;
  const k = key(name.replace(bareTag, ''));
  const prev = target.get(k);
  if (!prev || take > prev.take) target.set(k, { file: f, take });
}

mkdirSync(AUDIO_OUT, { recursive: true });
let written = 0;
const notYet = [];
const used = new Set();

for (const g of GROUPS) {
  sections.push({ id: g.id, title: g.title, titleArabic: g.titleArabic, hint: g.hint });
  for (const cells of rows.slice(2)) {
    const bare = (cells[g.cols[0]] ?? '').trim();
    const wa = (cells[g.cols[1]] ?? '').trim();
    const thumma = (cells[g.cols[2]] ?? '').trim();
    if (!bare || !wa || !thumma) continue;

    const isSun = SUN.has(bare[0]);
    if (isSun !== (g.id === 'shamsiyya')) {
      problems.push(`${key(bare)}: sits under ${g.id} but its first letter says otherwise`);
    }

    // The id belongs to the TABLE ROW, and is spent whether or not the row has
    // been recorded. Numbering only the recorded rows would mean that adding
    // one recording renumbers every word after it — and calibrations are keyed
    // by these numbers, so they would silently describe the wrong words. Ids
    // are therefore sparse while rows are unrecorded, which is harmless: they
    // are keys, not positions.
    id += 1;
    const n = String(id).padStart(2, '0');

    // Three separate takes win over a combined one: nothing has to be guessed
    // about where one form ends and the next begins. Each is trimmed of its
    // own silence exactly as a single-phrase recording is.
    const asSeparate = [key(bare), key(wa), key(thumma)].map((k) => single.get(k)?.file);
    const asCombined = combined.get(key(bare))?.file;

    let cuts;
    let sourceLabel;
    let uneven = false;
    if (asSeparate.every(Boolean)) {
      cuts = asSeparate.map((f) => {
        const wav = readWav(join(AUDIO_SRC, f));
        used.add(f);
        return { wav, span: splitIntoN(wav, 1).segments[0] };
      });
      sourceLabel = 'three takes';
    } else if (asCombined) {
      const wav = readWav(join(AUDIO_SRC, asCombined));
      const { segments, suspicious } = splitIntoN(wav, 3);
      if (segments.length !== 3) {
        problems.push(`${asCombined}: split gave ${segments.length} pieces, expected 3`);
        continue;
      }
      used.add(asCombined);
      uneven = suspicious;
      cuts = segments.map((span) => ({ wav, span }));
      sourceLabel = asCombined;
    } else {
      notYet.push(key(bare));
      continue;
    }

    const texts = [mushaf(bare), definite(wa, isSun), definite(thumma, isSun)];

    // Each form is longer than the one before; anything else is worth a listen.
    const durations = cuts.map(({ wav, span }) => (span[1] - span[0]) / wav.sampleRate);
    if (!(durations[0] < durations[1] && durations[1] < durations[2])) {
      problems.push(`${sourceLabel} (${key(bare)}): lengths not rising — ${durations.map((d) => d.toFixed(2)).join(' / ')}`);
    } else if (uneven) {
      problems.push(`${sourceLabel}: uneven — ${durations.map((d) => d.toFixed(2)).join(' / ')}`);
    }

    const audio = ['a', 'b', 'c'].map((s) => `word${n}${s}.wav`);
    cuts.forEach(({ wav, span }, i) => {
      writeSegment(wav, span[0], span[1], join(AUDIO_OUT, audio[i]), { mono: true });
      written += 1;
    });

    words.push({
      id,
      section: g.id,
      lam: g.id,
      // The ٱ is written in all three but only spoken in the first — and the
      // first has no ٱ at all, being the bare word.
      waslSilentIn: [1, 2],
      badges: [g.id === 'shamsiyya' ? 'Sun ش' : 'Moon ق'],
      forms: texts.map((text, i) => ({ text, audio: audio[i], timings: null })),
    });
  }
}

// ── the three ayah phrases: two sukoons meeting before hamzat wasl ───────
// Each is one recording of one phrase. The ٱ is silent (a word runs into
// it) and the letter before it has taken a kasra so two sukoons do not
// collide — which is the whole point of the section.
const PHRASES = { id: 'saakin', title: 'Two Sukoons Meeting', titleArabic: 'التخلص من التقاء الساكنين',
  hint: 'The last letter of the first word is normally saakin. Before ٱل it takes a kasra instead, because Arabic will not let two silent letters meet — and the ٱ itself drops away.' };

// Row 38 is the section's own heading, not a phrase.
const phraseRows = rows.slice(39).map((c) => (c[0] ?? '').trim()).filter(Boolean);
if (phraseRows.length) {
  sections.push({ id: PHRASES.id, title: PHRASES.title, titleArabic: PHRASES.titleArabic, hint: PHRASES.hint });
  for (const raw of phraseRows) {
    // Same rule as above: the row owns the id, recorded or not.
    id += 1;
    const n = String(id).padStart(2, '0');
    const file = single.get(key(raw))?.file;
    if (!file) { notYet.push(key(raw)); continue; }
    used.add(file);
    // Sun or moon is decided by the letter right after the article.
    const isSun = SUN.has(articleLetter(raw));
    const wav = readWav(join(AUDIO_SRC, file));
    const { segments } = splitIntoN(wav, 1);
    const audio = `word${n}a.wav`;
    writeSegment(wav, segments[0][0], segments[0][1], join(AUDIO_OUT, audio), { mono: true });
    written += 1;
    words.push({
      id,
      section: PHRASES.id,
      lam: isSun ? 'shamsiyya' : 'qamariyya',
      waslSilentIn: [0],
      badges: [isSun ? 'Sun ش' : 'Moon ق'],
      forms: [{ text: definite(raw, isSun), audio, timings: null }],
    });
  }
}

// ── write the lesson ──────────────────────────────────────────────────────
const lesson = {
  lesson: 4,
  title: 'Hamzat Wasl after وَ and ثُمَّ',
  titleArabic: 'همزة الوصل بعد الواو وثم',
  kind: 'letters',
  audioPath: 'audio/lesson04/',
  perPage: 3,
  formLabels: ['alone', 'after وَ', 'after ثُمَّ'],
  sections,
  words,
};
mkdirSync(dirname(LESSON_OUT), { recursive: true });
writeFileSync(LESSON_OUT, JSON.stringify(lesson, null, 2), 'utf8');

console.log(`${words.length} words recorded, ${written} clips written`);
for (const s of sections) {
  console.log(`  ${s.id.padEnd(11)} ${words.filter((w) => w.section === s.id).length}`);
}
if (notYet.length) console.log(`\nnot recorded yet (${notYet.length}): ${notYet.join('، ')}`);

// A recording nothing uses is a misnamed file or a word that isn't in the
// table. Either way the author recorded something that will never play.
const unused = readdirSync(AUDIO_SRC)
  .filter((f) => f.toLowerCase().endsWith('.wav') && !used.has(f))
  .map((f) => f.replace(/\.wav$/i, ''));
if (unused.length) {
  problems.push(`${unused.length} recording(s) match no row: ${unused.join('، ')}`);
}

// Clips left over from a previous run — a word that was renumbered or dropped.
// They are dead weight in the offline precache, so say so rather than let them
// ride along unnoticed. Listed, not deleted: the author confirms removals.
const referenced = new Set(words.flatMap((w) => w.forms.map((f) => f.audio)));
const orphanClips = readdirSync(AUDIO_OUT).filter(
  (f) => f.toLowerCase().endsWith('.wav') && !referenced.has(f),
);
if (orphanClips.length) {
  problems.push(
    `${orphanClips.length} generated clip(s) no longer referenced — safe to delete: ${orphanClips.join(', ')}`,
  );
}

console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');
