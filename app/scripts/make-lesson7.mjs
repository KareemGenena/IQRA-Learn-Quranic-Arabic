/**
 * Builds Lesson 7 — the rules of nūn sākinah and tanwīn, and of mīm sākinah.
 *
 *   ../Word Tables/ميم نون ساكنة وتنوين.docx
 *   ../Audio/Audio - Meem Noon Sakinah Tanween/*.wav
 *
 * The docx is five headed tables. The mīm sākinah table comes first (the
 * author's order: iqlāb turns a nūn into a mīm, so the mīm rules are needed
 * before it) and has one Example column; the four nūn tables have TWO example
 * columns, Nūn Sākinah and Tanwīn, so every row there becomes two cards. The
 * idghām table carries two sub-heading rows (with ghunna / without) and is
 * split into two sections on them.
 *
 * The one piece of text the sheet cannot carry is the shape of the tanwīn.
 * The Mushaf writes it two ways: STACKED (مُتَرَاكِب ــٌ) before the throat
 * letters, where it is read in full, and STAGGERED (مُتَتَابِع ــٌۨ, U+08F0–08F2)
 * before the letters of idghām and ikhfāʾ, where the nūn hides or merges. The
 * author's Word font has no glyph for the staggered form, so the sheet holds
 * plain marks throughout and `openTanween()` writes the staggered form here,
 * by the same rule the timing engine uses to decide the hum — the app's font
 * (checked 2026-09-26) draws U+08F0–08F2 as proper attached marks. Before ب
 * the Mushaf uses a small mīm instead, and the sheet already writes that.
 *
 * Ids belong to example CELLS in reading order, and are spent whether or not
 * the cell is recorded — the one em-dash cell (tanwīn + ظ) spends its id and
 * makes no card.
 *
 * Run:  node scripts/make-lesson7.mjs
 */

import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';
import { addMaddSigns, normaliseZeros } from './lib/arabic.mjs';
import { letterAfter } from './lib/mushaf.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'ميم نون ساكنة وتنوين.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - Meem Noon Sakinah Tanween');
const AUDIO_OUT = join(here, '..', 'public', 'audio', 'lesson07');
const LESSON_OUT = join(here, '..', 'public', 'lessons', 'lesson07', 'words.json');

/**
 * Each table, found by the Arabic heading above it (any paragraph between the
 * previous table and this one), and the section it becomes. `ghunna` says
 * whether the rule hums, which is a badge here and a weight in timing.ts.
 */
const SECTIONS = [
  {
    match: /^أحكام الميم/,
    id: 'meem-sakinah',
    title: 'Mīm Sākinah',
    titleArabic: 'أحكام الميم الساكنة',
    hint: 'Before another mīm it merges, with ghunna (idghām shafawī); before ب it is hidden, with ghunna (ikhfāʾ shafawī); before every other letter it is said clearly (iẕhār shafawī).',
    ruleFromCell: true,
  },
  {
    match: /الإظهار الحلقي/,
    id: 'izhar',
    title: 'Nūn Sākinah and Tanwīn — Iẕhār Ḥalqī',
    titleArabic: 'النون الساكنة والتنوين — الإظهار الحلقي',
    hint: 'Before the six throat letters — ء ه ع ح غ خ — the nūn sākinah or tanwīn is said clearly, with no ghunna. The tanwīn is written stacked.',
    rule: 'Iẕhār',
    ghunna: false,
    tanwin: 'Mutarākib',
  },
  {
    match: /–\s*الإدغام\s*$/,
    id: 'idgham',
    title: 'Nūn Sākinah and Tanwīn — Idghām',
    titleArabic: 'النون الساكنة والتنوين — الإدغام',
    hint: 'Before the six letters of يرملون the nūn sākinah or tanwīn merges into the next letter, which takes a shadda. With ي ن م و the merge keeps its ghunna; with ل ر it has none. The tanwīn is written staggered.',
    rule: 'Idghām',
    tanwin: 'Mutatābiʿ',
    /** The table's own sub-heading rows split it into two sections. */
    split: [
      { when: /بغنة|with ghunna/i, id: 'idgham-ghunnah', title: 'Nūn Sākinah and Tanwīn — Idghām with Ghunna', titleArabic: 'النون الساكنة والتنوين — الإدغام بغنة', rule: 'Idghām with Ghunna', ghunna: true, hint: 'Before ي ن م و the nūn or tanwīn merges into the next letter and the ghunna stays, on the merged letter.' },
      { when: /بغير غنة|without ghunna/i, id: 'idgham-no-ghunnah', title: 'Nūn Sākinah and Tanwīn — Idghām without Ghunna', titleArabic: 'النون الساكنة والتنوين — الإدغام بغير غنة', rule: 'Idghām without Ghunna', ghunna: false, hint: 'Before ل and ر the nūn or tanwīn merges completely — a doubled letter with no ghunna at all.' },
    ],
  },
  {
    match: /الإخفاء الحقيقي/,
    id: 'ikhfa',
    title: 'Nūn Sākinah and Tanwīn — Ikhfāʾ Ḥaqīqī',
    titleArabic: 'النون الساكنة والتنوين — الإخفاء الحقيقي',
    hint: 'Before the fifteen remaining letters the nūn is hidden: the tongue does not touch, and only the ghunna is heard while the mouth shapes the next letter. The ghunna is heavy before ص ض ط ق ظ and light before the rest. The tanwīn is written staggered.',
    rule: 'Ikhfāʾ',
    ghunna: true,
    tanwin: 'Mutatābiʿ',
    /** The sheet prints the mnemonic under the heading; carry it into the hint. */
    mnemonic: /صِفۡ ذَا/,
  },
  {
    match: /–\s*الإقلاب\s*$/,
    id: 'iqlab',
    title: 'Nūn Sākinah and Tanwīn — Iqlāb',
    titleArabic: 'النون الساكنة والتنوين — الإقلاب',
    hint: 'Before ب the nūn sākinah or tanwīn turns into a hidden mīm, with ghunna. The Mushaf writes a small mīm in place of the sukoon, and the tanwīn gives up one of its two marks for it.',
    rule: 'Iqlāb',
    ghunna: true,
  },
];

/** The mīm table names its rule per row. */
const MEEM_RULES = [
  [/idgh/i, { rule: 'Idghām Shafawī', ghunna: true }],
  [/ikhf/i, { rule: 'Ikhfāʾ Shafawī', ghunna: true }],
  [/i[zẕ]h/i, { rule: 'Iẕhār Shafawī', ghunna: false }],
];

const applied = [];
const correct = (s) => s;

// ── marks and the two tanwīn shapes ───────────────────────────────────────
/** Diacritics, Quranic annotation marks, the staggered tanwīn and tatweel. */
const MARKS = /[ً-ٰۖ-ۭـࣰ-ࣲ]/g;
const MARK_ONE = /[ً-ٰۖ-ۭـࣰ-ࣲ]/;
const SHADDA = 'ّ';
const RECT_ZERO = '۠';
const SMALL_MEEM = /[ۭۢ]/;
/** The heavy (mufakhkham) letters among those of ikhfāʾ: the ghunna before them is heavy. */
const HEAVY = /[صضطقظ]/;
/** Stacked tanwīn → its staggered twin. */
const STAGGERED = { 'ً': 'ࣰ', 'ٌ': 'ࣱ', 'ٍ': 'ࣲ' };
const IZHAR = new Set('ءأإآهعحغخ');
const BAA = 'ب';
const ALIF_WASLA = 'ٱ';

const conversions = [];
const finals = [];
/** The tanwīn's vowel half, for the iqlāb form (vowel + small mīm). */
const VOWEL_OF = { 'ً': 'َ', 'ٌ': 'ُ', 'ٍ': 'ِ' };
const SMALL_HIGH_MEEM = 'ۢ';

/** The shape a tanwīn takes before `next`: 'stacked' | 'staggered' | 'meem'. */
function shapeBefore(next) {
  if (!next || IZHAR.has(next)) return 'stacked';
  if (next === BAA) return 'meem';
  return 'staggered';
}

/** Rewrite the stacked tanwīn at chars[i] into `shape`. */
function reshape(chars, i, shape) {
  if (shape === 'staggered') chars[i] = STAGGERED[chars[i]];
  else if (shape === 'meem') chars[i] = VOWEL_OF[chars[i]] + SMALL_HIGH_MEEM;
}

/**
 * Write every tanwīn the way the Mushaf does: stacked before a throat letter
 * (read in full), staggered before a letter of idghām or ikhfāʾ (the nūn hides
 * or merges), a vowel plus small mīm before ب (iqlāb). Inside the card the
 * next letter is in the text; for the card's LAST word it is read from the
 * Mushaf (`letterAfter`), because the Mushaf writes the shape for the word
 * that follows in the āyah even though the recording stops here — the app
 * then grays that final mark (`unreadFinalNasal`). The sheet already writes
 * the small mīm before ب inside a card; a plain tanwīn there is reported.
 */
function shapeTanween(text, where, sura, aya) {
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    if (!STAGGERED[chars[i]]) continue;
    // The next letter that is actually read: past marks, the tanwīn-fatḥ alif
    // or yeh, spaces, and a silent hamzat wasl.
    let j = i + 1;
    while (j < chars.length && (MARK_ONE.test(chars[j]) || chars[j] === 'ا' || chars[j] === 'ى' || chars[j] === ' ')) j++;
    if (j < chars.length && chars[j] === ALIF_WASLA) j++;
    let next = chars[j];
    if (!next) {
      // The card ends here: ask the Mushaf what follows.
      if (!sura) {
        finals.push(`${where}: no location — left stacked`);
        continue;
      }
      const r = letterAfter(text, sura, aya);
      if (!r.letter) {
        finals.push(`${where}: ${r.why} — left stacked`);
        problems.push(`${where}: could not read the next word in the Mushaf (${r.why})`);
        continue;
      }
      next = r.letter;
      const shape = shapeBefore(next);
      const note = r.corrected ? ` [SHEET SAYS ${r.cited} — the phrase is at ${r.corrected}]` : '';
      if (r.corrected) problems.push(`${where}: the sheet cites ${r.cited}; the phrase is at ${r.corrected} — the meaning cell needs correcting`);
      finals.push(`${where}: next word ${r.next} (${r.where})${note} → ${shape}`);
      reshape(chars, i, shape);
      continue;
    }
    const shape = shapeBefore(next);
    if (shape === 'meem') {
      problems.push(`${where}: a plain tanwīn before ب — the Mushaf writes a small mīm there`);
      continue;
    }
    if (shape === 'staggered') {
      reshape(chars, i, shape);
      conversions.push(`${where} → staggered before ${next}`);
    }
  }
  return chars.join('');
}

/**
 * The low small mīm (iqlāb after a kasra). Unicode has U+06ED for it and the
 * sheet writes that; this app's font draws U+06ED as an unattached placeholder
 * and forms the real low mīm from kasra + U+06E2 (its `liga` afii57456_uni06E2).
 * The font is the authority: the app carries the font's spelling.
 */
const lowMeem = (s) => s.replace(/ۭ/g, SMALL_HIGH_MEEM);

// ── badges read off the text ──────────────────────────────────────────────
/**
 * The article's lam, read off the text — as ٱل, or without its alif after the
 * preposition لِ (لِّلنَّاسِ, لِّلۡمُتَّقِينَ). Same test derivedSilent() makes in
 * the app, so the chip and the graying always agree.
 */
function lamBadge(text) {
  if (/ٱلۡ/.test(text) || /(^|\s)ل[ً-ٰۖ-ۭ]*لۡ/.test(text)) return 'Moon ل';
  if (/ٱل[^\sً-ْٰ]?[ً-ِ]?ّ/.test(text) || /(^|\s)ل[ً-ٰۖ-ۭ]*ل[^\sً-ٰۖ-ۭ][ً-ٰۖ-ۭ]*ّ/.test(text)) return 'Sun ل';
  return null;
}
const MUTTASIL_RE = /(?:آ|ٓ)[ً-ٰۖ-ۭـ]*[ءأؤئ]/;
const muttasilBadge = (text) => (text.split(/\s+/).some((w) => MUTTASIL_RE.test(w)) ? 'Madd Muttasil' : null);

// ── read the docx in document order ───────────────────────────────────────
const xml = readZipEntry(DOCX, 'word/document.xml').toString('utf8');
const body = xml.split('<w:body>')[1];
const text = (s) => {
  let t = '';
  for (const m of s.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) t += m[1];
  return t.replace(/&amp;/g, '&').trim();
};

const blocks = [];
let paras = [];
for (const m of body.matchAll(/<w:p[ >][\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>/g)) {
  const chunk = m[0];
  if (!chunk.startsWith('<w:tbl>')) {
    const t = text(chunk);
    if (t) paras.push(t);
    continue;
  }
  const rows = chunk
    .split(/<w:tr[ >]/)
    .slice(1)
    .map((r) => r.split('</w:tr>')[0].split(/<w:tc[ >]/).slice(1).map((c) => text(c.split('</w:tc>')[0])));
  blocks.push({ paras, rows });
  paras = [];
}

const problems = [];
const words = [];
const sections = [];
let id = 0;

/** Uthmani text: corrections, the madd sign by rule, then the tanwīn shape by rule. */
const clean = (s, where, sura, aya) => shapeTanween(lowMeem(addMaddSigns(normaliseZeros(correct(s.trim())))), where, sura, aya);
/** "al-Baqarah 2:249" → [2, 249]; the LAST such pair in a meaning cell. */
function locationOf(meaning) {
  const all = [...(meaning ?? '').matchAll(/(\d+):(\d+)/g)];
  const m = all[all.length - 1];
  return m ? [Number(m[1]), Number(m[2])] : [null, null];
}
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();

function columns(header) {
  const find = (re) => header.findIndex((h) => re.test(h));
  return {
    rule: find(/^rule/i),
    letter: find(/^letter/i),
    example: find(/^example/i),
    noon: find(/n[ūu]n/i),
    tanwin: find(/tanw/i),
    meaning: find(/meaning/i),
  };
}

for (const block of blocks) {
  const def = SECTIONS.find((s) => block.paras.some((p) => s.match.test(p)));
  if (!def) {
    problems.push(`table under "${block.paras.join(' / ')}" matches no known section — skipped`);
    continue;
  }
  const col = columns(block.rows[0]);
  /** The example columns of this table, each with the form it teaches. */
  const examples = col.example >= 0
    ? [{ col: col.example, form: null }]
    : [{ col: col.noon, form: 'Nūn Sākinah' }, { col: col.tanwin, form: 'Tanwīn' }].filter((e) => e.col >= 0);
  if (!examples.length) {
    problems.push(`"${def.title}": no example column in header [${block.rows[0].join(' | ')}]`);
    continue;
  }

  let section = def.split ? null : def;
  const mnemonic = def.mnemonic ? block.paras.find((p) => def.mnemonic.test(p)) : null;
  const pushSection = (s) => {
    if (sections.some((x) => x.id === s.id)) return;
    sections.push({ id: s.id, title: s.title, titleArabic: s.titleArabic, hint: mnemonic ? `${s.hint} ${mnemonic}` : s.hint });
  };
  if (section) pushSection(section);

  for (const cells of block.rows.slice(1)) {
    // A sub-heading row (idghām with / without ghunna) opens a new section.
    if (def.split) {
      const sub = def.split.find((s) => s.when.test(cells[0] ?? ''));
      if (sub) {
        section = { ...def, ...sub };
        pushSection(section);
        continue;
      }
      if (!section) {
        problems.push(`"${def.title}": a row before the first sub-heading — skipped: ${cells.join(' | ')}`);
        continue;
      }
    }
    const letter = col.letter >= 0 ? (cells[col.letter] ?? '').trim() : '';
    const meanings = col.meaning >= 0 ? (cells[col.meaning] ?? '').split(/\s+\|\s+/).map((s) => s.trim()) : [];
    let ruleInfo = { rule: section.rule, ghunna: section.ghunna };
    if (def.ruleFromCell) {
      const cell = cells[col.rule] ?? '';
      const hit = MEEM_RULES.find(([re]) => re.test(cell));
      if (!hit) problems.push(`"${def.title}": rule cell "${cell}" not recognized`);
      else ruleInfo = hit[1];
    }

    examples.forEach((ex, k) => {
      const raw = (cells[ex.col] ?? '').trim();
      // The id belongs to the cell, recorded or not.
      id += 1;
      if (!raw || !/[ء-ي]/.test(raw)) {
        if (raw) problems.push(`#${id} (${section.title}, ${letter}, ${ex.form ?? 'example'}): no example in the sheet ("${raw}") — id spent, no card`);
        return;
      }
      const where = `#${id} ${raw}`;
      const meaning = meanings[k] ?? meanings[0];
      const [sura, aya] = locationOf(meaning);
      const cleaned = clean(raw, where, sura, aya);
      const badges = [ruleInfo.rule];
      if (letter) badges.push(letter);
      // The form once: a tanwīn's shape badge already says "Tanwīn" (the
      // author struck the bare one beside it, 2026-10-03).
      if (ex.form === 'Tanwīn' && section.tanwin) badges.push(`Tanwīn ${section.tanwin}`);
      else if (ex.form) badges.push(ex.form);
      // Ghunna: not beside a rule badge that already says it (Idghām with
      // Ghunna); in ikhfāʾ it takes the weight of the letter it hides before —
      // heavy before ص ض ط ق ظ, light before the rest.
      if (ruleInfo.ghunna && section.id !== 'idgham-ghunnah') {
        badges.push(section.id === 'ikhfa' ? (HEAVY.test(letter ?? '') ? 'Heavy Ghunna' : 'Light Ghunna') : 'Ghunna');
      }
      const lam = lamBadge(cleaned);
      if (lam) badges.push(lam);
      const muttasil = muttasilBadge(cleaned);
      if (muttasil) badges.push(muttasil);
      // A small mīm READ inside the card — not the grayed one the Mushaf puts
      // on the card's last word for the ب that follows it.
      const inside = cleaned.replace(/[َُِ]ۢا?$/, '');
      if (SMALL_MEEM.test(inside) && section.id !== 'iqlab') badges.push('Iqlāb');
      if (cleaned.includes(RECT_ZERO)) badges.push('Conditional silent alif');

      const entry = { id, section: section.id, text: cleaned, audio: `word${String(id).padStart(3, '0')}.wav`, timings: null, badges };
      if (meaning) entry.meaning = meaning;
      words.push(entry);
    });
  }
}

// ── cut the audio ─────────────────────────────────────────────────────────
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
  lesson: 7,
  title: 'Nūn Sākinah, Tanwīn and Mīm Sākinah',
  titleArabic: 'أحكام النون الساكنة والتنوين والميم الساكنة',
  kind: 'letters',
  audioPath: 'audio/lesson07/',
  // Two-word phrases throughout: three to a page keeps them readable.
  perPage: 3,
  meaningSource: 'Sahih International',
  sections,
  words,
};
mkdirSync(dirname(LESSON_OUT), { recursive: true });
writeFileSync(LESSON_OUT, JSON.stringify(lesson, null, 2), 'utf8');

console.log(`${words.length} cards across ${sections.length} sections (ids 1–${id})`);
for (const s of sections) {
  console.log(`  ${s.id.padEnd(18)} ${String(words.filter((w) => w.section === s.id).length).padStart(3)} cards`);
}
console.log(`tanwīn written staggered inside ${conversions.length} cards`);
console.log(`\nFINAL TANWĪN — the shape the Mushaf gives the card's last word, from the word after it (review these):\n  ${finals.join('\n  ')}`);
console.log(`audio: wrote ${written} clips`);
if (applied.length) console.log(`\nCORRECTIONS APPLIED (docx unchanged):\n  ${applied.join('\n  ')}`);
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');
