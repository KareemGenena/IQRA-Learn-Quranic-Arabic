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
 * DO NOT swap the silent-letter circles. Kept as a named no-op so nobody
 * reintroduces the swap after reading the same advice again.
 *
 * The advice — that canon puts the round zero (صفر مستدير) at U+06DF and a
 * Word file using U+0652 is therefore mis-encoded — is true of Unicode and
 * false of this app. KFGQPC Uthmanic Hafs carries the round zero's shape and
 * its mark positioning on **U+0652**, which is exactly why this project puts
 * sukoon on U+06E1 rather than U+0652. U+06DF is in the font's cmap but is
 * not positioned as an attached mark, so swapping to it renders a detached
 * full-size circle beside the letter instead of a small zero above it.
 *
 * Verified the wrong way round first: the swap shipped, and row 3 came back
 * as جِا◉ىٓءَ. The font is the authority here, not the codepoint chart.
 *
 * So: U+0652 is the round zero, U+06E0 the rectangular one, U+06E1 the
 * sukoon. All three arrive correct from Word and are left alone.
 */
export function normaliseZeros(text) {
  return text;
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
