/** Shared Arabic text helpers for the lesson generators. */

const HAMZAS = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ']);
const MADDAH = 'ٓ'; // U+0653
const DAMMA = 'ُ';
const KASRA = 'ِ';
const VOWELS = /[ًٌٍَُِّْۡ]/;
const MARK = /[ً-ٰۖ-ۭ]/;

/**
 * Write the madd sign over a madd wajib muttasil.
 *
 * When a long vowel runs straight into a hamza inside the same word, the
 * madd is held four harakat instead of two, and the Mushaf marks it — ٱلشِّتَآءِ,
 * ٱلسَّمَآءِ, جَآءَ. The sign is what the reader actually looks for, so the text
 * should carry it wherever the rule applies rather than only where it was
 * typed by hand.
 */
/**
 * Put the silent-letter circles back on canon, as the docx is read.
 *
 * A Word document is encoded to match the author's *installed* font rather
 * than to Unicode canon, so the round zero over a silent letter (صفر مستدير)
 * arrives as U+0652, the modern sukoon. Left alone it would render as a
 * sukoon in the app — telling the learner to stop on a letter that is silent.
 *
 * Only that one swap. The reverse advice — U+06E1 to U+0652, on the grounds
 * that canon puts sukoon at U+0652 — must never be applied here: this project
 * writes sukoon as U+06E1, which is what KFGQPC Uthmanic Hafs draws, and the
 * swap would silently alter every sukoon in every lesson.
 *
 * The rectangular zero U+06E0 (conditional silence, أَنَا۠) already arrives
 * correctly and is left alone.
 */
export function normaliseZeros(text) {
  return text.replace(/ْ/g, '۟');
}

export function addMaddSigns(text) {
  const chars = [...text];
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    out.push(ch);
    if (ch !== 'ا' && ch !== 'ى' && ch !== 'و' && ch !== 'ي') continue;

    // Marks riding on this letter, and what comes after them.
    let j = i + 1;
    const marks = [];
    while (j < chars.length && MARK.test(chars[j])) marks.push(chars[j++]);
    if (marks.some((m) => VOWELS.test(m)) || marks.includes(MADDAH)) continue;

    // It is only a madd letter if nothing vowels it, and for و/ي only after
    // the matching short vowel.
    if (ch === 'و' || ch === 'ي') {
      const prevMarks = [];
      let k = i - 1;
      while (k >= 0 && MARK.test(chars[k])) prevMarks.push(chars[k--]);
      const want = ch === 'و' ? DAMMA : KASRA;
      if (!prevMarks.includes(want)) continue;
    }

    if (j < chars.length && HAMZAS.has(chars[j])) out.push(MADDAH);
  }
  return out.join('');
}
