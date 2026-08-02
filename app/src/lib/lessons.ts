/** Lesson loading and normalisation into Playables. */

import type { Lesson, PairWord, Playable, SimpleWord } from '../types';

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

/** Every playable in a lesson, in teaching order — used by the calibrate page. */
export function allPlayables(lesson: Lesson): { label: string; playable: Playable }[] {
  if (lesson.kind === 'pairs') {
    return (lesson.words as PairWord[]).flatMap((w) => [
      { label: `${w.id}`, playable: barePlayable(w) },
      { label: `${w.id} +ال`, playable: withAlPlayable(w) },
    ]);
  }
  return (lesson.words as SimpleWord[]).map((w) => ({
    label: `${w.id}`,
    playable: simplePlayable(w),
  }));
}
