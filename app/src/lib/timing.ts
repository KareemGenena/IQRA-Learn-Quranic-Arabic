/**
 * Automatic letter-timing estimation.
 *
 * Each letter cluster gets a WEIGHT in "time units" (roughly one harakah).
 * The detected speech span of a recording is divided among the letters in
 * proportion to those weights. Rules follow tajweed duration logic and are
 * meant to grow: a new ruling is a new clause here and nothing else changes.
 *
 * LENGTH — one unit is a harakah, the time of one short vowel
 *  · plain letter with a short vowel ............... 1.0
 *  · letter with sukoon — closes a syllable ....... 0.7
 *  · madd leen (وْ / يْ after a fatha) ............. 1.1
 *  · hamzat wasl (the ٱ of ٱل, word-initial) ....... 0.9
 *  · shadda (the letter is doubled) .............. +0.8
 *  · tanween ending .............................. +0.5
 *
 * MADD — a long vowel (bare ا/ى, و after damma, ي after kasra, or a dagger
 * alif), held for as many harakat as its ruling:
 *  · tabee'i / natural ............................ 2
 *  · wajib muttasil — hamza follows in the SAME word    4
 *  · jaa'iz munfasil — hamza opens the NEXT word ...... 4
 *  · lazim — a permanent sukoon or shadda follows ..... 6
 *    (ٱلضَّآلِّينَ, ءَآلْـَٰٔنَ), and the disconnected letters
 *    opening some surahs that carry the maddah sign
 *
 * GHUNNA — the ~2-count nasal hum, added to the noon/meem that carries it:
 *  · noon or meem with shadda (نّ / مّ) ............ always
 *  · noon saakin or tanween followed by
 *      – one of the 15 ikhfa letters .............. ghunna (hidden noon)
 *      – ي ن م و (idgham with ghunna) ............. ghunna
 *      – ب (iqlab: the noon becomes a meem) ....... ghunna
 *      – ء ه ع ح غ خ (izhar, throat) .............. NO ghunna
 *      – ر ل (idgham without ghunna) .............. NO ghunna
 *  · meem saakin followed by
 *      – ب (ikhfa shafawi) or م (idgham shafawi) .. ghunna
 *      – anything else (izhar shafawi) ............ NO ghunna
 *
 * A noon/meem counts as saakin when it carries an explicit sukoon OR carries
 * no vowel at all — Uthmani script leaves the ikhfa noon unmarked (ٱلْمَنفُوشِ),
 * and neither letter is ever a madd letter, so bare means silent-vowelled.
 */

import { baseChar, marksOf } from './graphemes';
import type { LetterCluster } from './graphemes';

const FATHA = 'َ';
const DAMMA = 'ُ';
const KASRA = 'ِ';
const MUSHAF_SUKOON = 'ۡ'; // U+06E1
const SHADDA = 'ّ';
const TANWEEN = ['ً', 'ٌ', 'ٍ']; // fathatan, dammatan, kasratan
const DAGGER_ALIF = 'ٰ';
const MADDAH = 'ٓ';

/**
 * Madd lengths, in harakat (one harakah = one ordinary short vowel = 1.0):
 *   tabee'i (natural) .. 2   the plain long vowel
 *   muttasil ........... 4   madd letter then a hamza IN THE SAME WORD
 *   munfasil ........... 4   madd ends the word, next word opens with hamza
 *   lazim .............. 6   madd then a PERMANENT sukoon or shadda, and the
 *                            disconnected letters that open some surahs
 */
const MADD_NATURAL = 2;
const MADD_MUTTASIL = 4; // munfasil is the same length
const MADD_LAZIM = 6;
/** Extra time for the nasal hum — about two counts. */
const GHUNNA_WEIGHT = 0.9;
/**
 * Qalqalah: ق ط ب ج د carrying a sukoon can't be held or whispered, so the
 * voice bounces off them. The echo is quick — a fraction of a harakah.
 */
const QALQALAH = new Set('قطبجد');
const QALQALAH_WEIGHT = 0.25;

const NOON = 'ن';
const MEEM = 'م';
/** The 15 letters after which a noon saakin is hidden (ikhfa) with ghunna. */
const IKHFA = new Set('تثجدذزسشصضطظفقك');
/** يرملون minus ر ل — these merge the noon and keep the ghunna. */
const IDGHAM_GHUNNA = new Set('ينمو');
/** Throat letters: the noon is pronounced clearly, no ghunna. */
const IZHAR = new Set('ءأإآهعحغخ');
const BAA = 'ب';

const hasVowel = (marks: string[]) =>
  marks.some((m) => m === FATHA || m === DAMMA || m === KASRA || TANWEEN.includes(m));
/**
 * Sukoon is U+06E1 in this font.
 *
 * U+0652 is NOT a second spelling of it — in KFGQPC Uthmanic Hafs that slot
 * carries the round zero, and a letter under one is silent. Silence is handled
 * by derivedSilent(), which gives it no time at all rather than a short one,
 * so counting it here would hand a slice of the clip to a letter nobody says.
 */
const hasSukoon = (marks: string[]) => marks.includes(MUSHAF_SUKOON);
const isSaakin = (marks: string[]) => hasSukoon(marks) || !hasVowel(marks);

/** Hamza in any of its written forms, including one written as a mark. */
const HAMZAS = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ']);
const isHamza = (c: LetterCluster | undefined) =>
  !!c && (HAMZAS.has(baseChar(c.text)) || /[ٕٔ]/.test(c.text));

/**
 * A madd letter is a long vowel: a bare alif (or alif maqsura), a waw after a
 * damma, or a yaa after a kasra — "bare" meaning it carries no vowel of its
 * own, since it IS the vowel. ٱ is excluded: hamzat wasl is a short "a".
 */
function isMaddLetter(cluster: LetterCluster, prev: LetterCluster | undefined): boolean {
  const base = baseChar(cluster.text);
  const marks = marksOf(cluster.text);
  if (base === 'ٱ') return false;
  if (hasVowel(marks) || hasSukoon(marks) || marks.includes(SHADDA)) return false;
  const prevMarks = prev ? marksOf(prev.text) : [];
  if (base === 'آ') return true; // alif with maddah baked in
  if (base === 'ا' || base === 'ى') return !!prev; // word-initial alif is wasl
  if (base === 'و') return prevMarks.includes(DAMMA);
  if (base === 'ي') return prevMarks.includes(KASRA);
  return false;
}

/**
 * How long a madd is held, in harakat, given what is written after it.
 * Order matters: a following sukoon/shadda (lazim, 6) outranks a following
 * hamza (muttasil, 4), which outranks the plain natural madd (2).
 */
function maddLength(cluster: LetterCluster, next: LetterCluster | undefined): number {
  const marks = marksOf(cluster.text);
  const nextMarks = next ? marksOf(next.text) : [];

  // Madd lazim kalimi: the madd runs straight into a permanent sukoon
  // (ءَآلْـَٰٔنَ) or a shadda (ٱلضَّآلِّينَ).
  if (next && (nextMarks.includes(SHADDA) || hasSukoon(nextMarks))) return MADD_LAZIM;

  // Madd wajib muttasil: madd then hamza inside the one word (ٱلشِّتَآءِ).
  if (isHamza(next)) return MADD_MUTTASIL;

  // The Mushaf writes the maddah sign only over a madd that is longer than
  // natural. With no hamza after it in this word, that means munfasil — the
  // hamza opens the NEXT word — which is held the same 4 harakat.
  if (marks.includes(MADDAH)) return MADD_MUTTASIL;

  return MADD_NATURAL;
}

/** Does this cluster earn a ghunna, given the letter written after it? */
export function ghunnaFor(cluster: LetterCluster, next: LetterCluster | undefined): boolean {
  const base = baseChar(cluster.text);
  const marks = marksOf(cluster.text);
  const nextBase = next ? baseChar(next.text) : '';

  // Noon or meem with shadda always hums, wherever it sits.
  if (marks.includes(SHADDA) && (base === NOON || base === MEEM)) return true;

  const tanween = TANWEEN.some((t) => marks.includes(t));

  // Noon saakin or tanween — the ruling depends on the next letter.
  if ((base === NOON && isSaakin(marks)) || tanween) {
    if (!nextBase) return false; // stopping here: no following letter, no ghunna
    if (IZHAR.has(nextBase)) return false;
    if (IKHFA.has(nextBase) || IDGHAM_GHUNNA.has(nextBase) || nextBase === BAA) return true;
    return false; // ر ل — merged with no ghunna
  }

  // Meem saakin: hums only before ب or م.
  if (base === MEEM && isSaakin(marks) && !marks.includes(SHADDA)) {
    return nextBase === BAA || nextBase === MEEM;
  }

  return false;
}

export interface WeightOptions {
  /**
   * The text is disconnected letters opening a surah (الٓمٓ، طه، يس), where
   * each character is read as its full NAME. The names of نقص عسلكم hold a
   * madd lazim of 6 and carry the maddah sign, so they are already handled;
   * the names of حي طهر hold a natural madd of 2 but carry no sign at all,
   * which is indistinguishable from an ordinary letter without this flag.
   */
  letterNames?: boolean;
}

export function clusterWeight(
  cluster: LetterCluster,
  prev: LetterCluster | undefined,
  _isLast: boolean,
  next?: LetterCluster,
  opts: WeightOptions = {},
): number {
  const base = baseChar(cluster.text);
  const marks = marksOf(cluster.text);
  const prevMarks = prev ? marksOf(prev.text) : [];
  const bare = marks.length === 0;

  let w = 1.0;
  /** Has this cluster's madd already been paid for? See the dagger alif below. */
  let maddCounted = false;

  if (base === 'ٱ' || (bare && base === 'ا' && !prev)) {
    // Hamzat wasl — the "a" of ٱل. Never a madd: an elongation needs a vowel
    // before it, and this is the start of the word. (ٱ U+0671 always is one;
    // a plain bare alif only when it opens the word.)
    w = 0.9;
  } else if (isMaddLetter(cluster, prev)) {
    // The letter IS the long vowel, so its whole duration is the madd.
    w = maddLength(cluster, next);
    maddCounted = true;
  } else if (hasSukoon(marks)) {
    const leen = (base === 'و' || base === 'ي') && prevMarks.includes(FATHA);
    // A saakin letter closes the syllable before it. It carries no vowel, but
    // it is still held — the closure is audible, and at the end of a word
    // before the next one it is held longer still. 0.7 made the highlight
    // skip through وَإِذۡ هُمۡ نَجۡوَىٰٓ almost without stopping on the ذ and the م,
    // which is where this was caught.
    w = leen ? 1.3 : 1.2;
  } else if (marks.includes(MADDAH) && !hasVowel(marks)) {
    // A plain consonant carrying the maddah sign is one of the disconnected
    // letters that open some surahs (الٓمٓ، صٓ، قٓ): madd lazim harfi, 6 harakat.
    w = MADD_LAZIM;
  } else if (opts.letterNames && !hasVowel(marks)) {
    // Same context, but one of حي طهر — read as its name (طا، ها، حا، يا، را),
    // which holds a natural madd of 2. Nothing in the text marks these, hence
    // the flag.
    w = MADD_NATURAL;
  }

  if (marks.includes(SHADDA)) w += 0.8;
  // A dagger alif is the long vowel written as a mark, so a CONSONANT carrying
  // one is consonant + madd, exactly like a written alif would be (رَٰ = 1 + 2).
  //
  // On a letter that is already the long vowel it is the same vowel spelled
  // twice, not a second one: the ىٰ of نَجۡوَىٰٓ is one madd, and adding a second
  // gave it 8 harakat — a third of that whole phrase's budget, which starved
  // every letter before it. Only add the madd where nothing has paid for it.
  if (marks.includes(DAGGER_ALIF) && !maddCounted) w += maddLength(cluster, next);
  if (TANWEEN.some((t) => marks.includes(t))) w += 0.5;
  if (ghunnaFor(cluster, next)) w += GHUNNA_WEIGHT;
  if (QALQALAH.has(base) && hasSukoon(marks)) w += QALQALAH_WEIGHT;

  // Merged lam-alif ligature: the alif fused into it needs its own time — a
  // full madd when it is a bare alif (لَا), but only a normal letter's worth
  // when it carries a vowel of its own (لْإِ in ٱلْإِنسَٰنَ).
  if (cluster.ligature) w += cluster.ligatureTailBare ? maddLength(cluster, next) : 1.0;

  return w;
}

/**
 * Indices of the clusters that are actually pronounced. Silent letters (the
 * shamsiyya lam) are written but never spoken, so they take no time and are
 * never highlighted — everything downstream counts in AUDIBLE letters.
 */
export function audibleIndices(clusters: LetterCluster[], silent: number[] = []): number[] {
  const skip = new Set(silent);
  return clusters.map((_, i) => i).filter((i) => !skip.has(i));
}

/**
 * Build boundary times (length = audible letter count + 1) by distributing
 * the speech span [speechStart, speechEnd] across the audible letters by
 * weight.
 */
export function autoBoundaries(
  clusters: LetterCluster[],
  speechStart: number,
  speechEnd: number,
  silent: number[] = [],
  opts: WeightOptions = {},
): number[] {
  const audible = audibleIndices(clusters, silent);
  // Elongation and ghunna depend on the letters WRITTEN either side, not the
  // audible ones, so pass the visual neighbours.
  const weights = audible.map((idx, n) =>
    clusterWeight(
      clusters[idx],
      clusters[idx - 1],
      n === audible.length - 1,
      clusters[idx + 1],
      opts,
    ),
  );
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = speechEnd - speechStart;

  const boundaries = [speechStart];
  let acc = 0;
  for (const w of weights) {
    acc += w;
    boundaries.push(speechStart + (span * acc) / total);
  }
  return boundaries;
}
