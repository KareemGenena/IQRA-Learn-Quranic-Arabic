import { workbookLinks } from '../lib/workbook';

/**
 * "See workbook Level 1, page 6 for writing practice" — under a lesson's
 * title, one line per matching workbook section, linking to that page of the
 * PDF on the landing site. Nothing to show when a lesson has no section yet.
 */
export function WorkbookLinks({ lessonId }: { lessonId: number }) {
  const links = workbookLinks(lessonId);
  if (!links.length) return null;
  return (
    <div className="workbook-links" aria-label="Writing practice in the workbook">
      {links.map((l) => (
        <a
          key={`${l.level}-${l.section}`}
          className="workbook-btn"
          href={l.url}
          target="_blank"
          rel="noopener"
        >
          <span className="workbook-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2 2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 1 20 5.5v12a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 0 0-2 2 2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 17.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M12 6v14" fill="none" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </span>
          <span className="workbook-text">
            <span className="workbook-main">
              Workbook Level {l.level}
              {l.page !== null ? ` · page ${l.page}` : ''}
            </span>
            <span className="workbook-sub">
              Section {l.section} · {l.title} · writing practice
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
