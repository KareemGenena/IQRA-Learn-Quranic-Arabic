/**
 * Automatic letter-timing estimation.
 *
 * Each letter cluster gets a WEIGHT in "time units". The detected speech span
 * of the recording is then divided among the letters in proportion to their
 * weights. Rules follow tajweed duration logic and are designed to grow:
 * future lessons add rules here (ghunna, madd lazim, qalqalah...) without
 * touching anything else.
 *
 * Current rules:
 *  - plain letter with a short vowel ............ 1.0
 *  - sukoon inside the word ..................... 1.0  (articulated fully)
 *  - sukoon on the FINAL letter (clipped stop) .. 0.75
 *  - madd letter (bare ا / و after damma /
 *    ي after kasra — the elongation itself) ..... 1.2
 *  - madd leen (وْ or يْ after a fatha) ........... 1.1
 *  - tanween ending ............................. +0.5
 *  - shadda (doubled letter) .................... +0.8
 *  - lam-alif ligature .......................... lam weight + 1.2 for the alif
 */

import { baseChar, marksOf } from './graphemes';
import type { LetterCluster } from './graphemes';

const FATHA = 'َ';
const DAMMA = 'ُ';
const KASRA = 'ِ';
const SUKOON = 'ْ';
const SHADDA = 'ّ';
const TANWEEN = ['ً', 'ٌ', 'ٍ']; // fathatan, dammatan, kasratan
const DAGGER_ALIF = 'ٰ';

const MADD_WEIGHT = 1.2;

export function clusterWeight(
  cluster: LetterCluster,
  prev: LetterCluster | undefined,
  isLast: boolean,
): number {
  const base = baseChar(cluster.text);
  const marks = marksOf(cluster.text);
  const prevMarks = prev ? marksOf(prev.text) : [];
  const bare = marks.length === 0;

  let w = 1.0;

  if (bare && (base === 'ا' || base === 'ى')) {
    w = MADD_WEIGHT; // alif of madd: full elongation unit
  } else if (bare && base === 'و' && prevMarks.includes(DAMMA)) {
    w = MADD_WEIGHT;
  } else if (bare && base === 'ي' && prevMarks.includes(KASRA)) {
    w = MADD_WEIGHT;
  } else if (marks.includes(SUKOON)) {
    const leen = (base === 'و' || base === 'ي') && prevMarks.includes(FATHA);
    // A medial sukoon letter is articulated fully; only stopping on a final
    // sukoon clips it short.
    w = leen ? 1.1 : isLast ? 0.75 : 1.0;
  }

  if (marks.includes(SHADDA)) w += 0.8;
  if (marks.includes(DAGGER_ALIF)) w += MADD_WEIGHT - 1; // dagger alif elongates like madd
  if (TANWEEN.some((t) => marks.includes(t))) w += 0.5;

  // Merged lam-alif ligature: the trailing alif is its own madd time unit.
  if (cluster.ligature) w += MADD_WEIGHT;

  return w;
}

/**
 * Build boundary times (length = clusters.length + 1) by distributing the
 * speech span [speechStart, speechEnd] across the letters by weight.
 */
export function autoBoundaries(
  clusters: LetterCluster[],
  speechStart: number,
  speechEnd: number,
): number[] {
  const weights = clusters.map((c, i) =>
    clusterWeight(c, clusters[i - 1], i === clusters.length - 1),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  const span = speechEnd - speechStart;

  const boundaries = [speechStart];
  let acc = 0;
  for (const w of weights) {
    acc += w;
    boundaries.push(speechStart + (span * acc) / total);
  }
  return boundaries;
}
