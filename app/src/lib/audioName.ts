/**
 * The name a recording must carry so a generator can find its row.
 *
 * Every generator matches audio to table rows by the *words in the filename*,
 * de-diacritized — never by position (see CLAUDE.md, "Audio"). That rule is
 * what lets the author re-record a row without renumbering anything, and it is
 * also the rule a hand-typed filename quietly breaks: a misnamed file is
 * invisible, it simply never plays.
 *
 * So the intake system never asks anyone to type a filename. It derives it
 * here, with the same transformation the generators use, and the two must stay
 * identical — hence this file is the single place it is written down.
 */

/** Diacritics, Quranic annotation marks, the staggered tanwīn and tatweel:
 *  U+064B–U+0670, U+06D6–U+06ED, U+08F0–U+08F2, U+0640. */
const MARKS = /[ً-ٰۖ-ۭـࣰ-ࣲ]/g;

/** Characters Windows refuses in a filename. Arabic has none of them, but a
 *  stray one pasted from a table would make the write fail with no clue why. */
const ILLEGAL = /[\\/:*?"<>|]/g;

/**
 * The match key for a piece of text — what both the generator and the intake
 * system reduce a word to before comparing. `ٱ` (alif wasla) folds to `ا`
 * because the author's own filenames are typed with the plain alif.
 */
export function audioKey(text: string): string {
  return text.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();
}

/** The filename for one slot: its key, plus `.wav`. */
export function audioFileName(text: string): string {
  return `${audioKey(text).replace(ILLEGAL, '')}.wav`;
}

/** The filename with the marks kept — `بَ.wav`, `بُ.wav` — for a sheet whose
 *  rows differ only by their marks. Windows and the generators both accept
 *  combining marks in a name; the generators match such a name exactly
 *  (scripts/lib/takes.mjs). */
export function audioFileNameExact(text: string): string {
  return `${text.normalize('NFC').replace(/\s+/g, ' ').trim().replace(ILLEGAL, '')}.wav`;
}

/**
 * Names for a whole sheet at once. Stripped of their marks, as the author
 * types them — unless two rows would then write the same file, which is
 * every harakat, tanween or madd drill (بَ بُ بِ, بَدَ بَادَ) and the whole
 * workbook: then every name on the sheet keeps its marks. One rule for the
 * sheet, never per row, so a folder is all one kind. Rows whose text is
 * identical stay duplicates either way, and the page says so.
 */
export function sheetFileNames(texts: string[]): { names: string[]; keepMarks: boolean } {
  const stripped = texts.map(audioFileName);
  const keepMarks = new Set(stripped).size !== stripped.length;
  return { names: keepMarks ? texts.map(audioFileNameExact) : stripped, keepMarks };
}

/**
 * True when a piece of text loses something on the way to a filename — an
 * illegal character, or nothing left at all once the marks come off. Worth
 * saying out loud rather than writing a file called ".wav".
 */
export function nameProblem(text: string): string | null {
  const key = audioKey(text);
  if (!key) return 'nothing left once the diacritics are removed';
  const bad = key.match(ILLEGAL);
  if (bad) return `contains ${[...new Set(bad)].join(' ')}, which a filename cannot hold`;
  return null;
}
