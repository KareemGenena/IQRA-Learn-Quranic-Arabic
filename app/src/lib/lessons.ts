/** Lesson loading and normalisation into Playables. */

import { splitClusters, baseChar } from './graphemes';
import type { Lesson, LessonItem, LetterWord, PairWord, Playable, SimpleWord } from '../types';

export interface LessonMeta {
  id: number;
  title: string;
  titleArabic: string;
  blurb: string;
}

/** The lesson menu on the home page. Add a line here for each new lesson. */
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
];

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
    silentClusters: [],
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
    silentClusters: word.type === 'shamsiyya' ? [1] : [],
    prefixClusters: AL_CLUSTERS,
  };
}

export function simplePlayable(word: SimpleWord): Playable {
  return {
    key: String(word.id),
    text: word.arabic,
    audio: word.audio,
    timings: word.timings,
    silentClusters: [],
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
  // A contrast drill carries two words on one card, each played separately.
  if (word.pair) {
    return word.pair.map((f, i) => ({
      key: `${word.id}${'ab'[i]}`,
      text: f.text,
      audio: f.audio,
      timings: f.timings,
      silentClusters: [],
      prefixClusters: 0,
    }));
  }
  return [
    {
      key: String(word.id),
      text: word.text,
      audio: word.audio,
      timings: word.timings,
      silentClusters: [],
      prefixClusters: 0,
      highlightCluster: word.target
        ? findTargetCluster(word.text, word.target.letter, word.target.position)
        : undefined,
    },
  ];
}

/** Normalises any paged lesson into the cards the page component renders. */
export function toItems(lesson: Lesson): LessonItem[] {
  if (lesson.kind === 'letters') {
    return (lesson.words as LetterWord[]).map((w) => ({
      id: w.id,
      section: w.section,
      badges: w.badges ?? [],
      meaning: w.meaning,
      forms: letterPlayables(w),
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
    return (lesson.words as LetterWord[]).flatMap((w) =>
      letterPlayables(w).map((playable, i) => ({
        label: w.pair ? `${w.id}${'ab'[i]}` : `${w.id}`,
        playable,
      })),
    );
  }
  return (lesson.words as SimpleWord[]).map((w) => ({
    label: `${w.id}`,
    playable: simplePlayable(w),
  }));
}
