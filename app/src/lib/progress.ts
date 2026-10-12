/**
 * What the learner has done, kept on the device.
 *
 * The home page's "Continue" card and the marks on the lesson list read it; a
 * lesson writes it. Local first, like the notes and the remembered place: an
 * account will sync it later, additively, and a learner without one keeps the
 * whole thing. It never locks anything — it says where to resume, not what
 * may be opened. Every lesson stays one tap away on the home page.
 *
 * "Done" is deliberately generous: the learner reached the lesson's last
 * page, or moved on to the next lesson from it. A learner who skips ahead is
 * where they are, and the Continue card follows them rather than nagging
 * about what they left. An assessment, when it exists, will add its own mark
 * here.
 */
const KEY = 'iqra-progress';

export interface LessonProgress {
  /** When the lesson was first opened. */
  openedAt?: number;
  /** When it was last opened — the Continue card prefers the latest. */
  lastAt?: number;
  /** When the last page was reached, or the learner moved on from it. */
  doneAt?: number;
  /** A Level check's latest result. */
  score?: { right: number; total: number; at: number };
}

/** Keyed by lesson id (a string, as JSON keys are). */
export type ProgressMap = Record<string, LessonProgress>;

export function readProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as ProgressMap) : {};
  } catch {
    return {};
  }
}

function write(map: ProgressMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // A full or blocked store only costs the bookmark; the lessons still work.
  }
}

export function markOpened(lessonId: number) {
  const map = readProgress();
  const cur = map[lessonId] ?? {};
  const now = Date.now();
  map[lessonId] = { ...cur, openedAt: cur.openedAt ?? now, lastAt: now };
  write(map);
}

export function markDone(lessonId: number) {
  const map = readProgress();
  const cur = map[lessonId] ?? {};
  if (cur.doneAt) return;
  const now = Date.now();
  map[lessonId] = { ...cur, openedAt: cur.openedAt ?? now, lastAt: cur.lastAt ?? now, doneAt: now };
  write(map);
}

/** A Level check's result — the latest attempt, whatever came before. */
export function recordScore(lessonId: number, right: number, total: number) {
  const map = readProgress();
  const cur = map[lessonId] ?? {};
  const now = Date.now();
  map[lessonId] = { ...cur, openedAt: cur.openedAt ?? now, lastAt: now, score: { right, total, at: now } };
  write(map);
}

export type ProgressState = 'done' | 'started' | 'new';

export function stateOf(map: ProgressMap, lessonId: number): ProgressState {
  const p = map[lessonId];
  if (p?.doneAt) return 'done';
  if (p?.openedAt) return 'started';
  return 'new';
}

/**
 * The lesson to continue with: the one most recently opened and not yet done,
 * else the first in reading order not yet done. Undefined once everything is
 * done.
 */
export function continueWith<T extends { id: number }>(
  ordered: T[],
  map: ProgressMap = readProgress(),
): T | undefined {
  const open = ordered
    .filter((l) => stateOf(map, l.id) === 'started')
    .sort((a, b) => (map[b.id]?.lastAt ?? 0) - (map[a.id]?.lastAt ?? 0));
  return open[0] ?? ordered.find((l) => stateOf(map, l.id) !== 'done');
}
