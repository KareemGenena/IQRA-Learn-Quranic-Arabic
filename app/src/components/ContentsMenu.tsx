import { useEffect } from 'react';
import { LESSONS, lessonsByLevel } from '../lib/lessons';
import { canSeeLesson, lessonStatus } from '../lib/appConfig';
import type { AppConfig } from '../lib/appConfig';
import { OPEN_INSTALL_EVENT, canOfferInstall } from './InstallPrompt';

/**
 * The contents, from anywhere: a drawer from the header's ☰ with every
 * Level and its lessons, the workbooks and the account. A link opens the
 * lesson itself — not its place on the home page — so a teacher mid-lesson
 * reaches another in one tap instead of scrolling to the bottom and back
 * (the author, 2026-10-25). Escape, the backdrop or a link closes it.
 */
export function ContentsMenu({
  config,
  admin,
  workbooks,
  quiz,
  currentId,
  open,
  onClose,
}: {
  config: AppConfig;
  admin: boolean;
  workbooks: boolean;
  quiz: boolean;
  currentId: number;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;

  const levels = lessonsByLevel(LESSONS)
    .map((lv) => ({ ...lv, lessons: lv.lessons.filter((l) => canSeeLesson(config, l.id, admin)) }))
    .filter((lv) => lv.lessons.length > 0);

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <aside className="menu-drawer" role="dialog" aria-label="Contents" onClick={(e) => e.stopPropagation()}>
        <div className="menu-head">
          <strong>Contents</strong>
          <button type="button" className="menu-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <nav className="menu-nav">
          <a className="menu-link" href="#/" onClick={onClose}>
            Home
          </a>
          {levels.map((lv) => (
            <section key={lv.level} className="menu-level">
              <h4>{lv.title}</h4>
              <ol>
                {lv.lessons.map((l, i) => {
                  const status = lessonStatus(config, l.id);
                  return (
                    <li key={l.id}>
                      <a href={`#/lesson/${l.id}`} onClick={onClose} aria-current={l.id === currentId ? 'page' : undefined} className={l.id === currentId ? 'current' : ''}>
                        <span className="menu-no">{l.check ? '?' : i + 1}</span>
                        <span className="menu-title">
                          {l.title}
                          {status !== 'published' && <span className={`status-pill ${status}`}>{status}</span>}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {quiz && (
            <a className="menu-link" href="#/quiz" onClick={onClose}>
              Quiz me
            </a>
          )}
          {workbooks && (
            <a className="menu-link" href="#/workbook" onClick={onClose}>
              Practice workbooks
            </a>
          )}
          <a className="menu-link" href="#/recordings" onClick={onClose}>
            Class recordings
          </a>
          <a className="menu-link" href="#/account" onClick={onClose}>
            Account
          </a>
          {canOfferInstall() && (
            <button
              type="button"
              className="menu-link menu-install"
              onClick={() => {
                onClose();
                window.dispatchEvent(new Event(OPEN_INSTALL_EVENT));
              }}
            >
              Install as an app
            </button>
          )}
        </nav>
      </aside>
    </div>
  );
}
