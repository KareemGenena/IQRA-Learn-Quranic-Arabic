/**
 * Automatic letter-timing estimation.
 *
 * Each letter cluster gets a WEIGHT in "time units" (roughly one harakah).
 * The detected speech span of a recording is divided among the letters in
 * proportion to those weights. Rules follow tajweed duration logic and are
 * meant to grow: a new ruling is a new clause here and nothing else changes.
 *
 * LENGTH
 *  · plain letter with a short vowel ............... 1.0
 *  · sukoon inside the word ....................... 1.0  (articulated fully)
 *  · sukoon on the FINAL letter (clipped stop) .... 0.75
 *  · madd letter — bare ا/ى, و after damma,
 *    ي after kasra, or a dagger alif ............. +1.2
 *  · madd leen (وْ / يْ after a fatha) ............. 1.1
 *  · hamzat wasl (the ٱ of ٱل, word-initial) ....... 0.9
 *  · shadda (the letter is doubled) .............. +0.8
 *  · tanween ending .............................. +0.5
 *  · lam-alif ligature ........................... +1.2 for the alif
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
const SUKOON = 'ْ'; // U+0652
const MUSHAF_SUKOON = 'ۡ'; // U+06E1
const SHADDA = 'ّ';
const TANWEEN = ['ً', 'ٌ', 'ٍ']; // fathatan, dammatan, kasratan
const DAGGER_ALIF = 'ٰ';
const MADDAH = 'ٓ';

const MADD_WEIGHT = 1.2;
/** Extra time for the nasal hum — about two counts. */
const GHUNNA_WEIGHT = 0.9;

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
const hasSukoon = (marks: string[]) => marks.includes(SUKOON) || marks.includes(MUSHAF_SUKOON);
const isSaakin = (marks: string[]) => hasSukoon(marks) || !hasVowel(marks);

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

export function clusterWeight(
  cluster: LetterCluster,
  prev: LetterCluster | undefined,
  isLast: boolean,
  next?: LetterCluster,
): number {
  const base = baseChar(cluster.text);
  const marks = marksOf(cluster.text);
  const prevMarks = prev ? marksOf(prev.text) : [];
  const bare = marks.length === 0;

  let w = 1.0;

  if (base === 'ٱ' || (bare && base === 'ا' && !prev)) {
    // Hamzat wasl — the "a" of ٱل. Never a madd: an elongation needs a vowel
    // before it, and this is the start of the word. (ٱ U+0671 always is one;
    // a plain bare alif only when it opens the word.)
    w = 0.9;
  } else if (bare && (base === 'ا' || base === 'ى')) {
    w = MADD_WEIGHT; // alif of madd: full elongation unit
  } else if (bare && base === 'و' && prevMarks.includes(DAMMA)) {
    w = MADD_WEIGHT;
  } else if (bare && base === 'ي' && prevMarks.includes(KASRA)) {
    w = MADD_WEIGHT;
  } else if (hasSukoon(marks)) {
    const leen = (base === 'و' || base === 'ي') && prevMarks.includes(FATHA);
    // A medial sukoon letter is articulated fully; only stopping on a final
    // sukoon clips it short.
    w = leen ? 1.1 : isLast ? 0.75 : 1.0;
  }

  if (marks.includes(SHADDA)) w += 0.8;
  // A dagger alif IS the long vowel, so it adds a full elongation.
  if (marks.includes(DAGGER_ALIF)) w += MADD_WEIGHT;
  if (marks.includes(MADDAH)) w += MADD_WEIGHT;
  if (TANWEEN.some((t) => marks.includes(t))) w += 0.5;
  if (ghunnaFor(cluster, next)) w += GHUNNA_WEIGHT;

  // Merged lam-alif ligature: the alif fused into it needs its own time — a
  // full elongation when it is a bare madd alif (لَا), but only a normal
  // letter's worth when it carries a vowel of its own (لْإِ in ٱلْإِنسَٰنَ).
  if (cluster.ligature) w += cluster.ligatureTailBare ? MADD_WEIGHT : 1.0;

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
): number[] {
  const audible = audibleIndices(clusters, silent);
  // Elongation and ghunna depend on the letters WRITTEN either side, not the
  // audible ones, so pass the visual neighbours.
  const weights = audible.map((idx, n) =>
    clusterWeight(clusters[idx], clusters[idx - 1], n === audible.length - 1, clusters[idx + 1]),
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
