/**
 * Arabic letter segmentation.
 *
 * A "cluster" is one highlightable unit: a base letter plus every combining
 * mark (fatha, damma, kasra, sukoon, shadda, tanween...) attached to it.
 * Intl.Segmenter does the heavy lifting; two Arabic-specific fixes on top:
 *
 * 1. Tatweel (U+0640, the decorative elongation stroke as in أَنْهَـارُ) is a
 *    base character, so the segmenter emits it as its own cluster. It is not
 *    a letter — it extends the pen stroke of the letter before it, so we
 *    merge it (and any marks riding on it) into the preceding cluster.
 *
 * 2. Lam + alif (لا and its hamza variants) form a mandatory ligature: the
 *    two letters render as ONE glyph, so they cannot be highlighted
 *    separately. They are merged into a single cluster and the timing rules
 *    give that cluster the duration of two letters. (No word in lesson 1
 *    contains it, but future lessons will.)
 */

export interface LetterCluster {
  /** The exact substring of the word, marks included. */
  text: string;
  /** UTF-16 offsets into the original word string (for Range measurement). */
  start: number;
  end: number;
  /** True for a merged lam-alif ligature — counts as two letters in timing. */
  ligature?: boolean;
  /** For a ligature: was the fused alif bare (a madd) or vowelled? */
  ligatureTailBare?: boolean;
}

const TATWEEL = 'ـ';
/**
 * Every combining mark Quranic text uses: harakat/tanween/shadda/sukoon
 * (U+064B–U+065F), the dagger alif (U+0670), and the Quranic annotation
 * marks (U+06D6–U+06ED) — which is where the Mushaf's own sukoon lives
 * (U+06E1, the small head of khah). Miss these and a mark is counted as a
 * letter.
 */
const MARK_RE =
  /[ً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/;
/** Hamza written as a combining mark, which makes its seat a real consonant. */
const HAMZA_MARK_RE = /[ٕٔ]/;
const LAM = 'ل';
const ALIFS = new Set(['ا', 'أ', 'إ', 'آ']); // ا أ إ آ

/** The base (non-mark, non-tatweel) character of a cluster, or '' if none. */
export function baseChar(text: string): string {
  for (const ch of text) {
    if (!MARK_RE.test(ch) && ch !== TATWEEL) return ch;
  }
  return '';
}

/** Combining marks present in a cluster (marks carried by a tatweel included). */
export function marksOf(text: string): string[] {
  return [...text].filter((ch) => MARK_RE.test(ch));
}

export function splitClusters(word: string): LetterCluster[] {
  const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' });
  const clusters: LetterCluster[] = [];

  for (const seg of segmenter.segment(word)) {
    const text = seg.segment;
    const base = baseChar(text);
    const prev = clusters[clusters.length - 1];

    // Tatweel (or a stray mark with no base letter): absorb into the previous
    // letter — it is a stretched pen stroke, not a letter of its own.
    // Exception: a tatweel carrying a hamza (as in ٱلْأَفْـِٔدَةِ) is a genuine
    // seat for a consonant, so it stays a letter in its own right.
    if (prev && (base === TATWEEL || base === '') && !HAMZA_MARK_RE.test(text)) {
      prev.text += text;
      prev.end = seg.index + text.length;
      continue;
    }

    // Lam-alif ligature: lam followed by any alif always renders as one glyph,
    // whatever mark the lam carries, so it must be one highlight unit.
    if (prev && ALIFS.has(base) && baseChar(prev.text) === LAM) {
      prev.ligatureTailBare = marksOf(text).length === 0;
      prev.text += text;
      prev.end = seg.index + text.length;
      prev.ligature = true;
      continue;
    }

    // A space between words is not a letter — drop it so a phrase like
    // ثُمَّ ٱلنَّاسِ doesn't gain a phantom highlight step. Offsets are absolute
    // into the string, so the remaining clusters still measure correctly.
    if (base.trim() === '') continue;

    clusters.push({ text, start: seg.index, end: seg.index + text.length });
  }

  return clusters;
}
