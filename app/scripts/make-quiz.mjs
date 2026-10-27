/**
 * Quiz me — the question book's bank (Design/drills.md).
 *
 *   node scripts/make-quiz.mjs
 *
 * Draws on the Level 1 lessons that already have their clips — 30 (each
 * letter's name), 21 (harakat and tanween), 22 (natural madd), 23 (shadda) —
 * and keeps every form whose clip is on disk. Two Word sheets belong to the
 * author:
 *
 *   Word Tables/Quiz Prompts.docx       Slot · Say this — the spoken
 *       instructions. Record one take per row with the intake tool into
 *       `Audio/Audio - Quiz/`; the on-screen instruction is the same line.
 *   Word Tables/Quiz Sound-alikes.docx   letters a learner confuses by ear,
 *       one group per row — the wrong choice of "Which letter?". Not
 *       recorded: the clips are lesson 21's.
 *
 * Each sheet is written once from the defaults below when it does not exist
 * and never overwritten; delete it to have it written afresh.
 *
 * Writes `public/quiz/quiz.json` and cuts each prompt take, trimmed to one
 * piece like every other take (splitIntoN), into `public/audio/quiz/`. Re-run
 * after any Level 1 lesson is re-cut or re-recorded: the bank carries each
 * clip's hash (`rev`), so a retake reaches every device as a new URL.
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getEntry, readDocx, setEntry, text as entryText, writeDocx } from '../../Workbooks/build/docx.mjs';
import { readZipEntry } from './lib/zip.mjs';
import { ROOT, textOf } from './lib/workbook.mjs';
import { key } from './lib/takes.mjs';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PUB = join(here, '..', 'public');
const SHEETS = join(ROOT, 'Word Tables');
const TEMPLATE = join(SHEETS, 'كلمات.docx');
const PROMPTS_SHEET = join(SHEETS, 'Quiz Prompts.docx');
const ALIKES_SHEET = join(SHEETS, 'Quiz Sound-alikes.docx');
const AUDIO_SRC = join(ROOT, 'Audio', 'Audio - Quiz');
const AUDIO_OUT = join(PUB, 'audio', 'quiz');
const FONT = 'KFGQPC HAFS Uthmanic Script'; // the author's Word font (CLAUDE.md §4)

const problems = [];

// ── defaults, used only to write a missing sheet ──────────────────────────
/** One line per kind of question, plus the review round and the end. The
 *  wording rules hold: haraka, never "vowel"; Fat-ha; US spelling. */
const PROMPTS = [
  ['quiz-name', 'Listen to the name. Which letter is it?'],
  ['quiz-lookalike', 'These letters look alike. Tap the one you hear.'],
  ['quiz-hunt', 'Find this letter. Tap every one you see.'],
  ['quiz-which-letter', 'Which letter did you hear?'],
  ['quiz-same-different', 'Listen to two sounds. Are they the same, or different?'],
  ['quiz-which-haraka', 'Which haraka did you hear?'],
  ['quiz-tanween', 'Did you hear tanween, or not?'],
  ['quiz-which-tanween', 'Which tanween did you hear?'],
  ['quiz-short-long', 'Was it short, or long?'],
  ['quiz-which-madd', 'Which madd did you hear?'],
  ['quiz-shadda', 'Did you hear a shadda, or not?'],
  ['quiz-review', "Let's try the ones you missed."],
  ['quiz-done', 'All done. Well done!'],
];
/** A starting point for the author to correct (Design/drills.md §6). */
const SOUND_ALIKES = ['ح ه', 'ع ء', 'س ص', 'ت ط', 'ذ ز ظ', 'ث س', 'ق ك', 'د ض'];

// ── the sheets ────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const para = (txt) =>
  `<w:p><w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(txt)}</w:t></w:r></w:p>`;

/** A sheet of one table, from the template every generated sheet uses —
 *  the same page setup and styles as the lessons' sheets. */
function writeSheet(path, note, widths, header, rows, arabicCols) {
  const cell = (txt, i, arabic) => {
    const sz = arabic ? 42 : 24;
    const rpr = `<w:rPr>${arabic ? `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${arabic ? '<w:rtl/>' : ''}<w:lang w:bidi="ar-EG"/></w:rPr>`;
    return (
      `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
      `<w:p><w:pPr>${arabic ? '<w:bidi/>' : ''}<w:jc w:val="${arabic ? 'center' : 'left'}"/>${rpr}</w:pPr>` +
      (txt ? `<w:r>${rpr}<w:t xml:space="preserve">${esc(txt)}</w:t></w:r>` : '') +
      `</w:p></w:tc>`
    );
  };
  const row = (cells, head) =>
    `<w:tr><w:trPr><w:trHeight w:val="560"/></w:trPr>${cells.map((c, i) => cell(c, i, !head && arabicCols.includes(i))).join('')}</w:tr>`;
  const entries = readDocx(TEMPLATE);
  const xml = entryText(getEntry(entries, 'word/document.xml'));
  const a = xml.indexOf('<w:tbl>');
  const b = xml.indexOf('</w:tbl>') + '</w:tbl>'.length;
  const table =
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${widths.reduce((s, w) => s + w, 0)}" w:type="dxa"/>` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    row(header, true) +
    rows.map((r) => row(r, false)).join('') +
    `</w:tbl>`;
  setEntry(entries, 'word/document.xml', xml.slice(0, a) + note.map(para).join('') + table + xml.slice(b));
  writeDocx(path, entries);
}

/** The sheet's rows below its header, each a list of cell texts. */
function readSheet(path) {
  const xml = readZipEntry(path, 'word/document.xml').toString('utf8');
  const tbl = xml.slice(xml.indexOf('<w:tbl>'), xml.indexOf('</w:tbl>'));
  const rows = [...tbl.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((r) =>
    [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => textOf(c[0]).normalize('NFC').trim()),
  );
  return rows.slice(1);
}

if (!existsSync(PROMPTS_SHEET)) {
  writeSheet(
    PROMPTS_SHEET,
    [
      'Quiz me — the spoken instructions (Design/drills.md). Written by scripts/make-quiz.mjs; yours from now on, and never overwritten.',
      'Open this sheet in the audio intake: it records the Slot column, one take per row, into Audio/Audio - Quiz/. Say the line in the second column. ' +
        'The quiz also shows that line on the screen, so edit a line here and re-run node scripts/make-quiz.mjs to change both. Keep the Slot names as they are.',
    ],
    [2600, 7140],
    ['Slot', 'Say this'],
    PROMPTS,
    [],
  );
  console.log(`wrote ${PROMPTS_SHEET}`);
}
if (!existsSync(ALIKES_SHEET)) {
  writeSheet(
    ALIKES_SHEET,
    [
      'Quiz me — letters that sound alike (Design/drills.md). Written by scripts/make-quiz.mjs; yours from now on, and never overwritten.',
      'One group per row: letters a learner confuses by ear. "Which letter did you hear?" offers one of them as the wrong choice, and "Same or different?" plays them side by side. ' +
        'Add, remove or change rows, then re-run node scripts/make-quiz.mjs. Nothing here is recorded — the quiz plays the lesson 21 clips.',
    ],
    [4200, 5540],
    ['Letters that sound alike', 'Note'],
    SOUND_ALIKES.map((g) => [g, '']),
    [0],
  );
  console.log(`wrote ${ALIKES_SHEET}`);
}

// ── the lessons it draws on ───────────────────────────────────────────────
const load = (n) => JSON.parse(readFileSync(join(PUB, 'lessons', `lesson${String(n).padStart(2, '0')}`, 'words.json'), 'utf8'));
const L21 = load(21);
const L22 = load(22);
const L23 = load(23);
const L30 = load(30);
const L20 = load(20);

const onDisk = (lesson, file) => !!file && existsSync(join(PUB, 'audio', `lesson${String(lesson).padStart(2, '0')}`, file));
/** A clip as the quiz carries it: the text said, and where to find it. */
const clip = (lesson, text, file, rev) => ({ text, lesson, file, ...(rev ? { rev } : {}) });

/** The bare letter: marks and tatweel off; the seated hamza and the dotted
 *  yeh of lesson 22 fold to the letter they stand for (matching only — the
 *  text shown is always the lesson's own). */
const MARKS = /[ً-ٰۖ-ۭـࣰ-ࣲ]/g;
const FOLD = { 'أ': 'ء', 'إ': 'ء', 'ي': 'ى' }; // أ إ → ء, ي → ى
const bare = (s) => {
  const ch = [...s.replace(MARKS, '').replace(/\s+/g, '')][0] ?? '';
  return FOLD[ch] ?? ch;
};

/** Lesson 21's and 22's six forms, in the order the questions assume. */
const TANWEEN_LABELS = ['Fat-ha', 'Tanween Fath', 'Damma', 'Tanween Damm', 'Kasra', 'Tanween Kasr'];
const MADD_LABELS = ['Fat-ha', 'Madd Alif', 'Damma', 'Madd Waaw', 'Kasra', 'Madd Yaa'];
const sameLabels = (a, b) => a?.length === b.length && a.every((x, i) => x === b[i]);

// lesson 21 by letter
const formsOf = new Map();
for (const w of L21.words) {
  const labels = w.formLabels ?? L21.formLabels;
  if (!sameLabels(labels, TANWEEN_LABELS) || w.forms?.length !== 6) {
    problems.push(`lesson 21 card ${w.id}: its forms are not Fat-ha, Tanween Fath, … Tanween Kasr — left out`);
    continue;
  }
  if (!w.forms.every((f) => onDisk(21, f.audio))) {
    problems.push(`lesson 21 card ${w.id} (${w.forms[0].text}): a clip is missing — left out`);
    continue;
  }
  formsOf.set(bare(w.forms[0].text), w.forms.map((f) => clip(21, f.text, f.audio, f.audioRev)));
}

// the letters, in lesson 30's order: the glyph as taught, its shape family
// (lesson 20's), its name clip (lesson 30's) and lesson 21's six forms
const familyOf = new Map(L20.words.map((w) => [bare(w.letter), w.family]));
const letters = [];
for (const w of L30.words) {
  const b = bare(w.letter);
  const entry = { letter: w.letter, base: b, family: familyOf.get(b) ?? w.family ?? 0 };
  if (onDisk(30, w.audio)) entry.name = clip(30, w.text, w.audio, w.audioRev);
  else problems.push(`lesson 30 #${w.id} ${w.letter}: no name clip — left out of the name questions`);
  if (formsOf.has(b)) entry.forms = formsOf.get(b);
  letters.push(entry);
}
for (const b of formsOf.keys()) {
  if (!letters.some((l) => l.base === b)) problems.push(`lesson 21's ${b} is not one of lesson 30's letters — its forms are unused`);
}

// lesson 22: six forms a card
const madd = [];
for (const w of L22.words) {
  const labels = w.formLabels ?? L22.formLabels;
  if (!sameLabels(labels, MADD_LABELS) || w.forms?.length !== 6) {
    problems.push(`lesson 22 card ${w.id}: its forms are not Fat-ha, Madd Alif, … Madd Yaa — left out`);
    continue;
  }
  if (!w.forms.every((f) => onDisk(22, f.audio))) {
    problems.push(`lesson 22 card ${w.id} (${w.forms[0].text}): a clip is missing — left out`);
    continue;
  }
  madd.push(w.forms.map((f) => clip(22, f.text, f.audio, f.audioRev)));
}

// lesson 23: a plain form and its shadda
const SHADDA = 'ّ';
const shadda = [];
for (const w of L23.words) {
  const [plain, doubled] = w.forms ?? [];
  if (!plain || !doubled || plain.text.includes(SHADDA) || !doubled.text.includes(SHADDA)) {
    problems.push(`lesson 23 card ${w.id}: not a plain form and its shadda — left out`);
    continue;
  }
  if (!onDisk(23, plain.audio) || !onDisk(23, doubled.audio)) {
    problems.push(`lesson 23 card ${w.id} (${plain.text}): a clip is missing — left out`);
    continue;
  }
  shadda.push([clip(23, plain.text, plain.audio, plain.audioRev), clip(23, doubled.text, doubled.audio, doubled.audioRev)]);
}

// ── the sound-alikes ──────────────────────────────────────────────────────
const known = new Set(letters.map((l) => l.base));
const soundAlikes = [];
for (const [g] of readSheet(ALIKES_SHEET)) {
  if (!g) continue;
  const group = [...new Set(g.split(/[\s،,/]+/).map(bare).filter(Boolean))];
  const unknown = group.filter((b) => !known.has(b));
  if (unknown.length) problems.push(`sound-alikes "${g}": ${unknown.join(' ')} is not a letter of lesson 30 — left out`);
  const kept = group.filter((b) => known.has(b));
  if (kept.length >= 2) soundAlikes.push(kept);
  else if (group.length) problems.push(`sound-alikes "${g}": fewer than two letters — ignored`);
}

// ── the prompts, and their takes ──────────────────────────────────────────
const takes = new Map(); // slot -> { file, take }
if (existsSync(AUDIO_SRC)) {
  for (const f of readdirSync(AUDIO_SRC)) {
    if (!f.toLowerCase().endsWith('.wav')) continue;
    const base = f.replace(/\.wav$/i, '');
    const numbered = /^(.*?)\s+(\d+)$/.exec(base);
    const k = key(numbered ? numbered[1] : base);
    const take = numbered ? Number(numbered[2]) : 1;
    const prev = takes.get(k);
    if (!prev || take > prev.take) takes.set(k, { file: f, take });
  }
}

const prompts = {};
const used = new Set();
const unrecorded = [];
for (const [slot, line] of readSheet(PROMPTS_SHEET)) {
  if (!slot) continue;
  const entry = { line: line ?? '' };
  const t = takes.get(key(slot));
  if (t) {
    used.add(t.file);
    mkdirSync(AUDIO_OUT, { recursive: true });
    const wav = readWav(join(AUDIO_SRC, t.file));
    // One piece, the record click and the stop click trimmed, as every take.
    const { segments } = splitIntoN(wav, 1);
    const [from, to] = segments[0] ?? [0, wav.frames];
    const out = join(AUDIO_OUT, `${slot}.wav`);
    writeSegment(wav, from, to, out, { mono: true });
    entry.file = `${slot}.wav`;
    entry.rev = createHash('sha1').update(readFileSync(out)).digest('hex').slice(0, 8);
  } else unrecorded.push(slot);
  prompts[slot] = entry;
}
for (const [slot] of PROMPTS) if (!prompts[slot]) problems.push(`the prompts sheet has no row for ${slot} — the quiz will show no instruction there`);
if (existsSync(AUDIO_SRC)) {
  const unused = readdirSync(AUDIO_SRC).filter((f) => f.toLowerCase().endsWith('.wav') && !used.has(f) && !f.startsWith('speaker-'));
  if (unused.length) problems.push(`${unused.length} recording(s) in Audio - Quiz match no slot: ${unused.join(', ')}`);
}

// ── write ─────────────────────────────────────────────────────────────────
const bank = { letters, madd, shadda, soundAlikes, prompts };
mkdirSync(join(PUB, 'quiz'), { recursive: true });
writeFileSync(join(PUB, 'quiz', 'quiz.json'), JSON.stringify(bank, null, 1) + '\n', 'utf8');

const withForms = letters.filter((l) => l.forms).length;
const named = letters.filter((l) => l.name).length;
console.log(`quiz.json: ${letters.length} letters (${named} with a name clip, ${withForms} with lesson 21's forms), ${madd.length} madd cards, ${shadda.length} shadda pairs`);
console.log(`sound-alikes: ${soundAlikes.map((g) => g.join(' ')).join(' · ') || 'none'}`);
console.log(
  unrecorded.length
    ? `spoken instructions: ${Object.keys(prompts).length - unrecorded.length} of ${Object.keys(prompts).length} recorded — still to record: ${unrecorded.join(', ')}`
    : `spoken instructions: all ${Object.keys(prompts).length} recorded`,
);
if (!existsSync(AUDIO_SRC)) console.log(`  (no folder yet: ${AUDIO_SRC} — record Quiz Prompts.docx into it)`);
for (const p of problems) console.log(`  ! ${p}`);
