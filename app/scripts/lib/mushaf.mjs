/**
 * What the Mushaf writes AFTER a phrase — read from the Quranic Arabic Corpus.
 *
 * The tanwīn's shape (stacked / staggered / small mīm) is decided by the first
 * letter of the NEXT word, and a card that ends on a tanwīn still shows the
 * shape the Mushaf gives it for the word that follows in the āyah — even when
 * the recording stops there. So the generator needs to know that next word.
 *
 * Source: `Grammar/Corpus/quranic-corpus-morphology-0.4.zip` — the Quranic
 * Arabic Corpus (Kais Dukes, GPL) built on the Tanzil Uthmani text (CC BY-ND).
 * One line per morphological segment, `(sura:aya:word:segment)  FORM  TAG
 * FEATURES`, FORM in Buckwalter. It is read verbatim and never modified; only
 * a first letter ever leaves this module. Credit: corpus.quran.com, tanzil.info.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readZipEntry } from './zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ZIP = join(here, '..', '..', '..', 'Grammar', 'Corpus', 'quranic-corpus-morphology-0.4.zip');
const ENTRY = 'quranic-corpus-morphology-0.4.txt';

/** Tanzil's Buckwalter letters → Arabic. Anything else in a FORM is a mark. */
const LETTERS = {
  "'": 'ء', '|': 'آ', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ', A: 'ا', b: 'ب', p: 'ة', t: 'ت', v: 'ث',
  j: 'ج', H: 'ح', x: 'خ', d: 'د', '*': 'ذ', r: 'ر', z: 'ز', s: 'س', $: 'ش', S: 'ص', D: 'ض', T: 'ط',
  Z: 'ظ', E: 'ع', g: 'غ', f: 'ف', q: 'ق', k: 'ك', l: 'ل', m: 'م', n: 'ن', h: 'ه', w: 'و', Y: 'ى',
  y: 'ي', '{': 'ٱ',
};

/**
 * Arabic letters only, alif wasla folded to alif and the two yehs folded
 * together (the Mushaf spells وَلِيّ with ى), so both sides compare alike.
 */
export const skeleton = (arabic) =>
  arabic.replace(/[^ء-يٱ]/g, '').replace(/[ٱآ]/g, 'ا').replace(/ى/g, 'ي');

const fromBuckwalter = (form) => [...form].map((c) => LETTERS[c] ?? '').join('');

let corpus = null;
/** { 'sura:aya' → [word skeletons in order] }, plus each sura's last āyah. */
function load() {
  if (corpus) return corpus;
  const text = readZipEntry(ZIP, ENTRY).toString('utf8');
  const ayat = new Map();
  const lastAya = new Map();
  for (const line of text.split('\n')) {
    const m = /^\((\d+):(\d+):(\d+):\d+\)\t(\S+)/.exec(line);
    if (!m) continue;
    const key = `${m[1]}:${m[2]}`;
    const w = Number(m[3]) - 1;
    let words = ayat.get(key);
    if (!words) ayat.set(key, (words = []));
    words[w] = (words[w] ?? '') + m[4];
    const a = Number(m[2]);
    if ((lastAya.get(m[1]) ?? 0) < a) lastAya.set(m[1], a);
  }
  corpus = { ayat, lastAya };
  return corpus;
}

/** The first letter that is READ in a Buckwalter word: past a hamzat wasl. */
function firstLetter(form) {
  const letters = fromBuckwalter(form).replace(/^ٱ/, '');
  return letters[0] ?? '';
}

/**
 * The first letter of the word that follows `phrase` at `sura:aya`, or null
 * with a reason. `phrase` is the card's Arabic; its last word is located in
 * the āyah (by skeleton, disambiguated by the word before it when the phrase
 * has one). At the end of an āyah the next āyah's first word is taken; at the
 * end of a sūrah the basmalah — ب — as the Mushaf itself assumes.
 */
/** A word matches a corpus word exactly, or the corpus word carries a short clitic (وَٱلۡمُنۡخَنِقَةُ for ٱلۡمُنۡخَنِقَةُ). */
const wordMatches = (corpusWord, sheetWord, loose) =>
  corpusWord === sheetWord || (loose && corpusWord.endsWith(sheetWord) && corpusWord.length - sheetWord.length <= 2);

/** Indices where the WHOLE phrase stands, word after word, in an āyah's skeletons. */
function phraseAt(skel, parts) {
  const out = [];
  for (let i = 0; i + parts.length <= skel.length; i++) {
    let ok = true;
    for (let k = 0; k < parts.length && ok; k++) ok = wordMatches(skel[i + k], parts[k], k === 0);
    if (ok) out.push(i + parts.length - 1);
  }
  return out;
}

let skeletons = null;
const skelOf = (sura, aya, words) => {
  skeletons ||= new Map();
  const key = `${sura}:${aya}`;
  let s = skeletons.get(key);
  if (!s) skeletons.set(key, (s = words.map((w) => skeleton(fromBuckwalter(w)))));
  return s;
};

function after(sura, aya, i) {
  const { ayat, lastAya } = load();
  const words = ayat.get(`${sura}:${aya}`);
  if (i + 1 < words.length) return { letter: firstLetter(words[i + 1]), next: fromBuckwalter(words[i + 1]), where: `${sura}:${aya} word ${i + 2}` };
  if (aya < (lastAya.get(String(sura)) ?? 0)) {
    const nextWords = ayat.get(`${sura}:${aya + 1}`);
    return { letter: firstLetter(nextWords[0]), next: fromBuckwalter(nextWords[0]), where: `${sura}:${aya + 1} word 1` };
  }
  if (Number(sura) === 114) return { letter: null, why: 'the end of the Qurʾān' };
  return { letter: 'ب', next: 'بسم', where: `basmalah of sūrah ${Number(sura) + 1}` };
}

/**
 * The first letter of the word that follows `phrase` at `sura:aya`, or null
 * with a reason. The WHOLE phrase must stand in the āyah, word after word —
 * a sheet that cites عَلَيۡهِم مُّؤۡصَدَةٌ at 90:20 (where the text is عَلَيۡهِمۡ نَارٞ
 * مُّؤۡصَدَةٌ) is caught, not silently matched on its last word. When the cited
 * āyah does not hold it, the whole Qurʾān is searched: a single occurrence is
 * used and reported as `corrected`, so the author can fix the sheet; several
 * or none leave the decision to the author. At the end of an āyah the next
 * āyah's first word is taken; at the end of a sūrah the basmalah — ب — as the
 * Mushaf itself assumes.
 */
export function letterAfter(phrase, sura, aya) {
  const { ayat } = load();
  const parts = phrase.trim().split(/\s+/).map(skeleton);
  const words = ayat.get(`${sura}:${aya}`);
  if (words) {
    const hits = phraseAt(skelOf(sura, aya, words), parts);
    if (hits.length === 1) return after(sura, aya, hits[0]);
    if (hits.length > 1) return { letter: null, why: `"${phrase}" occurs ${hits.length} times in ${sura}:${aya}` };
  }
  // Not where the sheet says: look everywhere.
  const found = [];
  for (const [key, ws] of ayat) {
    const [s, a] = key.split(':').map(Number);
    for (const i of phraseAt(skelOf(s, a, ws), parts)) found.push({ s, a, i });
  }
  if (found.length === 1) {
    const f = found[0];
    return { ...after(f.s, f.a, f.i), corrected: `${f.s}:${f.a}`, cited: words ? `${sura}:${aya}` : `${sura}:${aya} (no such āyah)` };
  }
  if (!found.length) return { letter: null, why: `"${phrase}" is not at ${sura}:${aya} and was not found anywhere in the Qurʾān` };
  return { letter: null, why: `"${phrase}" is not at ${sura}:${aya}; it occurs at ${found.map((f) => `${f.s}:${f.a}`).join(', ')} — say which` };
}
