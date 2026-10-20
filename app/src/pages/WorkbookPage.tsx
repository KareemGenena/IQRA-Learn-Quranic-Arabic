import { useEffect, useMemo, useState } from 'react';
import { ArabicWord } from '../components/ArabicWord';
import { ItemCard } from '../components/ItemCard';
import { ReadingSwitch } from '../components/ReadingSwitch';
import { derivedSilent, splitClusters } from '../lib/graphemes';
import { loadWorkbook, pdfUrl } from '../lib/workbookData';
import type { WorkbookItem, WorkbookLevel } from '../lib/workbookData';
import type { Lesson, LessonItem, Playable, Reading } from '../types';

/**
 * The workbook companion — the electronic side of the paper.
 *
 * One app page per workbook page, in the paper's own order, every item on it
 * with Play where a clip exists: a learner tracing page 14 opens page 14 and
 * hears each word they are writing. Not a lesson and not paged into
 * sittings; the sequence is the book's. The QR on a section opener (not yet
 * printed) and `/go/<section id>` on the landing site land on the section's
 * first page here.
 *
 * Addresses carry the PRINTED page number, the one in the footer a learner
 * is looking at; the PDF link uses the physical page (cover = 1).
 */
const LEVELS = [1, 2, 3];

export function WorkbookIndex() {
  const [levels, setLevels] = useState<(WorkbookLevel | null)[]>([null, null, null]);

  useEffect(() => {
    let alive = true;
    Promise.all(LEVELS.map((l) => loadWorkbook(l).catch(() => null))).then((r) => alive && setLevels(r));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="home workbook-index">
      <p className="home-intro">
        Every page of the practice workbooks, with each word said aloud. Open the page you are on
        and tap any word.
      </p>
      {levels.map((lv, i) => (
        <section key={i} className="level-section">
          <h3>Workbook Level {i + 1}</h3>
          {!lv && <p className="loading">Loading…</p>}
          {lv && (
            <ul className="lesson-list">
              {lv.sections
                .filter((s) => s.firstPage)
                .map((s) => {
                  const pages = lv.pages.filter((p) => p.section === s.id);
                  const items = pages.flatMap((p) => p.items);
                  const recorded = items.filter((it) => it.audio).length;
                  const first = pages[0]?.printed ?? 0;
                  const last = pages[pages.length - 1]?.printed ?? first;
                  return (
                    <li key={s.id}>
                      <a className="lesson-card" href={`#/workbook/${lv.level}/${first}`}>
                        <span className="lesson-no">{s.n}</span>
                        <span className="lesson-body">
                          <span className="lesson-title">{s.title}</span>
                          <span className="lesson-blurb">
                            {first === last ? `Page ${first}` : `Pages ${first}–${last}`} · {items.length} words ·{' '}
                            {recorded} with audio
                          </span>
                        </span>
                        <span className="lesson-go" aria-hidden="true">
                          ›
                        </span>
                      </a>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}

/** A lesson stub carrying what a card needs to find and time a clip: the
 *  folder and the lesson id its calibrations are keyed on. */
function lessonFor(item: WorkbookItem): Lesson {
  const a = item.audio!;
  return { lesson: a.lesson, title: '', titleArabic: '', audioPath: a.path, kind: 'letters', words: [] };
}

function toItem(item: WorkbookItem, no: number): LessonItem {
  const a = item.audio!;
  const playable: Playable = {
    key: a.key,
    text: item.text,
    audio: a.file,
    timings: null,
    silentClusters: derivedSilent(item.text),
    prefixClusters: 0,
    stop: a.stopFile ? { audio: a.stopFile, timings: null } : undefined,
    waqf: a.waqf,
    waqfMadd: a.waqfMadd,
    letterNames: a.letterNames,
    dimFinalMark: a.dimFinalMark,
  };
  return { id: no, section: 'workbook', badges: item.caption ? [item.caption] : [], forms: [playable] };
}

/** An item nothing has been recorded for yet: the word, drawn, and said so. */
function SilentCard({ item, no }: { item: WorkbookItem; no: number }) {
  const clusters = useMemo(() => splitClusters(item.text), [item.text]);
  const silent = useMemo(() => derivedSilent(item.text), [item.text]);
  return (
    <div className="pair-card workbook silent">
      <div className="pair-head">
        <span className="word-num">{no}</span>
        {item.caption && (
          <span
            className={`type-badge${/●/.test(item.caption) ? ' badge-dots' : ''}`}
            dir={/●/.test(item.caption) ? 'rtl' : undefined}
          >
            {item.caption}
          </span>
        )}
      </div>
      <div className="pair-forms">
        <div className="form-slot">
          <div className="form-btn static">
            <ArabicWord text={item.text} clusters={clusters} activeIndex={null} silentClusters={silent} prefixClusters={0} />
          </div>
          <span className="not-recorded">Not yet recorded</span>
        </div>
      </div>
    </div>
  );
}

export function WorkbookPage({
  level,
  printed,
  section,
  rate,
  reading,
  setReading,
}: {
  level: number;
  /** The page to show, by its printed number. */
  printed: number;
  /** Or a section to open at its first page (the QR's landing). */
  section?: number;
  rate: number;
  reading: Reading;
  setReading: (r: Reading) => void;
}) {
  const [data, setData] = useState<WorkbookLevel | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(false);
    loadWorkbook(level)
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [level]);

  // A section address resolves to its first page, replacing itself so Back
  // does not return to the redirect.
  useEffect(() => {
    if (!data || !section) return;
    const s = data.sections.find((x) => x.n === section);
    const first = s?.firstPage ? data.pages.find((p) => p.physical === s.firstPage) : undefined;
    window.location.replace(first ? `#/workbook/${level}/${first.printed}` : '#/workbook');
  }, [data, section, level]);

  if (error) {
    return (
      <p className="loading">
        Could not load this workbook. Please reload. <a href="#/workbook">All workbook pages</a>
      </p>
    );
  }
  if (!data || section) return <p className="loading">Loading…</p>;

  const idx = data.pages.findIndex((p) => p.printed === printed);
  if (idx < 0) {
    return (
      <p className="loading">
        There is no page {printed} in Workbook Level {level}. <a href="#/workbook">All workbook pages</a>
      </p>
    );
  }
  const page = data.pages[idx];
  const sec = data.sections.find((s) => s.id === page.section);
  const lastPrinted = data.pages[data.pages.length - 1].printed;
  const go = (i: number) => {
    const target = data.pages[Math.min(Math.max(i, 0), data.pages.length - 1)];
    window.location.hash = `#/workbook/${level}/${target.printed}`;
  };

  return (
    <main className="pairs-lesson workbook-page">
      <div className="toolbar">
        <p className="workbook-where">
          Workbook Level {level} · page {printed}
          {sec ? ` · Section ${sec.n}` : ''}
        </p>
        <ReadingSwitch reading={reading} setReading={setReading} />
      </div>

      <section className="section-head workbook">
        <h3>
          {sec?.title ?? 'Workbook'}
          {page.part ? ` — ${page.part}` : ''}
        </h3>
        {/* The workbook's own line here is a tracing instruction; the app's
            page is for listening. */}
        <p className="section-hint">Tap any word to hear it. The tracing is on the page.</p>
      </section>

      <div className="workbook-links">
        <a className="workbook-btn" href={pdfUrl(data, page.physical)} target="_blank" rel="noopener">
          <span className="workbook-text">
            <span className="workbook-main">Open page {printed} of the PDF</span>
            <span className="workbook-sub">The printed page, for tracing</span>
          </span>
        </a>
      </div>

      {page.items.length === 0 && <p className="loading">Nothing to say aloud on this page.</p>}
      <div className="pair-grid">
        {page.items.map((it, i) =>
          it.audio ? (
            <ItemCard
              key={it.id}
              lesson={lessonFor(it)}
              item={toItem(it, i + 1)}
              rate={rate}
              displayNo={i + 1}
              reading={reading}
            />
          ) : (
            <SilentCard key={it.id} item={it} no={i + 1} />
          ),
        )}
      </div>

      <nav className="pager" aria-label="Workbook pages">
        <button type="button" className="btn nav-btn" onClick={() => go(idx - 1)} disabled={idx === 0}>
          Back
        </button>
        <select
          className="btn page-select"
          aria-label="Go to page"
          value={idx}
          onChange={(e) => go(Number(e.target.value))}
        >
          {data.pages.map((p, i) => (
            <option key={p.physical} value={i}>
              p. {p.printed} · {data.sections.find((s) => s.id === p.section)?.title ?? ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn nav-btn"
          onClick={() => go(idx + 1)}
          disabled={idx === data.pages.length - 1}
        >
          Next
        </button>
      </nav>
      <p className="page-status" aria-live="polite">
        Page {printed} of {lastPrinted}
      </p>
    </main>
  );
}
