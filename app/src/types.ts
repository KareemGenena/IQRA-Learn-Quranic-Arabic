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
  /** lesson 2 keys sections by lam type; lesson 3 by an explicit id. */
  type?: LamType;
  id?: string;
  title: string;
  titleArabic: string;
  hint: string;
}

/** Lesson 3 shape: one word per recording, with the taught letter marked. */
export interface LetterWord {
  id: number;
  section: string;
  text: string;
  audio: string;
  timings: Timings;
  meaning?: string;
  badges?: string[];
  /** Which letter to light up, and which occurrence of it. */
  target?: { letter: string; position: string };
  /** Some rows carry several forms of the same word rather than one
   *  `text`/`audio` — a contrast pair, or a word said alone then after وَ
   *  and ثُمَّ. */
  forms?: { text: string; audio: string; timings: Timings }[];
  /** Which lam rule applies, for the silent-letter colouring. */
  lam?: LamType;
  /** A picture that belongs with this card — a waveform, a diagram. */
  image?: string;
  /** Forms where the ٱ of ٱل is written but not pronounced, because
   *  something precedes it. Indexes into `forms`. */
  waslSilentIn?: number[];
}

export interface Lesson {
  lesson: number;
  title: string;
  titleArabic: string;
  audioPath: string;
  imagePath?: string;
  /**
   * 'words'   — lesson 1 style grid
   * 'pairs'   — a word shown bare and again with ال
   * 'letters' — sections of single words with the taught letter highlighted
   */
  kind: 'words' | 'pairs' | 'letters';
  /** paged kinds only */
  perPage?: number;
  sections?: LessonSection[];
  quizSize?: number;
  quizHint?: string;
  /** Caption under each form on a card, e.g. ['alone', 'after وَ']. */
  formLabels?: string[];
  words: SimpleWord[] | PairWord[] | LetterWord[];
}

/** One card on a paged lesson: a heading badge set and one or two forms. */
export interface LessonItem {
  id: number;
  section: string;
  badges: string[];
  meaning?: string;
  /** Full URL of a picture to show beside the card, if it has one. */
  image?: string;
  forms: Playable[];
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
  /** A single cluster to colour as the letter being taught (lesson 3). */
  highlightCluster?: number;
  /** Set for surah-opening disconnected letters (الٓمٓ، طه) — each character
   *  is read as its full letter name, which changes how long it is held. */
  letterNames?: boolean;
}
