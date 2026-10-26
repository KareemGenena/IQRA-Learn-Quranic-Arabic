import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { workbookLinks } from '../lib/workbook';
import type { LessonStatus } from '../lib/appConfig';

/**
 * The lesson page's tools, as one row of icons at the top right: notes,
 * the workbook page(s), the laser, and for the admin a gear that opens the
 * admin links. Each icon grows its label on hover or focus; on a phone the
 * icon alone is the button. This row replaces a stack of labelled bars
 * (admin bar, workbook buttons, notes button, a floating laser pill) that
 * pushed a lesson's first card below the fold on a phone (the author,
 * 2026-10-25).
 *
 * On a phone there is no hover, so a tap on a tool that LEAVES the page —
 * notes, the workbook — first opens its label, and a second tap goes; a tap
 * anywhere else closes it again (the author, 2026-10-25: "make the click
 * expand the button … so the user can decide whether or not they want to
 * navigate away"). The laser and the gear act at once, as before; tapped
 * again they close, and their label goes with them.
 */

/** No hover: a phone or a tablet, where the first tap must not navigate. */
const noHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches === true;

const Icon = {
  notes: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13.5 8.5l2 2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2 2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 1 20 5.5v12a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 0 0-2 2 2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 17.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 6v14" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  // a pointer held at a slant, its red dot and rays at the tip — red on the
  // button, white once the button itself is red (`--laser`)
  laser: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4.5 19.5l8-8" fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M12.5 11.5l1.8-1.8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="17.6" cy="6.4" r="2.5" style={{ fill: 'var(--laser, #e11)' }} />
      <path
        d="M17.6 1.6v1.7M22.4 6.4h-1.7M21 3l-1.2 1.2M21 9.8l-1.2-1.2M17.6 9.5v1.7"
        fill="none"
        style={{ stroke: 'var(--laser, #e11)' }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.8l1.6 2.6 3-.6.8 3 2.8 1.2-1.2 2.8 1.2 2.8-2.8 1.2-.8 3-3-.6L12 21.2l-1.6-2.6-3 .6-.8-3-2.8-1.2L5 12 3.8 9.2 6.6 8l.8-3 3 .6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export function LessonTools({
  lessonId,
  notes,
  laser,
  laserOn,
  onLaser,
  admin,
  status,
}: {
  lessonId: number;
  notes: boolean;
  laser: boolean;
  laserOn: boolean;
  onLaser: () => void;
  admin: boolean;
  status: LessonStatus;
}) {
  const links = workbookLinks(lessonId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // A tap outside the row folds the label back and shuts an open menu —
  // a <details> stays open by itself until its own summary is tapped.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const bar = barRef.current;
      if (!bar || bar.contains(e.target as Node)) return;
      setExpanded(null);
      bar.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  /** On a phone the first tap on a link only opens its label. */
  const firstTapOpens = (key: string) => (e: MouseEvent) => {
    // e.detail is 0 for a click made by the keyboard: Enter on a focused
    // tool, whose label is already open, goes straight through
    if (noHover() && e.detail > 0 && expanded !== key) {
      e.preventDefault();
      setExpanded(key);
      return;
    }
    setExpanded(null);
  };

  return (
    <div className="lesson-tools" role="toolbar" aria-label="Lesson tools" ref={barRef}>
      {notes && (
        <a
          className={`tool ${expanded === 'notes' ? 'expanded' : ''}`}
          href={`#/notes/${lessonId}`}
          aria-label="Notes for this lesson"
          onClick={firstTapOpens('notes')}
        >
          {Icon.notes}
          <span className="tool-label">Notes</span>
        </a>
      )}
      {links.length === 1 && (
        <a
          className={`tool ${expanded === 'workbook' ? 'expanded' : ''}`}
          href={links[0].url}
          target="_blank"
          rel="noopener"
          aria-label={`Workbook Level ${links[0].level}, page ${links[0].page ?? ''}`}
          onClick={firstTapOpens('workbook')}
        >
          {Icon.book}
          <span className="tool-label">Workbook{links[0].page !== null ? ` p. ${links[0].page}` : ''}</span>
        </a>
      )}
      {links.length > 1 && (
        <details className="tool-menu">
          <summary className="tool" aria-label="Workbook pages">
            {Icon.book}
            <span className="tool-label">Workbook</span>
          </summary>
          <div className="tool-pop">
            {links.map((l) => (
              <a key={`${l.level}-${l.section}`} href={l.url} target="_blank" rel="noopener">
                Level {l.level}
                {l.page !== null ? ` · page ${l.page}` : ''} — {l.title}
              </a>
            ))}
          </div>
        </details>
      )}
      {laser && (
        <button type="button" className={`tool ${laserOn ? 'on' : ''}`} aria-pressed={laserOn} aria-label={laserOn ? 'Laser on — tap to exit' : 'Laser pointer'} onClick={() => { setExpanded(null); onLaser(); }}>
          {Icon.laser}
          <span className="tool-label">{laserOn ? 'Laser on' : 'Laser'}</span>
        </button>
      )}
      {admin && (
        <details className="tool-menu">
          <summary className="tool admin" aria-label="Admin">
            {Icon.gear}
            <span className="tool-label">Admin</span>
          </summary>
          <div className="tool-pop">
            <span className={`status-pill ${status}`}>{status}</span>
            <a href={`#/admin/${lessonId}`}>Calibrate timings</a>
            <a href="#/intake">Audio intake</a>
            <a href="#/admin">Manage lessons</a>
          </div>
        </details>
      )}
    </div>
  );
}
