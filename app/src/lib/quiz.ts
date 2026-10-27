/**
 * Quiz me — the question book (Design/drills.md).
 *
 * The bank is written by scripts/make-quiz.mjs from the Level 1 lessons' own
 * clips. This file turns a choice of topics and a number into a quiz, walks
 * it through its review rounds and scores it. Pure — no React, no playback —
 * and nothing about who is answering is kept: stage 1 is guest mode, and a
 * quiz's answers live on the device only until the next quiz begins.
 *
 * Every wrong choice differs from the answer in ONE thing, the letter or the
 * mark, never both, so a mistake says something. At most three choices (two
 * where the question is with or without), for a five-year-old's screen.
 */
import { canSeeLesson } from './appConfig';
import type { AppConfig } from './appConfig';

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
}

export interface QuizBank {
  letters: BankLetter[];
  /** Lesson 22: Fat-ha, Madd Alif, Damma, Madd Waaw, Kasra, Madd Yaa. */
  madd: ClipRef[][];
  /** Lesson 23: a plain form and its shadda. */
  shadda: ClipRef[][];
  /** From `Word Tables/Quiz Sound-alikes.docx`: letters confused by ear. */
  soundAlikes: string[][];
  /** From `Word Tables/Quiz Prompts.docx`: the spoken instruction, and its
   *  clip once recorded. The line is shown too. */
  prompts: Record<string, { line: string; file?: string; rev?: string }>;
}

export type TopicId = 'names' | 'lookalikes' | 'sounds' | 'harakat' | 'tanween' | 'madd' | 'shadda';
export type Kind =
  | 'name'
  | 'lookalike'
  | 'hunt'
  | 'whichLetter'
  | 'sameDiff'
  | 'whichHaraka'
  | 'tanween'
  | 'whichTanween'
  | 'shortLong'
  | 'whichMadd'
  | 'shadda';

export interface Topic {
  id: TopicId;
  title: string;
  blurb: string;
  /** The Level 1 workbook section it practises. */
  section: number;
  /** The lessons whose clips it plays — a topic is offered only where the
   *  person can open them, so a draft never reaches a learner. */
  lessons: number[];
  kinds: Kind[];
}

/** One question carries one topic, never a lesson: lesson 21's clips feed
 *  three topics. The workbook's six Level 1 sections, Section 3 split in two
 *  ("can't tell ح from ه" and "can't read a damma" need different help). */
export const TOPICS: Topic[] = [
  { id: 'names', title: 'Letter names', blurb: 'Hear a letter’s name, find the letter.', section: 1, lessons: [30], kinds: ['name'] },
  { id: 'lookalikes', title: 'Look-alike letters', blurb: 'The same shape, different dots.', section: 2, lessons: [30], kinds: ['lookalike', 'hunt'] },
  { id: 'sounds', title: 'Letter sounds', blurb: 'Which letter made that sound?', section: 3, lessons: [21], kinds: ['whichLetter', 'sameDiff'] },
  { id: 'harakat', title: 'Harakat', blurb: 'Fat-ha, damma or kasra?', section: 3, lessons: [21], kinds: ['whichHaraka'] },
  { id: 'tanween', title: 'Tanween', blurb: 'With tanween or without — and which one.', section: 4, lessons: [21], kinds: ['tanween', 'whichTanween'] },
  { id: 'madd', title: 'Madd', blurb: 'Short or long — and which madd.', section: 5, lessons: [22], kinds: ['shortLong', 'whichMadd'] },
  { id: 'shadda', title: 'Shadda', blurb: 'With shadda or without.', section: 6, lessons: [23], kinds: ['shadda'] },
];

export const topicOf = (id: TopicId): Topic => TOPICS.find((t) => t.id === id) ?? TOPICS[0];

/** The prompts sheet's slot for each kind of question. */
export const PROMPT_OF: Record<Kind, string> = {
  name: 'quiz-name',
  lookalike: 'quiz-lookalike',
  hunt: 'quiz-hunt',
  whichLetter: 'quiz-which-letter',
  sameDiff: 'quiz-same-different',
  whichHaraka: 'quiz-which-haraka',
  tanween: 'quiz-tanween',
  whichTanween: 'quiz-which-tanween',
  shortLong: 'quiz-short-long',
  whichMadd: 'quiz-which-madd',
  shadda: 'quiz-shadda',
};

export const COUNTS = [15, 30, 45];
export const SAME = 'Same';
export const DIFFERENT = 'Different';

export interface Question {
  id: string;
  kind: Kind;
  topic: TopicId;
  /** What plays: one clip, or two for Same or different. */
  clips: ClipRef[];
  /** What is tapped: Arabic texts, or Same / Different; on the letter hunt,
   *  the nine cells. */
  choices: string[];
  /** The right choice — on the hunt, every cell that holds the letter. */
  answer: number[];
  /** What was asked, as text: the answer record's `asked`. */
  asked: string;
  /** The hunt's letter, shown above its grid. */
  target?: string;
}

/** One answer, the record stage 2 will save to a learner (drills.md §5). */
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

// ── what each kind of question is made from ───────────────────────────────
const PLAIN = [0, 2, 4]; // Fat-ha, Damma, Kasra in lesson 21's six
const NASAL = [1, 3, 5]; // the three tanween
const LONG = [1, 3, 5]; // the three madd in lesson 22's six
const ALL6 = [0, 1, 2, 3, 4, 5];

type Seed = { letter?: BankLetter; card?: ClipRef[]; i?: number };

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

function seedsOf(b: QuizBank, kind: Kind): Seed[] {
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
  }
}

function make(b: QuizBank, kind: Kind, topic: TopicId, s: Seed): Omit<Question, 'id'> {
  const base = { kind, topic };
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
  }
}

/** Can this topic be offered to this person? Its lessons must be ones they
 *  may open, and the bank must hold something for it. */
export function topicAvailable(t: Topic, bank: QuizBank, config: AppConfig, admin: boolean): boolean {
  return t.lessons.every((id) => canSeeLesson(config, id, admin)) && t.kinds.some((k) => seedsOf(bank, k).length > 0);
}

/**
 * A new quiz: the count shared out over the topics, and each topic's share
 * over its kinds. Grouped by kind in the workbook's order, so a five-year-old
 * is not switching rules every question; the items within a kind are drawn at
 * random, and repeat only once a kind has run out of new ones.
 */
export function newRun(bank: QuizBank, settings: Settings): Run {
  const topics = TOPICS.filter((t) => settings.topics.includes(t.id));
  const questions: Omit<Question, 'id'>[] = [];
  topics.forEach((t, ti) => {
    const quota = Math.floor(settings.count / topics.length) + (ti < settings.count % topics.length ? 1 : 0);
    const kinds = t.kinds.filter((k) => seedsOf(bank, k).length > 0);
    kinds.forEach((k, ki) => {
      const n = Math.floor(quota / kinds.length) + (ki < quota % kinds.length ? 1 : 0);
      let seeds: Seed[] = [];
      for (let q = 0; q < n; q++) {
        if (seeds.length === 0) seeds = shuffle(seedsOf(bank, k));
        questions.push(make(bank, k, t.id, seeds.pop() as Seed));
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
 *  with three choices, half the time with two). */
function reshuffle(q: Question): Question {
  if (q.kind === 'sameDiff') return q;
  for (let tries = 0; tries < 12; tries++) {
    const order = shuffle(q.choices.map((_, k) => k));
    const answer = q.answer.map((a) => order.indexOf(a));
    if (q.kind === 'hunt' || answer[0] !== q.answer[0]) return { ...q, choices: order.map((k) => q.choices[k]), answer };
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
  const first = run.answers.filter((a) => a.round === 0);
  const topics = TOPICS.map((t) => {
    const mine = first.filter((a) => a.topic === t.id);
    return { topic: t, right: mine.filter((a) => a.ok).length, total: mine.length };
  }).filter((x) => x.total > 0);
  return {
    right: first.filter((a) => a.ok).length,
    total: first.length,
    topics,
    seconds: run.answers.reduce((s, a) => s + a.seconds, 0),
    missed: first.filter((a) => !a.ok),
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
