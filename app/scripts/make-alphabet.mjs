/**
 * Builds the IQRA Kids alphabet lessons from the source-of-truth docx.
 *
 *   ../Word Tables/الحروف الهجائية.docx
 *   ../Audio/Audio - Kids Alphabet/*.wav
 *
 * Seven headed tables in, five lessons out:
 *
 *   20  the letters ب ت ث ج ح خ د ذ ر ز
 *   21  the letters س ش ص ض ط ظ ع غ ف ق
 *   22  the letters ك ل م ن هـ, the hamza's seats, و ى يـ ىٰ ا لا ة
 *   31  the alphabet song, sung as letter NAMES      (read before 20)
 *   32  the alphabet song, sung as letter SOUNDS ×3  (read after 22)
 *
 * The seventh table is the spoken lines: an English intro and a forms line
 * for every letter row, two rows per letter in the same order. They are
 * matched by position and checked by name.
 *
 * A lesson's number is its identity, never its position — `order` in
 * lessons.ts decides where each is read. See Design/iqra-kids.md.
 *
 * THE RECORDING UNIT IS A TAKE, NOT A FORM. Every generator matches audio to
 * rows by the words in the filename, de-diacritized — so بَ, بُ and بِ all
 * reduce to "ب" and cannot be three files. They are one take of three pieces,
 * exactly as lesson 3 records a row. Likewise نَوۡ and نُو are one take of two,
 * which is how you would say them anyway: leen, then madd.
 *
 * Letter NAMES are not recorded on their own: the intro says the name, and
 * song 1 sings all of them. The Name column is display only.
 *
 * Run:  node scripts/make-alphabet.mjs
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { readZipEntry } from './lib/zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DOCX = join(root, 'Word Tables', 'الحروف الهجائية.docx');
const AUDIO_SRC = join(root, 'Audio', 'Audio - Kids Alphabet');
const PUBLIC = join(here, '..', 'public');

const TATWEEL = 'ـ';
/** Diacritics, Quranic annotation marks and tatweel — the same class the app's
 *  audioName.ts uses. The two must agree or a recording never finds its row. */
const MARKS = /[ً-ٰۖ-ۭـ]/g;
const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();

const problems = [];
const pad2 = (n) => String(n).padStart(2, '0');

// ── read the seven tables ─────────────────────────────────────────────────
/** Word writes ' as itself and docx-js writes &apos; — both must read back
 *  as an apostrophe, or the script cells carry entities into words.json. */
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

/** Split at each header row; a block is one table. */
const blocks = [];
for (const row of allRows) {
  if (row[0] === 'Letter' || row[0] === '#' || row[0].startsWith('Slot')) blocks.push({ head: row, rows: [] });
  else if (blocks.length) blocks[blocks.length - 1].rows.push(row);
}
if (blocks.length !== 7) {
  problems.push(`expected 7 tables in the sheet, found ${blocks.length}`);
}
const [ORD1, ORD2, ORD3, SPECIAL, SONG1, SONG2, SCRIPT] = blocks;

// ── a card, and the takes that feed it ────────────────────────────────────
/**
 * Are the first three forms this letter with fatha, damma and kasra?
 * They are then ONE take, named after the Letter cell — see the header note.
 * Stripping the marks off a bare vowelled letter leaves one or two characters;
 * a word leaves more.
 */
const isHarakaTriple = (forms) =>
  forms.length >= 3 && forms.slice(0, 3).every((f) => f && key(f).length <= 2);

/** The picture for a row. أ wears the hamza's wave crest. */
const IMAGE_FOR = { 'أ': 'ء' };
const imageOf = (letter, mnemonic) => {
  if (!mnemonic) return undefined;
  const k = key(letter);
  return `${IMAGE_FOR[k] ?? k}.png`;
};

/** The five places a child is taught, from the sheet's Makhraj cell. */
const zoneOf = (makhraj) => {
  const m = (makhraj ?? '').trim();
  if (/^Throat/.test(m)) return 'throat';
  if (/^Lips/.test(m)) return 'lips';
  if (/^Empty/.test(m)) return 'jawf';
  if (/^Nose/.test(m)) return 'nose';
  return 'tongue';
};

let nextId = 0;
/** Every take we expect to find in the audio folder: key → the clips it cuts. */
const takes = [];
/** Clips whose timings can only come from tapping along — reported so the
 *  author is told when it is time. */
const needsCalibration = [];

/** The script rows are consumed two at a time, in the letter rows' order. */
const scriptRows = SCRIPT?.rows ?? [];
let scriptAt = 0;

function letterCard(cells, { special }) {
  const letter = cells[0];
  const name = cells[1];
  const forms = special ? cells.slice(2, 7).filter(Boolean) : cells.slice(2, 6).filter(Boolean);
  const makhraj = special ? cells[7] : cells[6];
  const mnemonic = special ? cells[8] : cells[7];

  if (!letter) return null;
  if (!forms.length) {
    problems.push(`row "${letter}" has no forms`);
    return null;
  }

  const id = (nextId += 1);
  const n = pad2(id);
  const out = [];
  const labels = [];

  const triple = isHarakaTriple(forms);
  if (triple) {
    const three = forms.slice(0, 3);
    three.forEach((text, i) => {
      out.push({ text, audio: `word${n}${'abc'[i]}.wav`, timings: null });
    });
    labels.push('a', 'u', 'i');
    takes.push({
      key: key(letter),
      clips: three.map((_, i) => `word${n}${'abc'[i]}.wav`),
      of: `#${id} ${letter} — the three harakat`,
    });
  }

  // Whatever is left: grouped by filename key, so نَوۡ and نُو become one
  // two-piece take rather than two files that would overwrite each other.
  const rest = triple ? forms.slice(3) : forms;
  const groups = new Map();
  for (const text of rest) {
    const k = key(text);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(text);
  }
  for (const [k, texts] of groups) {
    const clips = [];
    for (const text of texts) {
      const audio = `word${n}${'abcdefgh'[out.length]}.wav`;
      out.push({ text, audio, timings: null });
      labels.push(texts.length > 1 && texts.indexOf(text) === 1 ? 'madd' : triple ? 'sukoon' : 'word');
      clips.push(audio);
    }
    takes.push({ key: k, clips, of: `#${id} ${letter} — ${texts.join(' ')}` });
  }

  // The spoken lines: intro, then the forms line. Position is the match;
  // the slot's letter is the check.
  const bare = key(letter);
  let intro;
  let line;
  const introRow = scriptRows[scriptAt];
  const lineRow = scriptRows[scriptAt + 1];
  if (introRow && lineRow) {
    const ok =
      key(introRow[0]).startsWith(bare) && /مقدمة$/.test(introRow[0]) &&
      key(lineRow[0]).startsWith(bare) && /حركات$/.test(lineRow[0]);
    if (!ok) {
      problems.push(`script rows ${scriptAt + 1}–${scriptAt + 2} ("${introRow[0]}", "${lineRow[0]}") do not belong to letter row "${letter}"`);
    } else {
      intro = { text: letter, script: introRow[1], audio: `word${n}i.wav`, timings: null };
      const lineText = lineRow[2] || out.map((f) => f.text).join(' ');
      line = { text: lineText, script: lineRow[1], audio: `word${n}l.wav`, timings: null };
      takes.push({ key: key(introRow[0]), clips: [intro.audio], of: `#${id} ${letter} — intro (English)`, whole: true });
      takes.push({ key: key(lineRow[0]), clips: [line.audio], of: `#${id} ${letter} — forms line`, whole: true });
      needsCalibration.push(`lesson ${'?'} #${id} line — ${lineText}`);
    }
    scriptAt += 2;
  } else {
    problems.push(`no script rows left for letter row "${letter}"`);
  }

  return {
    id,
    section: special ? 'special' : 'letters',
    letter,
    name: name || undefined,
    makhraj: makhraj || undefined,
    mnemonic: mnemonic || undefined,
    image: imageOf(letter, mnemonic),
    // No makhraj badge on a letter card — the author's call. The field stays
    // for song 2, which shows the place as a picture.
    badges: [],
    labels,
    forms: out,
    intro,
    line,
    timings: null,
  };
}

const cardsFrom = (block, special = false) =>
  (block?.rows ?? []).map((cells) => letterCard(cells, { special })).filter(Boolean);

const L20 = cardsFrom(ORD1);
const L21 = cardsFrom(ORD2);
const L22 = [...cardsFrom(ORD3), ...cardsFrom(SPECIAL, true)];
if (scriptAt !== scriptRows.length) {
  problems.push(`${scriptRows.length - scriptAt} script row(s) belong to no letter row`);
}

// ── the two songs ─────────────────────────────────────────────────────────
/**
 * A song is ONE recording and is never cut — splitIntoN must not touch it.
 * Its card is a single Playable whose text is the whole alphabet, so the
 * existing highlight walks it letter by letter; `song.steps` says what each
 * step shows and which card it sits on. The boundaries can only come from
 * tapping along in the admin calibration page: a sung rhythm has nothing to
 * do with harakat weights.
 *
 * No seaside pictures in either song. Song 1 groups look-alike letters on one
 * card; song 2 shows one letter's three harakat per card, with the makhraj
 * head beside it.
 */
function songLesson(id, block, { title, titleArabic, blurb, sounds, file }) {
  const rows = block?.rows ?? [];
  const steps = [];
  let group = -1;
  let lastGroupLabel = null;
  rows.forEach((r, i) => {
    if (sounds) {
      const zone = zoneOf(r[5]);
      for (const text of [r[2], r[3], r[4]]) steps.push({ text, group: i, zone });
    } else {
      const label = r[3];
      if (label !== lastGroupLabel) {
        group += 1;
        lastGroupLabel = label;
      }
      steps.push({ text: r[1], group });
    }
  });
  const text = steps.map((s) => s.text).join(' ');
  takes.push({ key: file, clips: [`${file}.wav`], of: `lesson ${id} — the whole song, uncut`, whole: true });
  needsCalibration.push(`lesson ${id} — the song, ${steps.length} taps`);
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
    words: [
      {
        id: 1,
        section: 'song',
        text,
        audio: `${file}.wav`,
        timings: null,
        badges: [],
      },
    ],
  };
}

const HINT = 'Listen to the intro, then the letter with a, u and i — then with a sukoon after نَ.';
const LESSONS = [
  {
    lesson: 20, title: 'The Letters — ب to ز', titleArabic: 'الحروف ١',
    words: L20,
    sections: [{ id: 'letters', title: 'The Letters', titleArabic: 'الحروف', hint: HINT }],
  },
  {
    lesson: 21, title: 'The Letters — س to ق', titleArabic: 'الحروف ٢',
    words: L21,
    sections: [{ id: 'letters', title: 'The Letters', titleArabic: 'الحروف', hint: HINT }],
  },
  {
    lesson: 22, title: 'The Letters — ك to ا, and لا ة', titleArabic: 'الحروف ٣',
    words: L22,
    sections: [
      { id: 'letters', title: 'The Letters', titleArabic: 'الحروف', hint: HINT },
      { id: 'special', title: 'The Hamza, the Madd Letters, لا and ة', titleArabic: 'الهمزة وحروف المد', hint: 'These do not behave like the others. Take them slowly.' },
    ],
  },
].map((l) => ({
  lesson: l.lesson,
  title: l.title,
  titleArabic: l.titleArabic,
  kind: 'letters',
  audioPath: `audio/lesson${l.lesson}/`,
  imagePath: 'images/kids/',
  perPage: 1,
  sections: l.sections,
  words: l.words,
}));

// Now that the lessons exist, the calibration notes can name them.
for (const l of LESSONS) {
  for (const w of l.words) {
    const i = needsCalibration.findIndex((s) => s.startsWith(`lesson ? #${w.id} line`));
    if (i >= 0) needsCalibration[i] = needsCalibration[i].replace('lesson ?', `lesson ${l.lesson}`);
  }
}

LESSONS.push(
  songLesson(31, SONG1, {
    file: 'song-names',
    title: 'The Alphabet Song — the Names',
    titleArabic: 'أنشودة الحروف — الأسماء',
    blurb: 'The 28 letters in their usual order. Sing along, and press pause whenever you like.',
  }),
  songLesson(32, SONG2, {
    file: 'song-sounds',
    sounds: true,
    title: 'The Alphabet Song — the Sounds',
    titleArabic: 'أنشودة الحروف — الحركات',
    blurb: 'Every letter with a, u and i — and where in the mouth each one is made.',
  }),
);

// ── audio ─────────────────────────────────────────────────────────────────
/** A trailing number is a take number: "ب 2.wav" replaces "ب.wav". */
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
} else {
  problems.push(`no audio folder yet: ${AUDIO_SRC}`);
}

const used = new Set();
let written = 0;
const missing = [];
for (const t of takes) {
  const match = byName.get(t.key);
  if (match) used.add(match.file);
  else missing.push(`${t.key}.wav  (${t.of})`);
}

/** clip filename → the lesson it belongs in. A take knows its clips; only the
 *  lessons know which folder those clips are written to. */
const clipHome = new Map();
for (const l of LESSONS) {
  for (const w of l.words) {
    for (const f of [...(w.forms ?? [{ audio: w.audio }]), w.intro, w.line]) {
      if (f?.audio) clipHome.set(f.audio, l.lesson);
    }
  }
}

for (const t of takes) {
  const match = byName.get(t.key);
  if (!match) continue;
  const wav = readWav(join(AUDIO_SRC, match.file));

  // A song or a spoken line is one recording and is NEVER cut. It still goes
  // through writeSegment so it lands mono, like every clip.
  if (t.whole) {
    const dir = join(PUBLIC, 'audio', `lesson${clipHome.get(t.clips[0])}`);
    mkdirSync(dir, { recursive: true });
    writeSegment(wav, 0, wav.frames, join(dir, t.clips[0]), { mono: true });
    written += 1;
    continue;
  }

  const { segments, durations, suspicious } = splitIntoN(wav, t.clips.length);
  if (segments.length !== t.clips.length) {
    problems.push(`${match.file}: split gave ${segments.length} of ${t.clips.length} — ${t.of}`);
    continue;
  }
  if (suspicious && t.clips.length > 1) {
    problems.push(`${match.file}: uneven pieces — ${durations.map((d) => d.toFixed(2)).join(' / ')} (${t.of})`);
  }
  segments.forEach(([a, b], i) => {
    const lesson = clipHome.get(t.clips[i]);
    if (lesson === undefined) {
      problems.push(`clip ${t.clips[i]} belongs to no lesson`);
      return;
    }
    const dir = join(PUBLIC, 'audio', `lesson${lesson}`);
    mkdirSync(dir, { recursive: true });
    writeSegment(wav, a, b, join(dir, t.clips[i]), { mono: true });
    written += 1;
  });
}

// A recording matching no take is a misnamed file — otherwise invisible.
if (existsSync(AUDIO_SRC)) {
  const unused = readdirSync(AUDIO_SRC)
    .filter((f) => f.toLowerCase().endsWith('.wav') && !used.has(f))
    .map((f) => f.replace(/\.wav$/i, ''));
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
for (const l of LESSONS) {
  const forms = l.words.reduce((n, w) => n + (w.forms?.length ?? 1), 0);
  const spoken = l.words.filter((w) => w.intro).length * 2;
  console.log(`  ${l.lesson}  ${String(l.words.length).padStart(2)} cards, ${String(forms).padStart(3)} forms${spoken ? `, ${spoken} spoken` : ''}   ${l.title}`);
}
console.log(`\ntakes expected: ${takes.length}`);
console.log(`recorded      : ${takes.length - missing.length}`);
console.log(`clips written : ${written}`);
if (missing.length) {
  console.log(`\nNOT RECORDED YET — ${missing.length} take(s):`);
  for (const m of missing) console.log(`  ${m}`);
}
console.log(problems.length ? `\nNEEDS REVIEW:\n  ${problems.join('\n  ')}` : '\nvalidation: all OK');

// ── the recording plan ────────────────────────────────────────────────────
// The intake system asks how many pieces a slot holds, and getting it wrong is
// silent: the take is cut in the wrong places and the clips are simply wrong.
// So the plan is printed on every run, grouped by that number.
const plan = new Map();
for (const t of takes) {
  const n = t.whole ? 'whole — 1 piece, never cut' : `${t.clips.length} piece(s)`;
  if (!plan.has(n)) plan.set(n, []);
  plan.get(n).push(`${t.key}.wav`);
}
console.log('\nRECORDING PLAN — how many pieces each take is cut into');
for (const n of [...plan.keys()].sort()) {
  const files = plan.get(n);
  console.log(`\n  ${n} — ${files.length} take(s)`);
  for (let i = 0; i < files.length; i += 6) console.log('    ' + files.slice(i, i + 6).join('  '));
}

// ── what needs tapping ────────────────────────────────────────────────────
// The automatic timings come from harakat weights and mean nothing for a song
// or for a spoken line with English between the Arabic. These get their
// boundaries from the admin calibration page, and only once they are recorded.
const recordedNeeding = needsCalibration.filter((s) => {
  const m = /#(\d+) line/.exec(s);
  const song = /^lesson (3[12])/.exec(s);
  if (song) return byName.has(song[1] === '31' ? 'song-names' : 'song-sounds');
  if (!m) return false;
  const t = takes.find((x) => /forms line/.test(x.of) && x.of.startsWith(`#${m[1]} `));
  return t && byName.has(t.key);
});
console.log(`\nNEEDS TAP CALIBRATION (admin → the lesson → Calibrate timings): ${recordedNeeding.length} recorded of ${needsCalibration.length}`);
for (const s of recordedNeeding) console.log(`  ${s}`);
if (recordedNeeding.length === 0) console.log('  none recorded yet — nothing to tap until the songs and forms lines exist');

// Every picture a card asks for must exist, or the card shows a broken image.
const wantImages = new Set();
for (const l of LESSONS) {
  for (const w of l.words) if (w.image) wantImages.add(w.image);
  if (l.song?.mode === 'sounds') for (const s of l.song.steps) wantImages.add(`makhraj-${s.zone}.png`);
}
const haveImages = new Set(
  existsSync(join(PUBLIC, 'images', 'kids')) ? readdirSync(join(PUBLIC, 'images', 'kids')) : [],
);
const noImage = [...wantImages].filter((f) => !haveImages.has(f));
console.log(`\npictures: ${wantImages.size} wanted, ${wantImages.size - noImage.length} present`);
if (noImage.length) console.log(`  missing: ${noImage.join(' ')}`);
