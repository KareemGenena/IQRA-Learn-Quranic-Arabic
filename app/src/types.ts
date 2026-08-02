/** Boundary times are in seconds, in MEDIA time (so they hold at any speed).
 *  Length = audible letter count + 1: [i] is when letter i begins, the last
 *  entry is when speech ends. null = not calibrated; timings are computed. */
export type Timings = number[] | null;

/** Lesson 1 shape: one word, one recording. */
export interface SimpleWord {
  id: number;
  arabic: string;
  audio: string;
  timings: Timings;
}

/** Lesson 2 shape: a word shown bare and again with ال. */
export interface WordForm {
  text: string;
  audio: string;
  timings: Timings;
}

export type LamType = 'qamariyya' | 'shamsiyya';

export interface PairWord {
  id: number;
  type: LamType;
  meaning: string;
  /** Characters of the leading ال (2 for shamsiyya, 3 with the lam's sukoon). */
  alLength: number;
  bare: WordForm;
  withAl: WordForm;
}

export interface LessonSection {
  type: LamType;
  title: string;
  titleArabic: string;
  hint: string;
}

export interface Lesson {
  lesson: number;
  title: string;
  titleArabic: string;
  audioPath: string;
  /** 'words' = lesson 1 style grid, 'pairs' = bare/ال pairs in pages. */
  kind: 'words' | 'pairs';
  /** pairs only */
  perPage?: number;
  sections?: LessonSection[];
  quizSize?: number;
  words: SimpleWord[] | PairWord[];
}

/**
 * One thing the learner can play: a piece of Arabic with its recording.
 * Both lesson shapes are normalised to this so the card, the player and the
 * calibrate page never need to know which lesson they're in.
 */
export interface Playable {
  /** Stable calibration key, unique within a lesson: "4" or "12b". */
  key: string;
  text: string;
  audio: string;
  timings: Timings;
  /** Cluster indices that are written but NOT pronounced (the silent
   *  shamsiyya lam). They are never highlighted and get no time. */
  silentClusters: number[];
  /** Leading clusters that form the ال prefix, coloured apart. 0 = none. */
  prefixClusters: number;
}
