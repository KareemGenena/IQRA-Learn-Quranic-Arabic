/**
 * Quiz me — the question book (Design/drills.md).
 *
 * The bank is written by scripts/make-quiz.mjs from the lessons' own clips.
 * This file turns a choice of topics and a number into a quiz, walks it
 * through its review rounds and scores it. Pure — no React, no playback —
 * and nothing about who is answering is kept: stage 1 is guest mode, and a
 * quiz's answers live on the device only until the next quiz begins.
 *
 * Every wrong choice differs from the answer in ONE thing, the letter or the
 * mark, never both, so a mistake says something. At most three choices (two
 * where the question is with or without), for a five-year-old's screen.
 */
import { baseChar, splitClusters } from './graphemes';

/** One clip: the text said, and where it lives (the lesson's own folder). */
export interface ClipRef {
  text: string;
  lesson: number;
  file: string;
  rev?: string;
}

export interface BankLetter {
  /** As taught — هـ in its joined form. */
  letter: string;
  /** The bare letter, the key of the sound-alike groups. */
  base: string;
  /** Lesson 20's shape family; 0 is the alif and the hamza, which share none. */
  family: number;
  /** Lesson 30's recording of its name. */
  name?: ClipRef;
  /** Lesson 21's six: Fat-ha, Tanween Fath, Damma, Tanween Damm, Kasra, Tanween Kasr. */
  forms?: ClipRef[];
  /** Lesson 30's card that traces it — the teacher's strokes where he drew them. */
  trace?: number;
}

/** A sound-alike row said aloud by the teacher — its letters one after
 *  another — played as "hear the difference" after a mix-up between them. */
export interface Contrast {
  letters: string[];
  file: string;
  rev?: string;
}

export interface QuizBank {
  letters: BankLetter[];
  /** Lesson 22: Fat-ha, Madd Alif, Damma, Madd Waaw, Kasra, Madd Yaa. */
  madd: ClipRef[][];
  /** Lesson 23: a plain form and its shadda. */
  shadda: ClipRef[][];
  /** From `Word Tables/Quiz Sound-alikes.docx`: letters confused by ear. */
  soundAlikes: string[][];
  /** The rows of that sheet the teacher recorded. */
  contrasts?: Contrast[];
  /** Level 2's words and phrases, by lesson: every form with its clip on disk. */
  words?: Record<string, ClipRef[]>;
  /** The spoken instructions recorded from `Word Tables/Quiz Prompts.docx`. */
  prompts: Record<string, { line: string; file?: string; rev?: string }>;
}

export type Level = 1 | 2 | 3;

export type TopicId =
  | 'names'
  | 'lookalikes'
  | 'memory'
  | 'sounds'
  | 'harakat'
  | 'tanween'
  | 'madd'
  | 'shadda'
  | 'tracing'
  | 'shapes'
  | 'shortWords'
  | 'timing'
  | 'longWords'
  | 'hamza'
  | 'madd4'
  | 'madd6'
  | 'qalqala';

export type Kind =
  | 'name'
  | 'lookalike'
  | 'hunt'
  | 'memory'
  | 'whichLetter'
  | 'sameDiff'
  | 'whichHaraka'
  | 'tanween'
  | 'whichTanween'
  | 'shortLong'
  | 'whichMadd'
  | 'shadda'
  | 'trace'
  | 'shape'
  | 'position'
  | 'join'
  | 'word'
  | 'find';

export interface Topic {
  id: TopicId;
  level: Level;
  title: string;
  /** May carry Arabic: shown through `Mixed`. */
  blurb: string;
  /** Where it sits in the workbook, as the chooser says it. */
  where: string;
  /** The lessons whose clips it plays. A topic is offered where at least one
   *  of them may be opened and has something recorded; none for a topic
   *  drawn from text alone. */
  lessons: number[];
  kinds: Kind[];
}

/**
 * One question carries one topic, never a lesson: lesson 21's clips feed
 * three topics. Level 1 is the workbook's six sections, Section 3 split in
 * two ("can't tell ح from ه" and "can't read a damma" need different help),
 * and two ways of practising — memory pairs and tracing (the author,
 * 2026-10-27). Level 2 follows its workbook's eight sections (drills.md §10).
 */
export const TOPICS: Topic[] = [
  { id: 'names', level: 1, title: 'Letter names', blurb: 'Hear a letter’s name, find the letter.', where: 'Workbook Level 1, section 1.', lessons: [30], kinds: ['name'] },
  { id: 'lookalikes', level: 1, title: 'Look-alike letters', blurb: 'The same shape, different dots.', where: 'Workbook Level 1, section 2.', lessons: [30], kinds: ['lookalike', 'hunt'] },
  { id: 'memory', level: 1, title: 'Memory pairs', blurb: 'Find the two cards with the same letter. A game: it is not scored.', where: 'Workbook Level 1, sections 1 and 2.', lessons: [30], kinds: ['memory'] },
  { id: 'sounds', level: 1, title: 'Letter sounds', blurb: 'Which letter made that sound?', where: 'Workbook Level 1, section 3.', lessons: [21], kinds: ['whichLetter', 'sameDiff'] },
  { id: 'harakat', level: 1, title: 'Harakat', blurb: 'Fat-ha, damma or kasra?', where: 'Workbook Level 1, section 3.', lessons: [21], kinds: ['whichHaraka'] },
  { id: 'tanween', level: 1, title: 'Tanween', blurb: 'With tanween or without — and which one.', where: 'Workbook Level 1, section 4.', lessons: [21], kinds: ['tanween', 'whichTanween'] },
  { id: 'madd', level: 1, title: 'Madd', blurb: 'Short or long — and which madd.', where: 'Workbook Level 1, section 5.', lessons: [22], kinds: ['shortLong', 'whichMadd'] },
  { id: 'shadda', level: 1, title: 'Shadda', blurb: 'With shadda or without.', where: 'Workbook Level 1, section 6.', lessons: [23], kinds: ['shadda'] },
  { id: 'tracing', level: 1, title: 'Tracing', blurb: 'Watch the letter drawn, then trace it. Leaving the line is a slip, and the letter comes back.', where: 'The writing on every workbook page.', lessons: [30], kinds: ['trace'] },
  { id: 'shapes', level: 2, title: 'Letter shapes', blurb: 'A letter at the start, in the middle or at the end — and the letters that never join.', where: 'Workbook Level 2, sections 1 and 8.', lessons: [], kinds: ['shape', 'position', 'join'] },
  { id: 'shortWords', level: 2, title: 'Short words', blurb: 'Hear a three-letter word, tap it.', where: 'Workbook Level 2, section 2.', lessons: [25], kinds: ['word'] },
  { id: 'timing', level: 2, title: 'Timing', blurb: 'Hear a word, tap it — like بد and بيد.', where: 'Workbook Level 2, section 3.', lessons: [26], kinds: ['word'] },
  { id: 'longWords', level: 2, title: 'Longer words', blurb: 'Four- and five-letter words.', where: 'Workbook Level 2, section 4.', lessons: [27, 1], kinds: ['word'] },
  { id: 'hamza', level: 2, title: 'Hamza', blurb: 'Words with a hamza at the start, in the middle or at the end.', where: 'Workbook Level 2, section 5.', lessons: [28], kinds: ['word'] },
  { id: 'madd4', level: 2, title: 'Madd Muttasil and Munfasil', blurb: 'Words, and two-word phrases.', where: 'Workbook Level 2, section 6.', lessons: [5], kinds: ['word'] },
  { id: 'madd6', level: 2, title: 'Madd Lazim and more', blurb: 'Lazim, the opening letters of surahs, silah, iwad and leen.', where: 'Workbook Level 2, section 6.', lessons: [6], kinds: ['word'] },
  { id: 'qalqala', level: 2, title: 'Qalqala', blurb: 'Three words, each heard once: which one has qalqala?', where: 'Workbook Level 2, section 7.', lessons: [29], kinds: ['find'] },
];

export const topicOf = (id: TopicId): Topic => TOPICS.find((t) => t.id === id) ?? TOPICS[0];

/**
 * What each kind of question says, as plainly as it can be said — the author,
 * 2026-10-27: "a simple click what you hear is enough" — and the recorded
 * instruction that says the same thing, where one does. A recording that no
 * longer matches its heading stays on disk, unplayed, for later.
 */
export const ASK: Record<Kind, { line: string; slot?: string }> = {
  name: { line: 'Which letter?', slot: 'quiz-which-letter' },
  lookalike: { line: 'Which letter?', slot: 'quiz-which-letter' },
  hunt: { line: 'Tap every' },
  memory: { line: 'Find the pairs.' },
  whichLetter: { line: 'Which letter?', slot: 'quiz-which-letter' },
  sameDiff: { line: 'Same or different?' },
  whichHaraka: { line: 'Which haraka?', slot: 'quiz-which-haraka' },
  tanween: { line: 'Tap what you hear.' },
  whichTanween: { line: 'Which tanween?', slot: 'quiz-which-tanween' },
  shortLong: { line: 'Tap what you hear.' },
  whichMadd: { line: 'Which madd?', slot: 'quiz-which-madd' },
  shadda: { line: 'Tap what you hear.' },
  trace: { line: 'Trace the letter.' },
  shape: { line: 'Which letter?' },
  position: { line: 'Which shape?' },
  join: { line: 'Which one never joins?' },
  word: { line: 'Tap what you hear.' },
  find: { line: 'Which one has qalqala?' },
};

/** Kinds that are practice, not questions: played, never right or wrong. */
export const UNSCORED: Kind[] = ['memory'];

/** Letters in a game of memory pairs: eight cards. */
export const MEMORY_PAIRS = 4;

export const COUNTS = [15, 30, 45];
export const SAME = 'Same';
export const DIFFERENT = 'Different';

/** Where a letter stands in a word, for the letter-shape questions. */
export type Place = 'start' | 'middle' | 'end';
export const PLACE_WORDS: Record<Place, string> = { start: 'at the start', middle: 'in the middle', end: 'at the end' };

export interface Question {
  id: string;
  kind: Kind;
  topic: TopicId;
  /** What plays: one clip, two for Same or different, three for Find the
   *  one (each with its card, in the choices' order). */
  clips: ClipRef[];
  /** What is tapped: Arabic texts, or Same / Different; on the letter hunt,
   *  the nine cells. */
  choices: string[];
  /** The right choice — on the hunt, every cell that holds the letter. */
  answer: number[];
  /** What was asked, as text: the answer record's `asked`. */
  asked: string;
  /** The hunt's letter, shown above its grid; the letter to trace. */
  target?: string;
  /** Tracing: lesson 30's card for the letter. */
  trace?: number;
  /** Shown above the choices: the letter shape asked about, or the letter
   *  whose shape is wanted. */
  show?: string;
  /** Which shape is wanted, for "Which shape?". */
  place?: Place;
}

/** One answer, the record stage 2 will save to a learner (drills.md §5).
 *  A game of memory pairs records its turns in `picked`, and is always ok. */
export interface Answer {
  qid: string;
  topic: TopicId;
  kind: Kind;
  asked: string;
  picked: string;
  ok: boolean;
  seconds: number;
  /** 0 the first time; 1, 2 … in the review rounds. */
  round: number;
}

export interface Settings {
  topics: TopicId[];
  count: number;
}

export interface Run {
  v: 1;
  settings: Settings;
  /** "Practice my mistakes": a quiz made of another quiz's misses. */
  mistakesOnly?: boolean;
  questions: Question[];
  round: number;
  /** The question ids of this round, in the order asked. */
  order: string[];
  pos: number;
  /** This round's misses — the next round. */
  missed: string[];
  answers: Answer[];
  done: boolean;
  startedAt: number;
}

// ── randomness ────────────────────────────────────────────────────────────
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Shuffled choices, with the indices of the right ones. */
function shuffled(choices: string[], right: string): { choices: string[]; answer: number[] } {
  const c = shuffle(choices);
  return { choices: c, answer: [c.indexOf(right)] };
}

// ── what the person may see ───────────────────────────────────────────────
/**
 * The bank cut to the lessons this person may open — published, or the
 * admin's drafts — so a draft never reaches a learner through the quiz.
 */
export function visibleBank(bank: QuizBank, canSee: (lesson: number) => boolean): QuizBank {
  const names = canSee(30);
  const forms = canSee(21);
  return {
    ...bank,
    letters: bank.letters.map((l) => ({
      ...l,
      name: names ? l.name : undefined,
      trace: names ? l.trace : undefined,
      forms: forms ? l.forms : undefined,
    })),
    madd: canSee(22) ? bank.madd : [],
    shadda: canSee(23) ? bank.shadda : [],
    words: Object.fromEntries(Object.entries(bank.words ?? {}).filter(([n]) => canSee(Number(n)))),
  };
}

export type TopicStatus = 'ready' | 'unpublished' | 'unrecorded';

/** Can this topic be practised now — and if not, why not, to say so. */
export function topicStatus(t: Topic, all: QuizBank, visible: QuizBank): TopicStatus {
  if (t.kinds.some((k) => seedsOf(visible, k, t).length > 0)) return 'ready';
  return t.kinds.some((k) => seedsOf(all, k, t).length > 0) ? 'unpublished' : 'unrecorded';
}

// ── what each kind of question is made from ───────────────────────────────
const PLAIN = [0, 2, 4]; // Fat-ha, Damma, Kasra in lesson 21's six
const NASAL = [1, 3, 5]; // the three tanween
const LONG = [1, 3, 5]; // the three madd in lesson 22's six
const ALL6 = [0, 1, 2, 3, 4, 5];

type Seed = { letter?: BankLetter; card?: ClipRef[]; i?: number; place?: Place; word?: ClipRef };

const named = (b: QuizBank) => b.letters.filter((l) => l.name);
const formed = (b: QuizBank) => b.letters.filter((l) => l.forms?.length === 6);

/** Letters that share a shape — lesson 20's families of two or more. */
function familyOf(b: QuizBank, l: BankLetter): BankLetter[] {
  if (!l.family) return [];
  const fam = named(b).filter((x) => x.family === l.family);
  return fam.length >= 2 ? fam : [];
}

/** The letters the sheet says sound like this one. */
function alikesOf(b: QuizBank, l: BankLetter): BankLetter[] {
  const bases = new Set(b.soundAlikes.filter((g) => g.includes(l.base)).flat());
  bases.delete(l.base);
  return formed(b).filter((x) => bases.has(x.base));
}

// ── letter shapes (Level 2): made from the text, nothing recorded ─────────
/** ا د ذ ر ز و join the letter before them, never the one after; ء joins
 *  neither and has no other shape. */
const NEVER_JOINS = new Set(['ا', 'د', 'ذ', 'ر', 'ز', 'و']);
const TATWEEL = 'ـ';

/** A letter's shapes in a word, written with the tatweel the workbook uses
 *  (ـبـ). The yaa takes its dots before another letter: يـ ـيـ ـى. */
export function shapesOf(l: BankLetter): Partial<Record<Place, string>> {
  const b = l.base;
  if (!b || b === 'ء') return {};
  if (NEVER_JOINS.has(b)) return { end: TATWEEL + b };
  const before = b === 'ى' ? 'ي' : b;
  return { start: before + TATWEEL, middle: TATWEEL + before + TATWEEL, end: TATWEEL + b };
}
const joins = (l: BankLetter) => !!shapesOf(l).start;

/** The letters shown as choices for a shape: its own family first. */
function lettersBeside(b: QuizBank, l: BankLetter, n: number): BankLetter[] {
  const fam = shuffle(b.letters.filter((x) => x !== l && x.family && x.family === l.family));
  const rest = shuffle(b.letters.filter((x) => x !== l && !fam.includes(x) && Object.keys(shapesOf(x)).length));
  return [...fam, ...rest].slice(0, n);
}

// ── words (Level 2): heard, and tapped among look-alikes ─────────────────
/**
 * Look-alike words are found by rule, never listed by hand (drills.md §10):
 * a distance over the words' letters where a letter with the same skeleton —
 * the same shape with other dots, يشاء and نشاء — costs half, the same
 * letter with another haraka a little less, a madd letter put in or left out
 * half (بد and بيد), and anything else one.
 */
const SKELETON: Record<string, string> = {
  ب: 'ٮ', ت: 'ٮ', ث: 'ٮ', ن: 'ٮ', ي: 'ٮ', ى: 'ٮ', ئ: 'ٮ',
  ج: 'ح', ح: 'ح', خ: 'ح',
  د: 'د', ذ: 'د',
  ر: 'ر', ز: 'ر',
  س: 'س', ش: 'س',
  ص: 'ص', ض: 'ص',
  ط: 'ط', ظ: 'ط',
  ع: 'ع', غ: 'ع',
  ف: 'ڡ', ق: 'ڡ',
  ه: 'ه', ة: 'ه',
  ا: 'ا', أ: 'ا', إ: 'ا', آ: 'ا', ٱ: 'ا',
  و: 'و', ؤ: 'و',
};
const MADD_LETTERS = new Set(['ا', 'و', 'ي', 'ى']);

function units(text: string): { base: string; marks: string }[] {
  return splitClusters(text).map((c) => {
    const base = baseChar(c.text);
    return { base, marks: c.text.replace(base, '') };
  });
}

export function wordDistance(a: string, b: string): number {
  const x = units(a);
  const y = units(b);
  const sub = (p: { base: string; marks: string }, q: { base: string; marks: string }) =>
    p.base === q.base ? (p.marks === q.marks ? 0 : 0.4) : SKELETON[p.base] && SKELETON[p.base] === SKELETON[q.base] ? 0.5 : 1;
  const gap = (p: { base: string }) => (MADD_LETTERS.has(p.base) ? 0.5 : 1);
  let row = [0];
  for (let j = 0; j < y.length; j++) row.push(row[j] + gap(y[j]));
  for (let i = 0; i < x.length; i++) {
    const next = [row[0] + gap(x[i])];
    for (let j = 0; j < y.length; j++) next.push(Math.min(row[j] + sub(x[i], y[j]), row[j + 1] + gap(x[i]), next[j] + gap(y[j])));
    row = next;
  }
  return row[y.length];
}

const wordCount = (text: string) => text.trim().split(/\s+/).length;

/** Every recorded word of these lessons, each text once. */
function poolOf(b: QuizBank, lessons: number[]): ClipRef[] {
  const seen = new Set<string>();
  return lessons
    .flatMap((n) => b.words?.[n] ?? [])
    .filter((w) => !seen.has(w.text) && !!seen.add(w.text));
}

/** Qalqala in the reading on: ق ط ب ج د carrying a sukoon (U+06E1 here). */
const QALQALA = /[قطبجد]ۡ/;
/** The words "Which one has qalqala?" sets beside a qalqala word — never
 *  lesson 29's own: its stop lines have qalqala with no sukoon written. */
const PLAIN_WORDS = [25, 27, 1];
const QALQALA_LETTERS = new Set(['ق', 'ط', 'ب', 'ج', 'د']);
/** No qalqala in it however it was read: none on a sukoon, and no qalqala
 *  letter last, where a stop would give it one. */
const plain = (text: string) => !QALQALA.test(text) && !QALQALA_LETTERS.has(units(text).at(-1)?.base ?? '');

function seedsOf(b: QuizBank, kind: Kind, topic?: Topic): Seed[] {
  const per = (ls: BankLetter[], is: number[]) => ls.flatMap((letter) => is.map((i) => ({ letter, i })));
  switch (kind) {
    case 'name':
      return named(b).map((letter) => ({ letter }));
    case 'lookalike':
    case 'hunt':
      return named(b)
        .filter((l) => familyOf(b, l).length >= 2)
        .map((letter) => ({ letter }));
    case 'whichLetter':
    case 'sameDiff':
    case 'whichHaraka':
      return per(formed(b), PLAIN);
    case 'tanween':
      return per(formed(b), ALL6);
    case 'whichTanween':
      return per(formed(b), NASAL);
    case 'shortLong':
      return b.madd.flatMap((card) => ALL6.map((i) => ({ card, i })));
    case 'whichMadd':
      return b.madd.flatMap((card) => LONG.map((i) => ({ card, i })));
    case 'shadda':
      return b.shadda.flatMap((card) => [0, 1].map((i) => ({ card, i })));
    case 'memory':
      // a game draws its own letters; one seed per letter keeps the share fair
      return named(b).length >= MEMORY_PAIRS ? named(b).map((letter) => ({ letter })) : [];
    case 'trace':
      return named(b)
        .filter((l) => l.trace)
        .map((letter) => ({ letter }));
    case 'shape':
      // a shape that is not the letter as taught (هـ is taught joined)
      return b.letters.flatMap((letter) =>
        (Object.entries(shapesOf(letter)) as [Place, string][])
          .filter(([, form]) => form !== letter.letter)
          .map(([place]) => ({ letter, place })),
      );
    case 'position':
      return b.letters.filter(joins).flatMap((letter) => (['start', 'middle', 'end'] as Place[]).map((place) => ({ letter, place })));
    case 'join':
      return b.letters.filter((l) => NEVER_JOINS.has(l.base)).map((letter) => ({ letter }));
    case 'word': {
      const pool = poolOf(b, topic?.lessons ?? []);
      // a word needs two others of its own length to be asked among
      return pool.filter((w) => pool.filter((x) => wordCount(x.text) === wordCount(w.text)).length >= 3).map((word) => ({ word }));
    }
    case 'find': {
      const others = poolOf(b, PLAIN_WORDS).filter((w) => plain(w.text));
      if (others.length < 2) return [];
      return poolOf(b, topic?.lessons ?? [])
        .filter((w) => QALQALA.test(w.text))
        .map((word) => ({ word }));
    }
  }
}

function make(b: QuizBank, kind: Kind, topic: Topic, s: Seed): Omit<Question, 'id'> {
  const base = { kind, topic: topic.id };
  const L = s.letter as BankLetter;
  const i = s.i ?? 0;
  switch (kind) {
    case 'name': {
      // two letters of other shapes: this is about names, not dots
      const others = shuffle(named(b).filter((x) => x !== L && (x.family !== L.family || !L.family))).slice(0, 2);
      return { ...base, clips: [L.name as ClipRef], asked: L.letter, ...shuffled([L.letter, ...others.map((x) => x.letter)], L.letter) };
    }
    case 'lookalike': {
      const fam = familyOf(b, L);
      return { ...base, clips: [L.name as ClipRef], asked: L.letter, ...shuffled(fam.map((x) => x.letter), L.letter) };
    }
    case 'hunt': {
      const others = familyOf(b, L).filter((x) => x !== L);
      const targets = 2 + Math.floor(Math.random() * 3); // two to four
      const cells = shuffle([
        ...Array.from({ length: targets }, () => L.letter),
        ...Array.from({ length: 9 - targets }, () => pick(others).letter),
      ]);
      return {
        ...base,
        clips: [L.name as ClipRef],
        asked: L.letter,
        target: L.letter,
        choices: cells,
        answer: cells.flatMap((c, k) => (c === L.letter ? [k] : [])),
      };
    }
    case 'whichLetter': {
      const forms = L.forms as ClipRef[];
      const alikes = alikesOf(b, L);
      const rest = shuffle(formed(b).filter((x) => x !== L && !alikes.includes(x)));
      const wrong = alikes.length ? [pick(alikes), rest[0]] : rest.slice(0, 2);
      const right = forms[i].text;
      return { ...base, clips: [forms[i]], asked: right, ...shuffled([right, ...wrong.map((x) => (x.forms as ClipRef[])[i].text)], right) };
    }
    case 'sameDiff': {
      const forms = L.forms as ClipRef[];
      const alikes = alikesOf(b, L);
      const same = Math.random() < 0.5;
      const other = alikes.length ? pick(alikes) : pick(formed(b).filter((x) => x !== L));
      const second = same ? forms[i] : (other.forms as ClipRef[])[i];
      return {
        ...base,
        clips: [forms[i], second],
        asked: `${forms[i].text} ${second.text}`,
        choices: [SAME, DIFFERENT],
        answer: [same ? 0 : 1],
      };
    }
    case 'whichHaraka': {
      const forms = L.forms as ClipRef[];
      return { ...base, clips: [forms[i]], asked: forms[i].text, ...shuffled(PLAIN.map((k) => forms[k].text), forms[i].text) };
    }
    case 'tanween': {
      const forms = L.forms as ClipRef[];
      const p = i - (i % 2);
      return { ...base, clips: [forms[i]], asked: forms[i].text, ...shuffled([forms[p].text, forms[p + 1].text], forms[i].text) };
    }
    case 'whichTanween': {
      const forms = L.forms as ClipRef[];
      return { ...base, clips: [forms[i]], asked: forms[i].text, ...shuffled(NASAL.map((k) => forms[k].text), forms[i].text) };
    }
    case 'shortLong': {
      const card = s.card as ClipRef[];
      const p = i - (i % 2);
      return { ...base, clips: [card[i]], asked: card[i].text, ...shuffled([card[p].text, card[p + 1].text], card[i].text) };
    }
    case 'whichMadd': {
      const card = s.card as ClipRef[];
      return { ...base, clips: [card[i]], asked: card[i].text, ...shuffled(LONG.map((k) => card[k].text), card[i].text) };
    }
    case 'shadda': {
      const card = s.card as ClipRef[];
      return { ...base, clips: [card[i]], asked: card[i].text, ...shuffled(card.map((c) => c.text), card[i].text) };
    }
    case 'memory': {
      // the seed's letter and three more; each card is in the deck twice
      const set = [L, ...shuffle(named(b).filter((x) => x !== L)).slice(0, MEMORY_PAIRS - 1)];
      return {
        ...base,
        clips: set.map((x) => x.name as ClipRef),
        choices: set.map((x) => x.letter),
        answer: [],
        asked: set.map((x) => x.letter).join(' '),
      };
    }
    case 'trace':
      return { ...base, clips: [L.name as ClipRef], choices: [], answer: [], asked: L.letter, target: L.letter, trace: L.trace };
    case 'shape': {
      const form = shapesOf(L)[s.place as Place] as string;
      return { ...base, clips: [], show: form, asked: form, ...shuffled([L.letter, ...lettersBeside(b, L, 2).map((x) => x.letter)], L.letter) };
    }
    case 'position': {
      const all = shapesOf(L);
      const want = all[s.place as Place] as string;
      return {
        ...base,
        clips: [],
        show: L.letter,
        place: s.place,
        asked: `${L.letter} ${PLACE_WORDS[s.place as Place]}`,
        ...shuffled([all.start, all.middle, all.end] as string[], want),
      };
    }
    case 'join': {
      const joiners = shuffle(b.letters.filter(joins)).slice(0, 2);
      return { ...base, clips: [], asked: L.letter, ...shuffled([L.letter, ...joiners.map((x) => x.letter)], L.letter) };
    }
    case 'word': {
      const w = s.word as ClipRef;
      const pool = poolOf(b, topic.lessons).filter((x) => x.text !== w.text && wordCount(x.text) === wordCount(w.text));
      const ranked = pool.map((x) => ({ x, d: wordDistance(w.text, x.text) })).sort((p, q) => p.d - q.d || Math.random() - 0.5);
      // the nearest is the look-alike; the third is plainly different
      const alike = ranked[0].x;
      const far = ranked.slice(1).filter((r) => r.d >= 1).map((r) => r.x);
      const other = far.length ? pick(far) : ranked[1].x;
      return { ...base, clips: [w], asked: w.text, ...shuffled([w.text, alike.text, other.text], w.text) };
    }
    case 'find': {
      const w = s.word as ClipRef;
      const others = shuffle(poolOf(b, PLAIN_WORDS).filter((x) => plain(x.text) && wordCount(x.text) === wordCount(w.text)));
      const pool = others.length >= 2 ? others : shuffle(poolOf(b, PLAIN_WORDS).filter((x) => plain(x.text)));
      const cards = shuffle([w, pool[0], pool[1]]);
      return { ...base, clips: cards, choices: cards.map((c) => c.text), answer: [cards.indexOf(w)], asked: w.text };
    }
  }
}

/**
 * The teacher's recording of two letters a learner mixed up, if there is one:
 * "hear the difference" after the mix-up. Texts are compared by their letter
 * (حَ and هَ are ح and ه).
 */
export function contrastOf(bank: QuizBank, a: string, b: string): Contrast | undefined {
  const x = baseLetter(a);
  const y = baseLetter(b);
  if (!x || !y || x === y) return undefined;
  return bank.contrasts?.find((c) => c.letters.includes(x) && c.letters.includes(y));
}

/** The letter of a short text: marks and tatweel off. */
function baseLetter(text: string): string {
  return [...text.replace(/[ً-ٰۖ-ۭـࣰ-ࣲ\s]/g, '')][0] ?? '';
}

/**
 * A new quiz: the count shared out over the topics, and each topic's share
 * over its kinds. Grouped by kind in the workbook's order, so a five-year-old
 * is not switching rules every question; the items within a kind are drawn at
 * random, and repeat only once a kind has run out of new ones. With more
 * topics than questions — three Levels in fifteen — each quiz draws its
 * topics at random, so every topic has its turn over a few quizzes.
 */
export function newRun(bank: QuizBank, settings: Settings): Run {
  let topics = TOPICS.filter((t) => settings.topics.includes(t.id) && t.kinds.some((k) => seedsOf(bank, k, t).length > 0));
  if (topics.length > settings.count) {
    const drawn = new Set(shuffle(topics).slice(0, settings.count));
    topics = topics.filter((t) => drawn.has(t));
  }
  const questions: Omit<Question, 'id'>[] = [];
  topics.forEach((t, ti) => {
    const quota = Math.floor(settings.count / topics.length) + (ti < settings.count % topics.length ? 1 : 0);
    const kinds = t.kinds.filter((k) => seedsOf(bank, k, t).length > 0);
    kinds.forEach((k, ki) => {
      const n = Math.floor(quota / kinds.length) + (ki < quota % kinds.length ? 1 : 0);
      let seeds: Seed[] = [];
      for (let q = 0; q < n; q++) {
        if (seeds.length === 0) seeds = shuffle(seedsOf(bank, k, t));
        questions.push(make(bank, k, t, seeds.pop() as Seed));
      }
    });
  });
  return begin(settings, questions.map((q, k) => ({ ...q, id: `q${k + 1}` })));
}

function begin(settings: Settings, questions: Question[], mistakesOnly = false): Run {
  return {
    v: 1,
    settings,
    ...(mistakesOnly ? { mistakesOnly } : {}),
    questions,
    round: 0,
    order: questions.map((q) => q.id),
    pos: 0,
    missed: [],
    answers: [],
    done: false,
    startedAt: Date.now(),
  };
}

/** The same question with its choices in a new order — a question coming
 *  back is not answered from memory of where the right one sat, so the
 *  right one moves (a plain shuffle left it in place a sixth of the time
 *  with three choices, half the time with two). Find the one moves its
 *  clips with its cards. */
function reshuffle(q: Question): Question {
  // Same / Different keep their places; a trace has no choices, and a game
  // of memory pairs deals its own cards.
  if (q.kind === 'sameDiff' || q.kind === 'trace' || q.kind === 'memory') return q;
  for (let tries = 0; tries < 12; tries++) {
    const order = shuffle(q.choices.map((_, k) => k));
    const answer = q.answer.map((a) => order.indexOf(a));
    if (q.kind === 'hunt' || answer[0] !== q.answer[0]) {
      return {
        ...q,
        choices: order.map((k) => q.choices[k]),
        answer,
        ...(q.kind === 'find' ? { clips: order.map((k) => q.clips[k]) } : {}),
      };
    }
  }
  return q;
}

export const current = (run: Run): Question | undefined =>
  run.done ? undefined : run.questions.find((q) => q.id === run.order[run.pos]);

/**
 * One answer given. A miss goes into this round's misses; when the round
 * ends, the misses are the next round, and so on until a round has none.
 * One right answer fixes a mistake (the author, 2026-10-27).
 */
export function answered(run: Run, q: Question, picked: string, ok: boolean, seconds: number): Run {
  const answers = [...run.answers, { qid: q.id, topic: q.topic, kind: q.kind, asked: q.asked, picked, ok, seconds, round: run.round }];
  const missed = ok ? run.missed : [...run.missed, q.id];
  const pos = run.pos + 1;
  if (pos < run.order.length) return { ...run, answers, missed, pos };
  if (missed.length === 0) return { ...run, answers, missed, pos, done: true };
  const again = new Set(missed);
  return {
    ...run,
    answers,
    questions: run.questions.map((x) => (again.has(x.id) ? reshuffle(x) : x)),
    round: run.round + 1,
    order: missed,
    pos: 0,
    missed: [],
  };
}

/** A quiz of exactly the questions missed the first time. */
export function mistakesRun(run: Run): Run {
  const missed = new Set(run.answers.filter((a) => a.round === 0 && !a.ok).map((a) => a.qid));
  return begin(run.settings, run.questions.filter((q) => missed.has(q.id)).map(reshuffle), true);
}

/** Right the first time, overall and by topic, in the workbook's order. */
export function scoreOf(run: Run) {
  const scored = run.answers.filter((a) => !UNSCORED.includes(a.kind));
  const first = scored.filter((a) => a.round === 0);
  const topics = TOPICS.map((t) => {
    const mine = first.filter((a) => a.topic === t.id);
    return { topic: t, right: mine.filter((a) => a.ok).length, total: mine.length };
  }).filter((x) => x.total > 0);
  // How the misses were put right: each round's questions and how many came
  // right — the first round, then every round of the ones missed.
  const rounds: { asked: number; right: number }[] = [];
  for (const a of scored) {
    rounds[a.round] ??= { asked: 0, right: 0 };
    rounds[a.round].asked += 1;
    if (a.ok) rounds[a.round].right += 1;
  }
  const games = run.answers.filter((a) => a.kind === 'memory');
  return {
    right: first.filter((a) => a.ok).length,
    total: first.length,
    topics,
    rounds,
    seconds: run.answers.reduce((s, a) => s + a.seconds, 0),
    missed: first.filter((a) => !a.ok),
    games: { played: games.length, turns: games.reduce((s, a) => s + (Number(a.picked) || 0), 0) },
  };
}

// ── the device's memory: the last choice, and a quiz under way ────────────
const SETTINGS_KEY = 'iqra-quiz';
const RUN_KEY = 'iqra-quiz-run';

export function readSettings(): Settings | null {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Settings | null;
    if (!s || !Array.isArray(s.topics) || !COUNTS.includes(s.count)) return null;
    const ids = new Set(TOPICS.map((t) => t.id));
    return { topics: s.topics.filter((t) => ids.has(t)), count: s.count };
  } catch {
    return null;
  }
}

export function writeSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // a private window: the choice simply is not remembered
  }
}

/** A quiz left unfinished — kept after every answer, so a reload, a closed
 *  app or a dropped connection does not lose it. */
export function readRun(): Run | null {
  try {
    const r = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as Run | null;
    return r && r.v === 1 && !r.done && Array.isArray(r.questions) && current(r) ? r : null;
  } catch {
    return null;
  }
}

export function writeRun(run: Run | null): void {
  try {
    if (run && !run.done) localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    // nothing to do: the quiz goes on, it just would not survive a reload
  }
}
