import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ItemCard } from '../components/ItemCard';
import { stopActivePlayback } from '../lib/playback';
import { sectionKey, toItems } from '../lib/lessons';
import type { Lesson, LessonItem, LessonSection } from '../types';

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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
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

export function SectionedLesson({ lesson, rate }: { lesson: Lesson; rate: number }) {
  const pages = useMemo(() => buildPages(lesson), [lesson]);
  const [pageNo, setPageNo] = useState(0);
  const [playingAll, setPlayingAll] = useState(false);
  const [showContents, setShowContents] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const playersRef = useRef(new Map<string, () => Promise<void>>());
  const cancelAllRef = useRef(false);

  const page = pages[pageNo];

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
      if (e.key === 'ArrowRight') goto(pageNo + 1);
      else if (e.key === 'ArrowLeft') goto(pageNo - 1);
      else if (/^[1-9]$/.test(e.key)) {
        const item = page.items[Number(e.key) - 1];
        const form = item?.forms[e.shiftKey && item.forms[1] ? 1 : 0];
        if (form) void playersRef.current.get(form.key)?.();
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
    ? (lesson.quizHint ?? 'No labels this time — listen and decide for yourself.')
    : (page.section?.hint ?? '');

  return (
    <main className="pairs-lesson">
      <section className={`section-head ${page.quiz ? 'quiz' : sectionKey(page.section ?? {})}`}>
        <h3 ref={headingRef} tabIndex={-1}>
          {heading}
          <span className="section-ar" dir="rtl" lang="ar">
            {headingArabic}
          </span>
        </h3>
        <p className="section-hint">{hint}</p>
      </section>

      <div className="pair-grid">
        {page.items.map((item, i) => (
          <ItemCard
            key={item.id}
            lesson={lesson}
            item={item}
            rate={rate}
            displayNo={i + 1}
            register={register}
            hideBadges={page.quiz}
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
      <p className="kbd-hint">
        Keyboard: <kbd>←</kbd> <kbd>→</kbd> change page, <kbd>1</kbd>–<kbd>4</kbd> play a word,
        <kbd>Shift</kbd>+number plays it with ال.
      </p>
    </main>
  );
}
