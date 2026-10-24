import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { ItemCard } from '../components/ItemCard';
import { stopActivePlayback } from '../lib/playback';
import { sectionKey, toItems } from '../lib/lessons';
import { Mixed } from '../components/Mixed';
import { markDone } from '../lib/progress';
import type { Lesson, LessonItem, LessonSection, Reading } from '../types';

interface Page {
  items: LessonItem[];
  section?: LessonSection;
  quiz?: boolean;
  /** 1-based index within this section/quiz, for "Moon Lam 2 of 9". */
  indexInGroup: number;
  groupSize: number;
}

/** Evenly spread `count` picks across a list, so the quiz isn't all from the start. */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)]);
}

/**
 * Screens of up to `size` cards that never split a pair. A card may name
 * its `pair` — the two boxes of one row of the paper, or the two words of
 * one column group — and consecutive cards sharing one are a run that goes
 * whole onto the next screen when it does not fit: a screen of five rather
 * than a pair broken across two screens, where on a phone the second half
 * would sit alone at the top of the next (the author, 2026-10-24). A run
 * longer than a screen is split as before.
 */
function chunk(items: LessonItem[], size: number): LessonItem[][] {
  const runs: LessonItem[][] = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    if (it.pair && last && last[0].pair === it.pair) last.push(it);
    else runs.push([it]);
  }
  const out: LessonItem[][] = [];
  let cur: LessonItem[] = [];
  for (const run of runs) {
    if (cur.length && cur.length + run.length > size) {
      out.push(cur);
      cur = [];
    }
    if (run.length > size) {
      for (let i = 0; i < run.length; i += size) out.push(run.slice(i, i + size));
      continue;
    }
    cur.push(...run);
  }
  if (cur.length) out.push(cur);
  return out;
}

function buildPages(lesson: Lesson): Page[] {
  const perPage = lesson.perPage ?? 4;
  const items = toItems(lesson);
  const pages: Page[] = [];

  for (const section of lesson.sections ?? []) {
    const key = sectionKey(section);
    const group = items.filter((it) => it.section === key);
    const chunks = chunk(group, perPage);
    chunks.forEach((c, i) =>
      pages.push({ items: c, section, indexInGroup: i + 1, groupSize: chunks.length }),
    );
  }

  // Mixed review: an equal handful from each section, interleaved so the
  // learner can't coast on the pattern of the page.
  const size = lesson.quizSize ?? 0;
  if (size > 0 && (lesson.sections?.length ?? 0) > 1) {
    const picks = (lesson.sections ?? []).map((s) =>
      spread(items.filter((it) => it.section === sectionKey(s)), size),
    );
    const mixed: LessonItem[] = [];
    for (let i = 0; i < size; i++) for (const p of picks) if (p[i]) mixed.push(p[i]);
    const chunks = chunk(mixed, perPage);
    chunks.forEach((c, i) =>
      pages.push({ items: c, quiz: true, indexInGroup: i + 1, groupSize: chunks.length }),
    );
  }

  return pages;
}

/**
 * Where the learner had got to, per lesson, kept across visits.
 *
 * Someone working hands-free should not have to walk back to their place
 * every time they open a lesson.
 */
const placeKey = (lessonId: number) => `iqra-place-lesson${lessonId}`;

/** -1 means "not started here yet", so the first Next plays the first word. */
const NOT_STARTED = -1;

/** How long the "pick up where you left off" bubble stays, unless a tap or a
 *  key elsewhere takes it away first. */
const RESUME_MS = 6000;

function readPlace(lessonId: number): { page: number; step: number } {
  try {
    const raw = localStorage.getItem(placeKey(lessonId));
    const parsed = raw ? (JSON.parse(raw) as { page?: number; step?: number }) : null;
    return { page: Math.max(0, parsed?.page ?? 0), step: parsed?.step ?? NOT_STARTED };
  } catch {
    return { page: 0, step: NOT_STARTED };
  }
}

/** What a card component receives — ItemCard's props, and LetterCard's. */
export interface CardProps {
  lesson: Lesson;
  item: LessonItem;
  rate: number;
  displayNo: number;
  register?: (key: string, play: () => Promise<void>, playOther?: () => Promise<void>) => void;
  hideBadges?: boolean;
  reading?: Reading;
}

export function SectionedLesson({
  lesson,
  rate,
  /** The card to render. A letters lesson swaps in LetterCard and keeps every
   *  bit of the navigation — paging, the remembered place, the single-key
   *  walk — which is the point of not writing a second lesson page. */
  Card = ItemCard,
  /** Called when Next walks off the last page: the lesson is done, and the
   *  caller decides where to go — the next lesson, for a learner driving
   *  the whole sequence by voice. */
  onEnd,
  reading,
  /** The S key: flip the page between the two readings. */
  onReadingToggle,
}: {
  lesson: Lesson;
  rate: number;
  Card?: ComponentType<CardProps>;
  onEnd?: () => void;
  reading?: Reading;
  onReadingToggle?: () => void;
}) {
  const pages = useMemo(() => buildPages(lesson), [lesson]);
  // A lesson always opens on its first page (the author's call, 2026-10-11:
  // landing part-way through read as a fault). The remembered place is
  // offered instead, once, in a bubble that goes away by itself.
  const [pageNo, setPageNo] = useState(0);
  // A remembered place can outlive the lesson it was taken in — a rebuild can
  // leave fewer pages than there were — so it is clamped, never trusted.
  const [resume, setResume] = useState<{ page: number; step: number } | null>(() => {
    const p = readPlace(lesson.lesson);
    const page = Math.min(p.page, Math.max(0, pages.length - 1));
    return page > 0 ? { page, step: p.step } : null;
  });
  /** The step to land on after a resume turns the page. */
  const resumeStep = useRef<number | null>(null);
  /** While the learner has not moved, the remembered place is left alone, so
   *  an ignored bubble does not cost the bookmark. */
  const keepPlace = useRef(resume !== null);
  const [playingAll, setPlayingAll] = useState(false);
  const [showContents, setShowContents] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const playersRef = useRef(new Map<string, () => Promise<void>>());
  /** Each word's OTHER reading, for the W key. */
  const othersRef = useRef(new Map<string, () => Promise<void>>());
  const cancelAllRef = useRef(false);
  /** How far along this page's walk the learner is, and where to resume. */
  const [step, setStep] = useState(NOT_STARTED);
  /** After a page turn, whether to land on its first word or its last. */
  const landOn = useRef<'first' | 'last' | null>(null);

  const page = pages[Math.min(pageNo, pages.length - 1)];

  /** Pages grouped by section, for the contents panel. */
  const groups = useMemo(() => {
    const out: { label: string; pages: (Page & { index: number })[] }[] = [];
    pages.forEach((p, index) => {
      const label = p.quiz ? 'Mixed Review' : (p.section?.title ?? '');
      const last = out[out.length - 1];
      if (last?.label === label) last.pages.push({ ...p, index });
      else out.push({ label, pages: [{ ...p, index }] });
    });
    return out;
  }, [pages]);

  const register = useCallback((key: string, play: () => Promise<void>, playOther?: () => Promise<void>) => {
    playersRef.current.set(key, play);
    if (playOther) othersRef.current.set(key, playOther);
    else othersRef.current.delete(key);
  }, []);

  const goto = useCallback(
    (n: number) => {
      cancelAllRef.current = true;
      stopActivePlayback();
      setPlayingAll(false);
      playersRef.current.clear();
      othersRef.current.clear();
      setPageNo(Math.min(Math.max(n, 0), pages.length - 1));
    },
    [pages.length],
  );

  // Move focus to the new page's heading so screen readers and keyboard users
  // land in the right place instead of staying on a button that moved.
  useEffect(() => {
    headingRef.current?.focus();
  }, [pageNo]);

  /**
   * Everything on this page, flattened into one reading order.
   *
   * A card holds a word said one, two or three ways, and the walk treats each
   * of those as its own stop. That is what makes Next mean the same thing in
   * every lesson: the next thing you would say out loud, whether it is the
   * next form of this word or the first form of the next one.
   */
  const sequence = useMemo(
    () =>
      (page?.items ?? []).flatMap((item, card) =>
        item.forms.map((form, form_) => ({ key: form.key, card, form: form_ })),
      ),
    [page],
  );

  const playStep = useCallback(
    (at: number) => {
      const target = sequence[at];
      if (!target) return;
      setStep(at);
      void playersRef.current.get(target.key)?.();
    },
    [sequence],
  );

  /** A number goes to that card and starts at the first way of saying it. */
  const jumpToCard = useCallback(
    (card: number) => {
      const at = sequence.findIndex((s) => s.card === card);
      if (at >= 0) playStep(at);
    },
    [sequence, playStep],
  );

  /**
   * One step along the walk, running off the end of a page into the next.
   *
   * Stopping dead at a page edge would leave someone working hands-free with
   * no way onward except a different command, so Next simply keeps going.
   */
  const walk = useCallback(
    (delta: number) => {
      // From "not started", Next lands on the very first word rather than the
      // second. The remembered step may also point past a shorter page, so it
      // is clamped before moving.
      const from = step < 0 ? NOT_STARTED : Math.min(step, sequence.length - 1);
      const at = from + delta;
      if (at >= 0 && at < sequence.length) {
        playStep(at);
        return;
      }
      const nextPage = pageNo + (delta > 0 ? 1 : -1);
      if (nextPage >= pages.length) {
        onEnd?.();
        return;
      }
      if (nextPage < 0) return;
      landOn.current = delta > 0 ? 'first' : 'last';
      goto(nextPage);
    },
    [step, sequence.length, playStep, pageNo, pages.length, goto, onEnd],
  );

  // Reaching the last page is what "done" means for the Continue card on the
  // home page — generous on purpose; see src/lib/progress.ts.
  useEffect(() => {
    if (pageNo === pages.length - 1) markDone(lesson.lesson);
  }, [pageNo, pages.length, lesson.lesson]);

  const playAll = useCallback(async () => {
    if (playingAll) {
      cancelAllRef.current = true;
      stopActivePlayback();
      setPlayingAll(false);
      return;
    }
    cancelAllRef.current = false;
    setPlayingAll(true);
    for (const item of page.items) {
      for (const key of item.forms.map((f) => f.key)) {
        if (cancelAllRef.current) break;
        await playersRef.current.get(key)?.();
        if (cancelAllRef.current) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      if (cancelAllRef.current) break;
    }
    setPlayingAll(false);
  }, [page, playingAll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Read the PHYSICAL key, not the character it produced. Holding Shift
      // changes the character: on a main row Shift+1 is "!", and on a numeric
      // keypad Shift flips NumLock so Shift+4 arrives as ArrowLeft. e.code is
      // the key itself and is the same on every layout. (e.key is kept as a
      // fallback for input that reports no code, such as some on-screen
      // keyboards.)
      const code = e.code;
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code)?.[1] ?? (/^[1-9]$/.test(e.key) ? e.key : undefined);

      // Digits are settled before the arrows, so a keypad key that calls
      // itself ArrowLeft is still treated as the 4 that is printed on it.
      if (digit) {
        jumpToCard(Number(digit) - 1);
        return;
      }

      const is = (...names: string[]) => names.includes(code) || names.includes(e.key);

      if (is('KeyN', 'ArrowDown', 'Space', 'n')) {
        e.preventDefault();
        walk(1);
      } else if (is('KeyP', 'ArrowUp', 'p')) {
        e.preventDefault();
        walk(-1);
      } else if (is('KeyS', 's')) {
        // The whole page: read on ⇄ at a stop. One key, one utterance.
        e.preventDefault();
        onReadingToggle?.();
      } else if (is('KeyW', 'w')) {
        // This word the other way (the card's tab moves with it).
        e.preventDefault();
        const at = step < 0 ? 0 : Math.min(step, sequence.length - 1);
        const key = sequence[at]?.key;
        if (key) {
          setStep(at);
          void othersRef.current.get(key)?.();
        }
      } else if (is('ArrowRight')) goto(pageNo + 1);
      else if (is('ArrowLeft')) goto(pageNo - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, pageNo, jumpToCard, walk, onReadingToggle, step, sequence]);

  // A page reached any other way — an arrow, a Back/Next button, the contents
  // list — starts from the top, so Next means the first word on it.
  //
  // The guard compares the page it last saw rather than counting renders. A
  // "have I run before?" flag looks equivalent and is not: StrictMode mounts
  // twice, the ref survives, and the second run threw away the remembered
  // place every time a lesson was opened.
  const lastPage = useRef(pageNo);
  useEffect(() => {
    if (lastPage.current === pageNo) return;
    lastPage.current = pageNo;
    if (resumeStep.current !== null) {
      // Picking up where they left off: the same page AND the same word, so
      // the next N carries on from there rather than from the page's top.
      setStep(resumeStep.current);
      resumeStep.current = null;
      return;
    }
    if (!landOn.current) setStep(NOT_STARTED);
  }, [pageNo]);

  // The bubble goes away on its own, or on any tap or key outside it.
  useEffect(() => {
    if (!resume) return;
    const timer = window.setTimeout(() => setResume(null), RESUME_MS);
    const away = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.resume-toast')) return;
      setResume(null);
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', away, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', away, true);
    };
  }, [resume]);

  const pickUp = useCallback(() => {
    if (!resume) return;
    setResume(null);
    resumeStep.current = resume.step;
    goto(resume.page);
  }, [resume, goto]);

  // After a page turn started by Next or Previous, carry on from the right
  // end of the new page rather than making the learner find their place.
  useEffect(() => {
    if (!landOn.current || !sequence.length) return;
    const at = landOn.current === 'first' ? 0 : sequence.length - 1;
    landOn.current = null;
    playStep(at);
  }, [sequence, playStep]);

  // Remember the place, so returning to a lesson can offer to resume it.
  useEffect(() => {
    // Opening on page one is not a move: the old bookmark stays until the
    // learner turns a page or plays a word.
    if (keepPlace.current && pageNo === 0 && step === NOT_STARTED) return;
    keepPlace.current = false;
    try {
      localStorage.setItem(placeKey(lesson.lesson), JSON.stringify({ page: pageNo, step }));
    } catch {
      // A full or blocked store only costs the bookmark; the lesson still works.
    }
  }, [lesson.lesson, pageNo, step]);

  useEffect(() => () => {
    cancelAllRef.current = true;
    stopActivePlayback();
  }, []);

  if (!page) return <p className="loading">This lesson has no pages yet.</p>;

  const cardCount = page.items.length;
  const maxForms = page.items.reduce((most, i) => Math.max(most, i.forms.length), 1);
  const heading = page.quiz ? 'Mixed Review' : (page.section?.title ?? '');
  const headingArabic = page.quiz ? 'مراجعة' : (page.section?.titleArabic ?? '');
  const hint = page.quiz
    ? (lesson.quizHint ?? 'No labels this time — listen and decide for yourself.')
    : (page.section?.hint ?? '');

  return (
    <main className="pairs-lesson">
      {resume && (
        <div className="resume-toast" role="status">
          <button type="button" className="btn" onClick={pickUp}>
            Pick up where you left off? Screen {resume.page + 1} of {pages.length}
          </button>
        </div>
      )}
      <section className={`section-head ${page.quiz ? 'quiz' : sectionKey(page.section ?? {})}`}>
        <h3 ref={headingRef} tabIndex={-1}>
          {heading}
          <span className="section-ar" dir="rtl" lang="ar">
            {headingArabic}
          </span>
        </h3>
        <p className="section-hint">
          <Mixed text={hint} />
        </p>
      </section>

      <div className={`pair-grid${page.section?.columns === 2 ? ' cols-2' : ''}`}>
        {page.items.map((item, i) => (
          <Card
            key={item.id}
            lesson={lesson}
            item={item}
            rate={rate}
            displayNo={i + 1}
            register={register}
            hideBadges={page.quiz}
            reading={page.section?.readings === false ? undefined : reading}
          />
        ))}
      </div>

      {showContents && (
        <nav className="contents" aria-label="Contents">
          {groups.map((g) => (
            <div key={g.label} className="contents-group">
              <h4>{g.label}</h4>
              <div className="contents-chips">
                {g.pages.map((p) => (
                  <button
                    key={p.index}
                    type="button"
                    className={`contents-chip ${p.index === pageNo ? 'current' : ''}`}
                    onClick={() => {
                      goto(p.index);
                      setShowContents(false);
                    }}
                    aria-current={p.index === pageNo ? 'page' : undefined}
                  >
                    <span className="chip-no">{p.indexInGroup}</span>
                    <span className="chip-words" dir="rtl" lang="ar">
                      {p.items.map((it) => it.forms[0].text).join('  ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}

      <nav className="pager" aria-label="Lesson pages">
        <button type="button" className="btn nav-btn" onClick={() => goto(pageNo - 1)} disabled={pageNo === 0}>
          Back
        </button>
        <button type="button" className="btn primary play-all" onClick={() => void playAll()}>
          {playingAll ? 'Stop' : 'Play all'}
        </button>
        <button
          type="button"
          className="btn nav-btn"
          onClick={() => goto(pageNo + 1)}
          disabled={pageNo === pages.length - 1}
        >
          Next
        </button>
      </nav>

      <div className="contents-bar">
        <button
          type="button"
          className="btn contents-btn"
          aria-expanded={showContents}
          onClick={() => setShowContents((v) => !v)}
        >
          {showContents ? 'Hide contents' : 'Contents'}
        </button>
      </div>

      <p className="page-status" aria-live="polite">
        {heading} — page {page.indexInGroup} of {page.groupSize}
        <span className="page-total"> (screen {pageNo + 1} of {pages.length})</span>
      </p>
      {/* Written from the page in front of you, not from the lesson: the count
          of cards and whether they hold more than one form both change between
          lessons, and a hint that describes a different lesson is worse than
          none — someone driving this by voice has no way to tell it is lying. */}
      {/* Single keys, no chords: this is read by someone speaking commands to
          an iPad, where "press N" is one utterance and Shift+number is not
          reachable at all. */}
      <p className="kbd-hint">
        Keyboard: <kbd>N</kbd> next word, <kbd>P</kbd> previous,{' '}
        {cardCount === 1 ? <kbd>1</kbd> : <><kbd>1</kbd>–<kbd>{cardCount}</kbd></>} start at that
        word, <kbd>←</kbd> <kbd>→</kbd> change page
        {onReadingToggle && (
          <>
            , <kbd>S</kbd> switch the page between read on and at a stop, <kbd>W</kbd> hear this word the
            other way
          </>
        )}
        .{maxForms > 1 && ' Next walks through every way each word is said.'}
      </p>
    </main>
  );
}
