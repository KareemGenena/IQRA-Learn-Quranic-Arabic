/**
 * The Level checks — lessons 41, 42, 43, one at the end of each Level.
 *
 *   node scripts/make-assessments.mjs            all three
 *   node scripts/make-assessments.mjs 2          one level
 *
 * A check is advice, never a gate: "ready for the next Level", or "revisit
 * lesson N". Its items are drawn from the Level's own lessons, so a check
 * needs no recording of its own and no authoring; the author's paper Maktab
 * instrument stays separate (CLAUDE.md §4) and this does not pretend to be
 * it. Two item kinds, both from the paper's Part A and Part C:
 *
 *   hear  — a clip plays; four words show; point to the one you heard.
 *           Distractors come from the same lesson, the same section where
 *           it has one.
 *   rule  — a word shows and plays; name its rule. Only from lessons whose
 *           cards each carry one rule (`RULE_OF` below).
 *
 * Only clips that exist on disk are used, so a Level whose lessons are not
 * recorded yet gets an empty check and the page says so. Sampling is seeded
 * by the Level, so a re-run with the same recordings gives the same check.
 * Writes `public/lessons/lesson4N/words.json`. Never hand-edit it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const PUB = join(here, '..', 'public');
const HEAR = 14;
const RULE = 6;

/** How a lesson's card names its rule, where every card has one. */
const RULE_OF = {
  2: (w) => (w.type === 'shamsiyya' ? 'Sun lam — the ل is silent' : 'Moon lam — the ل is said'),
  7: (w) => w.badges?.[0],
};

/** The registry, read from lessons.ts the way make-crosswalk.mjs does. */
function registry() {
  const src = readFileSync(join(here, '..', 'src', 'lib', 'lessons.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const LESSONS'), src.indexOf('export function orderedLessons'));
  const out = [];
  for (const m of body.matchAll(/\{(?:\s*\/\/[^\n]*)*\s*id:\s*(\d+)[\s\S]*?\}/g)) {
    const id = Number(m[1]);
    const level = Number((m[0].match(/level:\s*(\d)/) ?? [])[1] ?? 0);
    const title = (m[0].match(/title:\s*'([^']*)'/) ?? [])[1] ?? '';
    const check = /check:\s*true/.test(m[0]);
    out.push({ id, level, title, check });
  }
  return out;
}

/** Seeded, so a re-run is the same check. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, r) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Every recorded form of a lesson, as the check can use it. */
function poolOf(n) {
  const p = join(PUB, 'lessons', `lesson${String(n).padStart(2, '0')}`, 'words.json');
  if (!existsSync(p)) return [];
  const lesson = JSON.parse(readFileSync(p, 'utf8'));
  if (lesson.song || lesson.kind === 'assessment') return [];
  if (lesson.words.some((w) => w.letter !== undefined || w.place !== undefined)) return []; // letter cards: whole teacher lines
  const out = [];
  const add = (text, file, key, w, section) => {
    if (!text || !file || !existsSync(join(PUB, lesson.audioPath, file))) return;
    if (w.waqf) return; // a reading at a stop: not the word as the lesson teaches it
    out.push({
      lesson: n,
      id: w.id,
      key,
      text,
      section: section ?? '',
      rule: RULE_OF[n]?.(w) ?? null,
      audio: { lesson: n, path: lesson.audioPath, file, key },
    });
  };
  for (const w of lesson.words) {
    if (w.arabic !== undefined) add(w.arabic, w.audio, String(w.id), w, 'words');
    if (w.bare) {
      add(w.bare.text, w.bare.audio, `${w.id}a`, w, w.type);
      add(w.withAl.text, w.withAl.audio, `${w.id}b`, w, w.type);
    }
    if (w.forms) w.forms.forEach((f, i) => add(f.text, f.audio, `${w.id}${'abcdefgh'[i] ?? i}`, w, w.section));
    else if (w.text !== undefined) add(w.text, w.audio, String(w.id), w, w.section);
  }
  return out;
}

const levels = process.argv.slice(2).map(Number).filter(Boolean);
const reg = registry();
for (const L of levels.length ? levels : [1, 2, 3]) {
  const r = rng(1447 + L);
  const lessons = reg.filter((l) => l.level === L && !l.check);
  const pools = lessons.map((l) => ({ ...l, pool: poolOf(l.id) })).filter((l) => l.pool.length > 0);

  // hear: spread across the recorded lessons, round-robin, each lesson's
  // words in a seeded order; a word is used once.
  const queues = pools.map((l) => ({ l, q: shuffle(l.pool, r) }));
  const hear = [];
  while (hear.length < HEAR && queues.some((x) => x.q.length)) {
    for (const x of queues) {
      if (hear.length >= HEAR) break;
      const w = x.q.shift();
      if (!w) continue;
      const same = x.l.pool.filter((o) => o.text !== w.text && o.section === w.section);
      const other = x.l.pool.filter((o) => o.text !== w.text && o.section !== w.section);
      const distractors = shuffle(same, r).slice(0, 3);
      for (const o of shuffle(other, r)) if (distractors.length < 3 && !distractors.some((d) => d.text === o.text)) distractors.push(o);
      if (distractors.length < 3) continue; // too small a lesson to point into
      const options = shuffle([w, ...distractors].map((o) => o.text), r);
      hear.push({
        id: hear.length + 1,
        type: 'hear',
        text: w.text,
        audio: w.audio,
        options,
        answer: options.indexOf(w.text),
        source: { lesson: w.lesson, id: w.id },
      });
    }
  }

  // rule: from lessons with a rule per card and at least two rules.
  const rule = [];
  for (const x of pools) {
    const rules = [...new Set(x.pool.map((w) => w.rule).filter(Boolean))];
    if (rules.length < 2 || rules.length > 6) continue;
    const used = new Set(hear.map((h) => `${h.source.lesson}:${h.text}`));
    for (const w of shuffle(x.pool.filter((w) => w.rule && !used.has(`${w.lesson}:${w.text}`)), r)) {
      if (rule.length >= RULE) break;
      rule.push({
        id: 0,
        type: 'rule',
        text: w.text,
        audio: w.audio,
        options: rules,
        answer: rules.indexOf(w.rule),
        source: { lesson: w.lesson, id: w.id },
      });
    }
  }
  const items = [...hear, ...rule].map((it, i) => ({ ...it, id: i + 1 }));

  const n = 40 + L;
  const out = {
    lesson: n,
    title: `Level ${L} Check`,
    titleArabic: `اختبار المستوى ${L}`,
    kind: 'assessment',
    audioPath: '',
    level: L,
    items,
    words: [],
  };
  const dir = join(PUB, 'lessons', `lesson${n}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'words.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(
    `Level ${L} check (lesson ${n}): ${hear.length} hear-and-point + ${rule.length} which-rule from ${pools.map((p) => `${p.id} (${p.pool.length})`).join(', ') || 'nothing recorded yet'}`,
  );
}
