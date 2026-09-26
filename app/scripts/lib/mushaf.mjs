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
  arabic.replace(/[^ء-يٱ]/g, '').replace(/ٱ/g, 'ا').replace(/ى/g, 'ي');

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
export function letterAfter(phrase, sura, aya) {
  const { ayat, lastAya } = load();
  const words = ayat.get(`${sura}:${aya}`);
  if (!words) return { letter: null, why: `no āyah ${sura}:${aya} in the corpus` };
  const parts = phrase.trim().split(/\s+/).map(skeleton);
  const last = parts[parts.length - 1];
  const before = parts[parts.length - 2];
  const skel = words.map((w) => skeleton(fromBuckwalter(w)));
  let hits = skel.map((s, i) => (s === last ? i : -1)).filter((i) => i >= 0);
  // A sheet may quote a word without its clitic — ٱلۡمُنۡخَنِقَةُ for وَٱلۡمُنۡخَنِقَةُ.
  if (!hits.length) hits = skel.map((s, i) => (s.endsWith(last) && s.length - last.length <= 2 ? i : -1)).filter((i) => i >= 0);
  if (hits.length > 1 && before) hits = hits.filter((i) => i > 0 && (skel[i - 1] === before || skel[i - 1].endsWith(before)));
  if (hits.length !== 1) {
    return { letter: null, why: hits.length ? `"${last}" occurs ${hits.length} times in ${sura}:${aya}` : `"${last}" not found in ${sura}:${aya} [${skel.join(' ')}]` };
  }
  const i = hits[0];
  if (i + 1 < words.length) return { letter: firstLetter(words[i + 1]), next: fromBuckwalter(words[i + 1]), where: `${sura}:${aya} word ${i + 2}` };
  if (aya < (lastAya.get(String(sura)) ?? 0)) {
    const nextWords = ayat.get(`${sura}:${aya + 1}`);
    return { letter: firstLetter(nextWords[0]), next: fromBuckwalter(nextWords[0]), where: `${sura}:${aya + 1} word 1` };
  }
  if (Number(sura) === 114) return { letter: null, why: 'the end of the Qurʾān' };
  return { letter: 'ب', next: 'بسم', where: `basmalah of sūrah ${Number(sura) + 1}` };
}
