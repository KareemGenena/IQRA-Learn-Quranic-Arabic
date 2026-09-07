/** Lesson loading and normalisation into Playables. */

import { splitClusters, baseChar, derivedSilent } from './graphemes';
import type { Lesson, LessonItem, LetterWord, PairWord, Playable, SimpleWord } from '../types';

export interface LessonMeta {
  /**
   * The lesson's IDENTITY, and never its position.
   *
   * It is spent the moment a lesson exists, and it is what
   * `public/lessons/lessonNN/`, `public/audio/lessonNN/`, `#/lesson/N` and
   * `calibrations/lessonN/...` are all keyed on. Moving a lesson up the menu,
   * or into a chapter, must therefore never change it: renumbering to reorder
   * would silently point every calibration at the wrong word, which is exactly
   * the bug lesson 4's word ids already cost this project once.
   *
   * Reading order is `order` below; grouping will be a `chapter` beside it.
   */
  id: number;
  title: string;
  titleArabic: string;
  blurb: string;
  /**
   * Where this lesson sits in the menu, if not simply by id.
   *
   * Nothing sets it yet — the lessons were written in the order they are read.
   * It exists so that the day one moves, the move is a number here rather than
   * a renaming of folders, clips and calibration documents.
   */
  order?: number;
  /**
   * Which menu(s) this lesson appears in. A lesson may be in both: the kids
   * curriculum and the adult one are the same content wearing two skins, and
   * `mode` never touches an id, a folder, a clip name or a calibration key.
   * Defaults to the adult track, which is every lesson written before this.
   */
  tracks?: Track[];
  /** Which Level heading it sits under in the kids menu. */
  kidsLevel?: 1 | 2 | 3;
}

export type Track = 'adults' | 'kids';

/**
 * The lesson menu on the home page. Add a line here for each new lesson.
 *
 * Written in reading order today. Read it through `orderedLessons()` rather
 * than relying on that.
 */
export const LESSONS: LessonMeta[] = [
  {
    id: 1,
    title: 'Five-Letter Words',
    titleArabic: 'كلمات من خمسة أحرف',
    blurb: '33 words from Al-Fatiha and Al-Baqarah, heard letter by letter.',
  },
  {
    id: 2,
    title: 'Sun & Moon Lam',
    titleArabic: 'اللام الشمسية والقمرية',
    blurb: '46 words from the last surahs — hear when the ل is spoken and when it is silent.',
  },
  {
    id: 3,
    title: 'Throat Letters',
    titleArabic: 'حروف الحلق',
    blurb: 'ء ه ح ع غ خ — the six letters of the throat, at the start, middle and end of a word.',
  },
  {
    id: 4,
    title: 'Hamzat Wasl after وَ and ثُمَّ',
    titleArabic: 'همزة الوصل بعد الواو وثم',
    blurb: 'Each word alone, then after وَ and ثُمَّ — hear the ٱ of ٱل drop away.',
  },
  {
    id: 5,
    title: 'Madd before a Hamza',
    titleArabic: 'المد المتصل والمنفصل قبل همزة',
    blurb: 'Muttasil and munfasil — both held for four harakat, whether the hamza is in the same word or the next.',
  },
  {
    id: 6,
    title: 'Madd Lāzim, Ṣilah and More',
    titleArabic: 'المد اللازم ومد الصلة وغيرهما',
    blurb: 'The longest madd, the pronoun that grows a natural madd, and what happens to a madd when you stop.',
  },

  // ── IQRA Kids — the Baghdadi qaida. See Design/iqra-kids.md. ────────────
  // Numbers 20–30 are reserved for the eleven qaida lessons and 31–32 for the
  // two songs; `order` is what decides where each is read, so a lesson can be
  // moved without its number — and therefore its clips and calibrations —
  // moving with it.
  {
    id: 31,
    order: 1,
    tracks: ['kids'],
    kidsLevel: 1,
    title: 'The Alphabet Song — the Names',
    titleArabic: 'أنشودة الحروف — الأسماء',
    blurb: 'All 28 letters in order, sung. Press pause whenever you want to stop and learn.',
  },
  {
    id: 20,
    order: 2,
    tracks: ['kids'],
    kidsLevel: 1,
    title: 'The Letters — ب to ز',
    titleArabic: 'الحروف ١',
    blurb: 'Ten letters: its name, then a, u and i, then the letter with a sukoon.',
  },
  {
    id: 21,
    order: 3,
    tracks: ['kids'],
    kidsLevel: 1,
    title: 'The Letters — س to ق',
    titleArabic: 'الحروف ٢',
    blurb: 'Ten more, from the sea snake to the deep fishing net.',
  },
  {
    id: 22,
    order: 4,
    tracks: ['kids'],
    kidsLevel: 1,
    title: 'The Letters — ك to ا, and لا ة',
    titleArabic: 'الحروف ٣',
    blurb: 'The last of them, the hamza on each of its seats, and the three madd letters.',
  },
  {
    id: 32,
    order: 5,
    tracks: ['kids'],
    kidsLevel: 1,
    title: 'The Alphabet Song — the Sounds',
    titleArabic: 'أنشودة الحروف — الحركات',
    blurb: 'Every letter with a, u and i — and where in the mouth each one is made.',
  },
];

/**
 * The lessons in the order a learner meets them.
 *
 * The one place that decides reading order, so that when lessons are grouped
 * into chapters and shuffled between them, this is what changes — not the
 * lesson numbers, and not each page that happens to list lessons.
 */
export function orderedLessons(
  lessons: LessonMeta[] = LESSONS,
  /** Which menu is asking. A lesson with no `tracks` belongs to the adults. */
  track: Track = 'adults',
): LessonMeta[] {
  return lessons
    .filter((l) => (l.tracks ?? ['adults']).includes(track))
    .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
}

const pad = (n: number) => String(n).padStart(2, '0');

export async function loadLesson(id: number): Promise<Lesson> {
  const res = await fetch(`${import.meta.env.BASE_URL}lessons/lesson${pad(id)}/words.json`);
  if (!res.ok) throw new Error(`lesson ${id}: ${res.status}`);
  const lesson = (await res.json()) as Lesson;
  return { ...lesson, kind: lesson.kind ?? 'words' };
}

export function isPairWord(w: SimpleWord | PairWord): w is PairWord {
  return (w as PairWord).bare !== undefined;
}

/** The ال prefix is always exactly two clusters: the alif and the lam. */
const AL_CLUSTERS = 2;

export function barePlayable(word: PairWord): Playable {
  return {
    key: `${word.id}a`,
    text: word.bare.text,
    audio: word.bare.audio,
    timings: word.bare.timings,
    silentClusters: derivedSilent(word.bare.text),
    prefixClusters: 0,
  };
}

export function withAlPlayable(word: PairWord): Playable {
  return {
    key: `${word.id}b`,
    text: word.withAl.text,
    audio: word.withAl.audio,
    timings: word.withAl.timings,
    // In a shamsiyya word the lam is written but not pronounced — it
    // assimilates into the doubled letter that follows.
    silentClusters: derivedSilent(word.withAl.text),
    prefixClusters: AL_CLUSTERS,
  };
}

export function simplePlayable(word: SimpleWord): Playable {
  return {
    key: String(word.id),
    text: word.arabic,
    audio: word.audio,
    timings: word.timings,
    silentClusters: derivedSilent(word.arabic),
    prefixClusters: 0,
  };
}

/**
 * Which cluster holds the letter being taught. The Position column
 * disambiguates a letter that appears more than once — "Beginning" takes the
 * first occurrence, "End" the last, "Middle" the first interior one.
 */
function findTargetCluster(text: string, letter: string, position: string): number | undefined {
  const clusters = splitClusters(text);
  const hits = clusters
    .map((c, i) => ({ i, base: baseChar(c.text) }))
    .filter((c) => c.base === letter)
    .map((c) => c.i);
  if (hits.length === 0) return undefined;
  const p = position.toLowerCase();
  if (p.startsWith('end')) return hits[hits.length - 1];
  if (p.startsWith('mid')) {
    return hits.find((i) => i > 0 && i < clusters.length - 1) ?? hits[0];
  }
  return hits[0];
}

function letterPlayables(word: LetterWord): Playable[] {
  // Several forms of the same word on one card, each played separately.
  if (word.forms) {
    return word.forms.map((f, i) => ({
      key: `${word.id}${'abc'[i] ?? i}`,
      text: f.text,
      audio: f.audio,
      timings: f.timings,
      silentClusters: derivedSilent(f.text),
      letterNames: word.letterNames,
      waqf: word.waqf,
      waqfMadd: word.waqfMadd,
      dimFinalMark: word.dimFinalMark,
      // The ٱل is coloured apart only where it is actually present.
      prefixClusters: 0,
    }));
  }
  return [
    {
      key: String(word.id),
      text: word.text,
      audio: word.audio,
      timings: word.timings,
      silentClusters: derivedSilent(word.text),
      letterNames: word.letterNames,
      waqf: word.waqf,
      waqfMadd: word.waqfMadd,
      dimFinalMark: word.dimFinalMark,
      prefixClusters: 0,
      highlightCluster: word.target
        ? findTargetCluster(word.text, word.target.letter, word.target.position)
        : undefined,
    },
  ];
}

/**
 * The spoken lines of a kids letter card, as playables.
 *
 * The intro's "text" is the bare letter: one cluster, so the automatic
 * boundary is simply start-to-end and nothing needs calibrating — the card
 * never highlights it, it only knows the intro is playing. The forms line's
 * text is its Arabic alone, and its boundaries are tapped in the admin page.
 */
function extraPlayables(word: LetterWord): Playable[] {
  const out: Playable[] = [];
  if (word.intro) {
    out.push({
      key: `${word.id}i`,
      text: word.intro.text || word.letter || '',
      audio: word.intro.audio,
      timings: word.intro.timings,
      silentClusters: [],
      prefixClusters: 0,
    });
  }
  if (word.line) {
    out.push({
      key: `${word.id}l`,
      text: word.line.text,
      audio: word.line.audio,
      timings: word.line.timings,
      silentClusters: derivedSilent(word.line.text),
      prefixClusters: 0,
    });
  }
  return out;
}

/** Normalises any paged lesson into the cards the page component renders. */
export function toItems(lesson: Lesson): LessonItem[] {
  if (lesson.kind === 'letters') {
    return (lesson.words as LetterWord[]).map((w) => ({
      id: w.id,
      section: w.section,
      badges: w.badges ?? [],
      meaning: w.meaning,
      // Versioned for the same reason a clip URL is: a redrawn picture keeps
      // its filename, so without `?v=` the browser's own HTTP cache would go on
      // serving the old one. See IMAGE_VERSION in vite.config.ts.
      image: w.image
        ? `${import.meta.env.BASE_URL}${lesson.imagePath ?? ''}${w.image}?v=${__IMAGE_VERSION__}`
        : undefined,
      forms: letterPlayables(w),
      letter: w.letter,
      name: w.name,
      mnemonic: w.mnemonic,
      labels: w.labels,
      extras: w.intro || w.line ? extraPlayables(w) : undefined,
    }));
  }
  return (lesson.words as PairWord[]).map((w) => ({
    id: w.id,
    section: w.type,
    badges: [w.type === 'shamsiyya' ? 'Sun ش' : 'Moon ق'],
    meaning: w.meaning,
    forms: [barePlayable(w), withAlPlayable(w)],
  }));
}

/** A section's stable key, whichever lesson shape it came from. */
export const sectionKey = (s: { id?: string; type?: string }) => s.id ?? s.type ?? '';

/** Every playable in a lesson, in teaching order — used by the admin page. */
export function allPlayables(lesson: Lesson): { label: string; playable: Playable }[] {
  if (lesson.kind === 'pairs') {
    return (lesson.words as PairWord[]).flatMap((w) => [
      { label: `${w.id}`, playable: barePlayable(w) },
      { label: `${w.id} +ال`, playable: withAlPlayable(w) },
    ]);
  }
  if (lesson.kind === 'letters') {
    return (lesson.words as LetterWord[]).flatMap((w) => [
      ...letterPlayables(w).map((playable, i) => ({
        label: w.forms ? `${w.id}${'abcdefgh'[i] ?? i}` : `${w.id}`,
        playable,
      })),
      // The spoken lines are calibrated here too — the forms line is the one
      // that needs it, since English sits between its Arabic.
      ...extraPlayables(w).map((playable) => ({
        label: `${w.id} ${playable.key.endsWith('i') ? 'intro' : 'line'}`,
        playable,
      })),
    ]);
  }
  return (lesson.words as SimpleWord[]).map((w) => ({
    label: `${w.id}`,
    playable: simplePlayable(w),
  }));
}
