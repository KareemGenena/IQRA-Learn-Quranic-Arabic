import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PairCard } from '../components/PairCard';
import { stopActivePlayback } from '../lib/playback';
import type { Lesson, LessonSection, PairWord } from '../types';

interface Page {
  words: PairWord[];
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

function buildPages(lesson: Lesson): Page[] {
  const perPage = lesson.perPage ?? 4;
  const words = lesson.words as PairWord[];
  const pages: Page[] = [];

  for (const section of lesson.sections ?? []) {
    const group = words.filter((w) => w.type === section.type);
    const chunks: PairWord[][] = [];
    for (let i = 0; i < group.length; i += perPage) chunks.push(group.slice(i, i + perPage));
    chunks.forEach((chunk, i) =>
      pages.push({ words: chunk, section, indexInGroup: i + 1, groupSize: chunks.length }),
    );
  }

  // Mixed review: an equal handful of each type, interleaved so the learner
  // can't coast on the pattern of the page.
  const size = lesson.quizSize ?? 0;
  if (size > 0 && (lesson.sections?.length ?? 0) > 1) {
    const picks = (lesson.sections ?? []).map((s) =>
      spread(words.filter((w) => w.type === s.type), size),
    );
    const mixed: PairWord[] = [];
    for (let i = 0; i < size; i++) for (const p of picks) if (p[i]) mixed.push(p[i]);
    const chunks: PairWord[][] = [];
    for (let i = 0; i < mixed.length; i += perPage) chunks.push(mixed.slice(i, i + perPage));
    chunks.forEach((chunk, i) =>
      pages.push({ words: chunk, quiz: true, indexInGroup: i + 1, groupSize: chunks.length }),
    );
  }

  return pages;
}

export function PairsLesson({ lesson, rate }: { lesson: Lesson; rate: number }) {
  const pages = useMemo(() => buildPages(lesson), [lesson]);
  const [pageNo, setPageNo] = useState(0);
  const [playingAll, setPlayingAll] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const playersRef = useRef(new Map<string, () => Promise<void>>());
  const cancelAllRef = useRef(false);

  const page = pages[pageNo];

  const register = useCallback((key: string, play: () => Promise<void>) => {
    playersRef.current.set(key, play);
  }, []);

  const goto = useCallback(
    (n: number) => {
      cancelAllRef.current = true;
      stopActivePlayback();
      setPlayingAll(false);
      playersRef.current.clear();
      setPageNo(Math.min(Math.max(n, 0), pages.length - 1));
    },
    [pages.length],
  );

  // Move focus to the new page's heading so screen readers and keyboard users
  // land in the right place instead of staying on a button that moved.
  useEffect(() => {
    headingRef.current?.focus();
  }, [pageNo]);

  const playAll = useCallback(async () => {
    if (playingAll) {
      cancelAllRef.current = true;
      stopActivePlayback();
      setPlayingAll(false);
      return;
    }
    cancelAllRef.current = false;
    setPlayingAll(true);
    for (const word of page.words) {
      for (const key of [`${word.id}a`, `${word.id}b`]) {
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
      if (e.key === 'ArrowRight') goto(pageNo + 1);
      else if (e.key === 'ArrowLeft') goto(pageNo - 1);
      else if (/^[1-9]$/.test(e.key)) {
        const word = page.words[Number(e.key) - 1];
        if (word) void playersRef.current.get(`${word.id}${e.shiftKey ? 'b' : 'a'}`)?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, pageNo, page]);

  useEffect(() => () => {
    cancelAllRef.current = true;
    stopActivePlayback();
  }, []);

  if (!page) return <p className="loading">This lesson has no pages yet.</p>;

  const heading = page.quiz ? 'Mixed Review' : (page.section?.title ?? '');
  const headingArabic = page.quiz ? 'مراجعة' : (page.section?.titleArabic ?? '');
  const hint = page.quiz
    ? 'No labels this time — listen and decide whether the ل is spoken or silent.'
    : (page.section?.hint ?? '');

  return (
    <main className="pairs-lesson">
      <section className={`section-head ${page.quiz ? 'quiz' : page.section?.type}`}>
        <h3 ref={headingRef} tabIndex={-1}>
          {heading}
          <span className="section-ar" dir="rtl" lang="ar">
            {headingArabic}
          </span>
        </h3>
        <p className="section-hint">{hint}</p>
      </section>

      <div className="pair-grid">
        {page.words.map((word, i) => (
          <PairCard
            key={word.id}
            lesson={lesson}
            word={word}
            rate={rate}
            displayNo={i + 1}
            register={register}
            hideType={page.quiz}
          />
        ))}
      </div>

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

      <p className="page-status" aria-live="polite">
        {heading} — page {page.indexInGroup} of {page.groupSize}
        <span className="page-total"> (screen {pageNo + 1} of {pages.length})</span>
      </p>
      <p className="kbd-hint">
        Keyboard: <kbd>←</kbd> <kbd>→</kbd> change page, <kbd>1</kbd>–<kbd>4</kbd> play a word,
        <kbd>Shift</kbd>+number plays it with ال.
      </p>
    </main>
  );
}
