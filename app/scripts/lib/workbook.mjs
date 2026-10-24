/**
 * Reading the practice workbook masters — the one parser for the companion
 * (make-workbook.mjs) and the lessons cut from them (make-workbook-lessons.mjs).
 *
 * `Workbooks/Practice Workbook Level N.docx`, page by page: every running-head
 * paragraph ("IQRA 1447 · Quranic Arabic Practice Workbook · Level N") opens a
 * new physical page — checked against the PDFs: 33, 59 and 34 content pages
 * after the cover and the copyright page, so physical = index + 3 and the
 * number printed in the footer is physical − 2 — and a "Section N · Title —
 * instruction" paragraph names the section the page belongs to (a part title,
 * "Lam Qamariyya (moon letters)", is the same section). In every drill table
 * the FIRST row holds the items and the second their captions ("Fat-ha",
 * "د + ر", "4●", "[ل silent] · طّ"); the rows below are the grey tracing
 * copies and are never read. A table whose first row has no Arabic (Level
 * 2's Letter Shapes) yields nothing.
 *
 * Within a row the items come in GROUPS — a letter and its forms (بَ بًا بُ
 * بٌ بِ بٍ), a pair (دَرَ دَرُ), a lone word — separated by the sheet's blank
 * spacer cells. A group is what a lesson card holds; `row` and `group` say
 * which.
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readZipEntry } from './zip.mjs';
import { key } from './takes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..', '..', '..');
export const WB = join(ROOT, 'Workbooks');
/** site/public/workbooks/meta.json — the PDFs' page counts, cover included. */
export const PDF_PAGES = { 1: 35, 2: 61, 3: 36 };

export const hasArabic = (s) => /[؀-ۿ]/.test(s);
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
export const textOf = (xml) =>
  decode([...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')).trim();

/** The master's pages and sections. Item ids are `L1S4:<key>` — the section
 *  and the item's filename key — made unique with `#2`, `#3` where a key
 *  repeats inside a section. */
export function readWorkbook(L) {
  const xml = readZipEntry(join(WB, `Practice Workbook Level ${L}.docx`), 'word/document.xml').toString('utf8');
  const body = xml.slice(xml.indexOf('<w:body>'));
  const re = /<w:p\b[\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>/g;

  const pages = [];
  const sections = [];
  let section = null;
  let page = null;
  const ids = new Map();
  let m;
  while ((m = re.exec(body))) {
    const s = m[0];
    if (s.startsWith('<w:tbl>')) {
      if (!page) continue;
      const rows = [...s.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((r) =>
        [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => textOf(c[0])),
      );
      if (!rows.length) continue;
      const [first, captions = []] = rows;
      if (!first.some(hasArabic)) continue; // a header row, not items
      const row = page.rows;
      page.rows += 1;
      let group = -1;
      let inGroup = false;
      first.forEach((cell, i) => {
        if (!cell || !hasArabic(cell)) {
          inGroup = false;
          return;
        }
        if (!inGroup) {
          group += 1;
          inGroup = true;
        }
        const base = `${section.id}:${key(cell)}`;
        const seen = ids.get(base) ?? 0;
        ids.set(base, seen + 1);
        const id = seen ? `${base}#${seen + 1}` : base;
        const caption = captions[i] && captions[i] !== cell ? captions[i] : '';
        // The rule line printed above this table, if one was.
        page.items.push({ id, text: cell, caption, row, group, rule: page.rule || undefined });
      });
      page.rule = null;
      continue;
    }
    const t = textOf(s);
    if (!t) continue;
    const h = /^Section (\d+) · (.+?)(?: — (.*))?$/.exec(t);
    if (h) {
      const n = Number(h[1]);
      const title = h[2].trim();
      let sec = sections.find((x) => x.n === n);
      if (!sec) {
        sec = { id: `L${L}S${n}`, n, title, instruction: (h[3] ?? '').trim(), firstPage: page?.physical ?? null };
        sections.push(sec);
      }
      section = sec;
      if (page) {
        page.section = sec.id;
        if (title !== sec.title) page.part = title;
        if (!sec.firstPage) sec.firstPage = page.physical;
      }
      continue;
    }
    if (/IQRA 1447.*Practice Workbook/.test(t)) {
      page = { physical: pages.length + 3, printed: pages.length + 1, section: section?.id ?? null, rows: 0, items: [], tips: [], rule: null };
      pages.push(page);
      continue;
    }
    if (!page) continue;
    // The teaching lines. "★ Tip: …" belongs to the page; a line of the form
    // "Heavy (1): ر has a fatha: رَ" names the rule of the table that follows
    // it. A tip may share a paragraph with a rule (Level 3, p.35). Anything
    // without a colon — a diagram label, a tracing instruction — is neither.
    const [ruleText, ...tipParts] = t.split('★');
    for (const part of tipParts) {
      const tip = part.replace(/^\s*Tip:\s*/, '').trim();
      if (tip) page.tips.push(tip);
    }
    const rule = ruleText.trim();
    if (rule && rule.includes(':') && hasArabic(rule) && !/^(Trace|Read|Write|Say)\b/.test(rule)) page.rule = rule;
  }

  const expected = PDF_PAGES[L] - 2;
  if (pages.length !== expected) console.log(`  !! Level ${L}: ${pages.length} pages read, the PDF has ${expected} content pages`);
  for (const p of pages) {
    delete p.rows;
    delete p.rule;
    if (!p.tips.length) delete p.tips;
  }
  return { level: L, pages, sections };
}
