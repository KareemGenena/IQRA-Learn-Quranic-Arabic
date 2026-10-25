/** Boundary times are in seconds, in MEDIA time (so they hold at any speed).
 *  Length = audible letter count + 1: [i] is when letter i begins, the last
 *  entry is when speech ends. null = not calibrated; timings are computed. */
export type Timings = number[] | null;

/**
 * The same word read at a stop — the final vowel dropped, ة heard as ه, a
 * madd before the last letter held — recorded as its own take in a وقف/
 * subfolder of the lesson's audio folder and cut by the generator beside the
 * continuing clip (`<clip>-waqf.wav`; scripts/lib/stop.mjs). Timed as the
 * continuing text with `waqf: true`; calibrated under the form's key +
 * "-waqf". Every clip recorded before 2026-10-11 is the continuing reading.
 */
export interface StopReading {
  audio: string;
  timings: Timings;
}

/** Which reading a card plays and draws: the word as it is read on, with its
 *  final vowel, or as it is read when you stop on it. */
export type Reading = 'continuing' | 'stop';

/** Lesson 1 shape: one word, one recording. */
export interface SimpleWord {
  id: number;
  arabic: string;
  audio: string;
  timings: Timings;
  stop?: StopReading;
}

/** Lesson 2 shape: a word shown bare and again with ال. */
export interface WordForm {
  text: string;
  audio: string;
  timings: Timings;
  stop?: StopReading;
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
  /** False on a section whose cards have one reading only — lesson 3's
   *  drills, two words said together, where "at a stop" means nothing — so
   *  the cards show no reading tabs even on a Level 3 lesson. */
  readings?: boolean;
  /** 2 on a section laid out as the paper's right and left boxes (lesson
   *  34's ة page: right box keep going, left box stop) — two columns at any
   *  width that can hold them, one column on a phone, in that order. */
  columns?: number;
}

/** Lesson 3 shape: one word per recording, with the taught letter marked. */
export interface LetterWord {
  id: number;
  section: string;
  text: string;
  audio: string;
  timings: Timings;
  stop?: StopReading;
  meaning?: string;
  badges?: string[];
  /** Which letter to light up, and which occurrence of it. */
  target?: { letter: string; position: string };
  /** Some rows carry several forms of the same word rather than one
   *  `text`/`audio` — a contrast pair, or a word said alone then after وَ
   *  and ثُمَّ. */
  forms?: { text: string; audio: string; timings: Timings; stop?: StopReading }[];
  /** Captions for this card's forms, where they differ card by card (the
   *  workbook lessons); a lesson-wide `formLabels` on the Lesson otherwise. */
  formLabels?: string[];
  /** Cards that belong together — the two boxes of one row of the paper, or
   *  the two words of one column group — share a key, and a screen never
   *  splits them. */
  pair?: string;
  /** Which lam rule applies, for the silent-letter coloring. */
  lam?: LamType;
  /** A picture that belongs with this card — a waveform, a diagram. */
  image?: string;
  /** Forms where the ٱ of ٱل is written but not pronounced, because
   *  something precedes it. Indexes into `forms`. */
  waslSilentIn?: number[];
  /** Surah-opening disconnected letters (الٓمٓ), each read as its name. */
  letterNames?: boolean;
  /** Recorded at a stop: the last vowel is dropped and a madd before it lengthens. */
  waqf?: boolean;
  /** How long that madd is held at the stop — 2, 4 or 6. */
  waqfMadd?: number;
  /** Gray the final letter's vowel: written, and at the stop not said. */
  dimFinalMark?: boolean;

  // ── Letter cards — the Level 1 lessons (Design/iqra-kids.md) ──────────
  /** The bare letter as taught — هـ and يـ already in their joined form. */
  letter?: string;
  /** Its name, displayed only: the intro says it, song 1 sings it. */
  name?: string;
  /** Which of the five places it is made — kept for song 2, never a badge. */
  makhraj?: string;
  /** The one line under the picture, e.g. "A boat, with one bubble below it". */
  mnemonic?: string;
  /** One caption per part: 'Fat-ha', 'Damma', 'Kasra', 'Sukoon', 'Madd', 'Word'. */
  labels?: string[];
  /** The small sound cards, each a slice of `text` — the one recording's
   *  Arabic. The card lights each as the recording reaches it. */
  parts?: string[];
  /** What the teacher says on that recording, for the admin's reference. */
  script?: string;
  /** Shape family (0–16): the color a letter wears everywhere in the letter lessons. */
  family?: number;
  /** One teaching line under the sounds — "Alif comes after a fat-ha…". */
  tip?: string;
  /** The letter's other shape, on the back of the card: ى flips to يـ, the
   *  duck jumps into the boat (the author, 2026-10-24). */
  flip?: LetterFlip;
  /** A card of the "where the letters come from" page: no recording. */
  place?: PlaceInfo;
  /** A tracing card: the letter's strokes, in the frame of its ink box
   *  (0–1 across, 0–1 down), each a polyline in writing order; a stroke of
   *  one point is a dot to tap. `null` where no template exists yet. */
  trace?: LetterTrace | null;
}

/** The strokes of one letter for tracing — derived from the font's own
 *  glyph (scripts/tracing/), never drawn by hand over a different shape. */
export interface LetterTrace {
  strokes: [number, number][][];
  /** The glyph's thickest stroke as a share of its ink box's longer side —
   *  the brush the card paints with, so the color fills the whole letter. */
  brush?: number;
}

/** The back of a letter card: the shape a letter takes at the beginning of
 *  a word, with its own picture. Tapping the prompt flips the card. */
export interface LetterFlip {
  letter: string;
  image: string;
  mnemonic?: string;
  /** "Tap me to see how I change shape at the beginning of a word" */
  prompt: string;
  /** "Show original form" */
  back: string;
}

/** One of the five places a letter is made, as the workbook lists them. */
export interface PlaceInfo {
  zone: string;
  title: string;
  titleArabic: string;
  note: string;
  letters: { text: string; family?: number }[];
}

/** One step of an alphabet song: what to show, which group it belongs to
 *  (a shape family, or a letter in the sounds song), its family color. */
export interface SongStep {
  text: string;
  group: number;
  family?: number;
  zone?: string;
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
  kind: 'words' | 'pairs' | 'letters' | 'assessment';
  /** paged kinds only */
  perPage?: number;
  sections?: LessonSection[];
  quizSize?: number;
  quizHint?: string;
  /** Caption under each form on a card, e.g. ['alone', 'after وَ']. */
  formLabels?: string[];
  /** Whose translation the (i) meanings quote, e.g. 'Sahih International'.
   *  Shown under a meaning only when that meaning is a quotation. */
  meaningSource?: string;
  /** Set on the two alphabet songs: one recording, shown as a run of cards. */
  song?: { mode: 'names' | 'sounds'; steps: SongStep[] };
  words: SimpleWord[] | PairWord[] | LetterWord[];
  // ── A Level check (kind 'assessment'; scripts/make-assessments.mjs) ────
  level?: number;
  items?: AssessmentItem[];
}

/**
 * One question of a Level check. The clip is a lesson's own, by its folder,
 * file and calibration key — a check never records anything. `hear`: the clip
 * plays, the options are words, point to the one heard. `rule`: the word
 * shows and plays, the options are rule names.
 */
export interface AssessmentItem {
  id: number;
  type: 'hear' | 'rule';
  text: string;
  audio: { lesson: number; path: string; file: string; key: string };
  options: string[];
  answer: number;
  /** Where the word was taught — the lesson to revisit on a slip. */
  source: { lesson: number; id: number };
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
  formLabels?: string[];
  /** See LetterWord.pair: a screen never splits cards that share one. */
  pair?: string;
  // ── Letter cards ──────────────────────────────────────────────────────
  letter?: string;
  name?: string;
  mnemonic?: string;
  labels?: string[];
  parts?: string[];
  family?: number;
  tip?: string;
  /** See LetterWord.flip; the image is a full URL here. */
  flip?: LetterFlip;
  place?: PlaceInfo;
  trace?: LetterTrace | null;
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
  /** The same form read at a stop, when it was recorded. */
  stop?: StopReading;
  /** Cluster indices that are written but NOT pronounced (the silent
   *  shamsiyya lam). They are never highlighted and get no time. */
  silentClusters: number[];
  /** Leading clusters that form the ال prefix, colored apart. 0 = none. */
  prefixClusters: number;
  /** A single cluster to color as the letter being taught (lesson 3). */
  highlightCluster?: number;
  /** Set for surah-opening disconnected letters (الٓمٓ، طه) — each character
   *  is read as its full letter name, which changes how long it is held. */
  letterNames?: boolean;
  /** The clip ends at a stop — see WeightOptions.waqf. */
  waqf?: boolean;
  waqfMadd?: number;
  /** Gray the final letter's vowel — the stop that the clip makes. */
  dimFinalMark?: boolean;
}
