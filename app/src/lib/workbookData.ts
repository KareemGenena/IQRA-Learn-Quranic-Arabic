/**
 * The workbook companion's data — `public/workbook/levelN.json`, written by
 * `scripts/make-workbook.mjs` from the workbook masters themselves: one entry
 * per physical page, the items of that page in the paper's order, and for
 * each the clip that says it, where one exists.
 *
 * Fetched when a level is opened, never precached: it grows with the
 * workbooks, and the shell must not (see vite.config.ts).
 */
import { CROSSWALK } from '../generated/crosswalk';

/** Where an item's clip lives. Either a lesson's own clip — its lesson id,
 *  folder, filename and calibration key, so a word recorded once serves both
 *  the lesson and the page — or a take recorded for the workbook, under
 *  lesson id 90 + level. */
export interface WorkbookAudio {
  lesson: number;
  path: string;
  file: string;
  key: string;
  stopFile?: string;
  waqf?: boolean;
  waqfMadd?: number;
  letterNames?: boolean;
  dimFinalMark?: boolean;
}

export interface WorkbookItem {
  /** `L1S4:بَ` — the section and the item's filename key; stable across
   *  editions as long as the word stays in the section. */
  id: string;
  text: string;
  /** The caption row under the item: "Fat-ha", "د + ر", "[ل silent] · طّ". */
  caption: string;
  audio?: WorkbookAudio;
}

export interface WorkbookPageData {
  /** Page of the PDF (cover = 1). */
  physical: number;
  /** The number printed in the footer — what a learner holding the book sees. */
  printed: number;
  section: string | null;
  /** A sub-heading within the section, when the page has one. */
  part?: string;
  items: WorkbookItem[];
}

export interface WorkbookSection {
  id: string;
  n: number;
  title: string;
  instruction: string;
  /** Physical page the section starts on. */
  firstPage: number | null;
}

export interface WorkbookLevel {
  level: number;
  pdf: string;
  sections: WorkbookSection[];
  pages: WorkbookPageData[];
}

const cache = new Map<number, Promise<WorkbookLevel>>();

export function loadWorkbook(level: number): Promise<WorkbookLevel> {
  let p = cache.get(level);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}workbook/level${level}.json`).then(async (res) => {
      // Hosting answers a missing path with index.html and a 200, so the
      // type is checked, not only the status — the same trap the clips have.
      if (!res.ok || !/json/.test(res.headers.get('content-type') ?? '')) {
        throw new Error(`workbook level ${level}: ${res.status}`);
      }
      return (await res.json()) as WorkbookLevel;
    });
    cache.set(level, p);
    p.catch(() => cache.delete(level));
  }
  return p;
}

/** The PDF on the landing site, opened at a physical page. */
export const pdfUrl = (level: WorkbookLevel, physical: number): string =>
  `${CROSSWALK.base}/${level.pdf}#page=${physical}`;
