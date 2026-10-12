/**
 * Stop readings — the same word recorded as it is read when you stop on it:
 * the final vowel dropped, ة heard as ه, a madd before the last letter held.
 *
 * The rule (CLAUDE.md, "Audio"): a stop take lives in a `وقف/` subfolder of
 * the lesson's audio folder under the SAME derived filename as the continuing
 * take — the intake page writes it there when its Reading is set to "at a
 * stop" — so nothing about naming changes, and lesson 6's `<word> وقف` tag in
 * the main folder (one take said three ways) keeps its own meaning. Every
 * generator calls `attachStops` once, after its cards are assembled and
 * before words.json is written: each form whose text matches a stop take
 * gains `stop: { audio, timings }`, the clip cut beside the continuing one as
 * `<clip>-waqf.wav`. The app times it with `waqf: true` and calibrates it
 * under the form's key + "-waqf". Matching is `takes.mjs`'s rule: the exact
 * text first, the stripped key only where it is one row's.
 */
import { join } from 'path';
import { readWav, splitIntoN, writeSegment } from './wav.mjs';
import { findTake, keyCounts, takesOf } from './takes.mjs';

export const STOP_DIR = 'وقف';

/** Every recorded form in a lesson, whatever its shape — the same walk the
 *  app's `lessons.ts` makes into Playables. */
function* formsOf(lesson) {
  for (const w of lesson.words) {
    if (w.arabic !== undefined) yield w; // lesson 1: one word, one clip
    if (w.bare) {
      yield w.bare; // lesson 2: bare and with ال
      yield w.withAl;
    }
    if (w.forms) for (const f of w.forms) yield f; // several forms on one card
    else if (w.text !== undefined && w.audio) yield w; // one form
  }
}

/**
 * Attach every stop take found in `<audioSrc>/وقف/` to the form it belongs
 * to, cutting the clip into `audioOut`. `key` is the generator's own
 * filename key — the same de-diacritizing the main folder is matched by.
 * Reports what was attached and what matched no row; a misnamed file is
 * otherwise invisible.
 */
export function attachStops(lesson, audioSrc, audioOut, key) {
  const dir = join(audioSrc, STOP_DIR);
  const takes = takesOf(dir, key);
  if (takes.byExact.size === 0) {
    console.log(`STOP READINGS: none — no ${STOP_DIR}/ takes beside the recordings`);
    return;
  }
  const texts = [...formsOf(lesson)].map((f) => f.arabic ?? f.text).filter(Boolean);
  const counts = keyCounts(texts, key);
  const ambiguous = new Set();
  const used = new Set();
  let n = 0;
  for (const form of formsOf(lesson)) {
    const text = form.arabic ?? form.text;
    if (!text || !form.audio) continue;
    const hit = findTake(takes, text, counts, { keyFn: key, ambiguous });
    if (!hit) continue;
    const wav = readWav(join(dir, hit.file));
    const { segments } = splitIntoN(wav, 1);
    const seg = segments[0];
    const audio = form.audio.replace(/\.wav$/i, '-waqf.wav');
    writeSegment(wav, seg[0], seg[1], join(audioOut, audio), { mono: true });
    form.stop = { audio, timings: null };
    used.add(hit.file);
    n += 1;
  }
  const unused = [...takes.byExact.values()].map((v) => v.file).filter((f) => !used.has(f));
  console.log(`STOP READINGS: ${n} attached from ${STOP_DIR}/`);
  if (unused.length) console.log(`  ${STOP_DIR}/ takes matching no row: ${unused.join(', ')}`);
  if (ambiguous.size) console.log(`  ${STOP_DIR}/ AMBIGUOUS, not used: ${[...ambiguous].join('; ')}`);
}
