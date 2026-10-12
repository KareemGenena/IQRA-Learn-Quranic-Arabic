/**
 * Finding the take that belongs to a piece of text — the one rule for every
 * generator and for the stop readings.
 *
 * A take's filename is derived from its row's text (src/lib/audioName.ts),
 * two ways. Stripped of its marks — `جئت.wav` — which is how the author types
 * a lesson's takes and is unambiguous inside a lesson whose words differ by
 * their letters. Or with its marks kept — `بَ.wav`, `بُ.wav` — which is what
 * the intake page writes for a sheet whose rows differ ONLY by their marks
 * (harakat, tanween, the workbook), because stripped they would all be one
 * file. So a lookup tries the exact text first, then the stripped key, and
 * trusts the key only where it belongs to one row of the sheet: the first
 * workbook companion keyed صَبَرَ to صَبۡرِ and played the wrong word
 * (2026-10-11). A trailing number is a take number, never part of the word,
 * and the highest wins.
 */
import { existsSync, readdirSync } from 'fs';

/** Same as `audioKey` in src/lib/audioName.ts: marks off, ٱ → ا. */
const MARKS = /[ً-ٰۖ-ۭـࣰ-ࣲ]/g;
export const key = (s) => s.replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/\s+/g, ' ').trim();
/** The text itself, marks and all. */
export const exact = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

/** The takes in a folder, by exact name and by stripped key; latest take wins. */
export function takesOf(dir, keyFn = key) {
  const byExact = new Map();
  const byKey = new Map();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.wav')) continue;
      const m = /^(.*?)(?:\s+(\d+))?$/.exec(f.replace(/\.wav$/i, ''));
      const take = m[2] ? Number(m[2]) : 0;
      const put = (map, k) => {
        const cur = map.get(k);
        if (!cur || take > cur.take) map.set(k, { file: f, take });
      };
      put(byExact, exact(m[1]));
      put(byKey, keyFn(m[1]));
    }
  }
  return { byExact, byKey, dir };
}

/** How many texts of a sheet share each stripped key. */
export function keyCounts(texts, keyFn = key) {
  const counts = new Map();
  for (const t of texts) counts.set(keyFn(t), (counts.get(keyFn(t)) ?? 0) + 1);
  return counts;
}

/**
 * The take for a text: exact name first; else the stripped name, only when
 * that key belongs to one text of the sheet. `ambiguous` collects the files
 * that could not be placed, for the run's report.
 */
export function findTake(takes, text, counts, { keyFn = key, ambiguous } = {}) {
  const hit = takes.byExact.get(exact(text));
  if (hit) return hit;
  const k = keyFn(text);
  const loose = takes.byKey.get(k);
  if (!loose) return undefined;
  if ((counts.get(k) ?? 1) === 1) return loose;
  ambiguous?.add(`${loose.file} could be any of ${counts.get(k)} rows keyed ${k} — name it with its marks`);
  return undefined;
}
