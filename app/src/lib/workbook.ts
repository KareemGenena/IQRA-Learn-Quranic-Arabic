/**
 * The practice workbooks, from a lesson's point of view.
 *
 * A lesson never stores a page number. It is matched to workbook SECTIONS
 * (L1S3 — level 1, section 3) in Workbooks/crosswalk.map.json, and the page
 * each section starts on is generated from the master's own Table of
 * Contents into src/generated/crosswalk.ts. So a new workbook edition is one
 * regenerate-and-redeploy, never a hunt through the app for stale numbers;
 * and the link opens the PDF on the landing site at that page, which always
 * serves the current edition.
 */
import { CROSSWALK } from '../generated/crosswalk';

export interface WorkbookLink {
  level: number;
  section: number;
  title: string;
  /** The page printed at the foot of the workbook page. */
  page: number | null;
  url: string;
}

export function workbookLinks(lessonId: number): WorkbookLink[] {
  const out: WorkbookLink[] = [];
  for (const [level, lv] of Object.entries(CROSSWALK.levels)) {
    for (const s of lv.sections) {
      if (!s.lessons.some((l) => l.id === lessonId)) continue;
      out.push({
        level: Number(level),
        section: s.section,
        title: s.title,
        page: s.printed,
        // The physical page is what a PDF viewer counts; the printed one is
        // two less (cover and copyright page carry no number).
        url: `${CROSSWALK.base}/${lv.file}${s.physical ? `#page=${s.physical}` : ''}`,
      });
    }
  }
  return out;
}
