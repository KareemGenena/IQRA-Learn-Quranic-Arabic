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
    <ul className="workbook-links" aria-label="Writing practice in the workbook">
      {links.map((l) => (
        <li key={`${l.level}-${l.section}`}>
          <a href={l.url} target="_blank" rel="noopener" title={`Section ${l.section} — ${l.title}`}>
            See workbook Level {l.level}
            {l.page !== null ? `, page ${l.page}` : ''} for writing practice
          </a>
          <span className="workbook-section"> — Section {l.section}, {l.title}</span>
        </li>
      ))}
    </ul>
  );
}
