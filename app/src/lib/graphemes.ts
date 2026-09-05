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
 * Every mark Quranic text puts ON a letter: harakat/tanween/shadda/sukoon
 * (U+064B–U+065F), the dagger alif (U+0670), and the Quranic annotation
 * marks (U+06D6–U+06ED) — which is where the Mushaf's own sukoon lives
 * (U+06E1, the small head of khah). Miss one and it is counted as a letter:
 * it gets its own highlight step and its own slice of the clip.
 *
 * Written as escapes so what the class holds can be read, and enumerated
 * rather than spanned because the annotation range also holds things that
 * are not marks: the end-of-āyah and sajdah SYMBOLS (U+06DD, U+06DE, U+06E9)
 * stand alone and must never be glued to a letter.
 *
 * U+06E5 and U+06E6 — the small waw and small yeh — are in here on purpose.
 * Unicode classes them as letters (Lm), so no "combining mark" test finds
 * them, but the Mushaf uses them as a mark: the ṣilah vowel written over the
 * pronoun's هـ (هُۥ، هِۦ). Left out, the tiny ۥ became a letter of its own,
 * highlighted and timed on its own, and the هـ it belongs to never learned it
 * carried a madd.
 */
const MARK_RE = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/;
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
    //
    // Tested on the segment, not on `base`: a hamza seated on a tatweel (ـٔ)
    // has no base letter either, and testing the base threw it away as a
    // space — right after the branch above had gone to the trouble of keeping
    // it. The hamza of ءَآلۡـٔـٰنَ and of خَطِيٓـَٔةً vanished from the highlight
    // that way, and the dagger alif behind it landed on the lam instead.
    if (text.trim() === '') continue;

    clusters.push({ text, start: seg.index, end: seg.index + text.length });
  }

  return clusters;
}

/** The round zero (صفر مستدير): this letter is written but never voiced. */
const ROUND_ZERO = '\u0652';
/** The rectangular zero (صفر مستطيل): silent only when reading carries on. */
const RECT_ZERO = '\u06E0';
const ALIF_WASLA = '\u0671';
const SHADDA = '\u0651';

/**
 * Which letters of a phrase are written but not pronounced.
 *
 * Derived from the text alone, so it is one rule for every lesson rather than
 * a field each generator has to remember to set. Four ways a letter goes
 * silent, all of them visible in the Mushaf's own marks:
 *
 *  1. it carries the round zero;
 *  2. it carries the rectangular zero AND something follows — that zero means
 *     "silent only if you read on", so the alif of أَنَا۠ sounds when you stop
 *     there and vanishes in مَآ أَنَا۠ بِبَاسِطٍ;
 *  3. it is a hamzat wasl with a letter before it — the ٱ that only exists to
 *     start a word, and a word running into it does that job instead;
 *  4. it is the lam of a sun lam — written, but swallowed by the shadda on the
 *     letter after it.
 *
 * Silent letters are greyed by `ArabicWord` and given no time by `timing.ts`,
 * so the highlight steps straight over them.
 */
const MADDAH = 'ٓ';
const MADD_LETTERS = new Set(['ا', 'و', 'ى', 'ي']);
const SHORT_VOWEL_RE = /[ً-ِْۡ]/;

/**
 * A maddah on the LAST letter of a text, when that letter is a long vowel,
 * is a madd munfasil whose hamza opens the next word — تَأۡمُرُوٓنِّىٓ أَعۡبُدُ.
 * Recorded alone, there is no next word for it to reach, so the sign stands
 * on the page unread. `ArabicWord` greys it and `timing.ts` gives the letter
 * a natural madd. Derived from the text, like silence, so no lesson has to
 * declare it. A letter NAME carrying the maddah (the صٓ of كٓهيعٓصٓ) is a
 * consonant, not a long vowel, and is not this.
 */
export function unreadFinalMaddah(text: string): boolean {
  const clusters = splitClusters(text);
  const last = clusters[clusters.length - 1];
  if (!last || clusters.length < 2 || !last.text.includes(MADDAH)) return false;
  return MADD_LETTERS.has(baseChar(last.text)) && !SHORT_VOWEL_RE.test(last.text);
}

export function derivedSilent(text: string): number[] {
  const clusters = splitClusters(text);
  const out = new Set<number>();

  clusters.forEach((cluster, i) => {
    if (cluster.text.includes(ROUND_ZERO)) out.add(i);
    if (cluster.text.includes(RECT_ZERO) && i < clusters.length - 1) out.add(i);

    if (baseChar(cluster.text) !== ALIF_WASLA) return;
    if (i > 0) out.add(i);
    const lam = clusters[i + 1];
    const after = clusters[i + 2];
    if (lam && baseChar(lam.text) === LAM && after?.text.includes(SHADDA)) out.add(i + 1);
  });

  return [...out].sort((a, b) => a - b);
}
