/**
 * Spare Level 1 sheets for the Maktab, photocopied as needed — not a workbook.
 * ONE Word file, Extra Practice Sheets/Level 1 Extra Practice and Games.docx:
 *
 *   the teacher's guide   two pages — what is where (by page), how each game
 *                         runs, the answers
 *   Extra Practice        every letter of sections 1–2 written 10 times
 *                         (3 traced, 7 on its own), grouped by look-alike family
 *   Hidden Pictures       read each box, color it by the rules; nothing to mark
 *   Connect the Dots      sections 1, 3, 4; an Islamic figure appears
 *
 * Every Arabic item is taken from the Level 1 master itself (exact codepoints);
 * the styles, the font and the logo are the master's, so a sheet looks like the
 * workbook page beside it. The dot figures and the answer thumbnails are drawn
 * in headless Chrome (Chrome or Edge must be installed).
 *
 *   node Workbooks/build/make-practice-sheets.mjs [Workbooks folder to write into]
 */
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { mkdirSync, existsSync, writeFileSync, readFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { readDocx, writeDocx, getEntry, bytes } from './docx.mjs';
import { readWorkbook } from '../../app/scripts/lib/workbook.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const WB = join(here, '..');
const OUT = process.argv[2] ?? WB;
const master = readDocx(join(WB, 'Practice Workbook Level 1.docx'));
const part = (name) => bytes(getEntry(master, name));

// ── the master's items ─────────────────────────────────────────────────────
const items = readWorkbook(1).pages.flatMap((p) => p.items.map((i) => ({ ...i, section: p.section })));
const inSection = (s) => items.filter((i) => i.section === s);
const NAME = Object.fromEntries(inSection('L1S1').map((i) => [i.text, i.caption]));
const letter = (t) => {
  if (!NAME[t]) throw new Error(`not a section 1 letter: ${t}`);
  return t;
};
/** Items of a section in the master's groups of `n` (a letter and its forms). */
const groups = (s, n) => {
  const all = inSection(s);
  const out = [];
  for (let k = 0; k < all.length; k += n) out.push(all.slice(k, k + n));
  return out;
};
const plain = (t) => !/[ىيـأإءآ]/.test(t);     // no dotless or final yaa, no tatweel, no hamza
const pool = (s, caption, keep = plain) =>
  inSection(s).filter((i) => i.caption === caption && keep(i.text)).map((i) => i.text);

// ── XML ────────────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const AR = 'KFGQPC HAFS Uthmanic Script';
const EN = 'Calibri';
const LINE = '595959';

function r(t, o = {}) {
  const f = o.ar ? AR : EN;
  let p = `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>`;
  if (o.b) p += '<w:b/><w:bCs/>';
  if (o.i) p += '<w:i/><w:iCs/>';
  p += `<w:color w:val="${o.color ?? '000000'}"/>`;
  if (o.pos) p += `<w:position w:val="${o.pos}"/>`;
  if (o.sz) p += `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`;
  if (o.ar) p += '<w:rtl/>';
  return `<w:r><w:rPr>${p}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
}
/** Arabic at size `sz` (half-points), raised and line-fitted as the master does
 *  (34 pt: position 14, exact line 900 twips). */
const arRun = (t, sz, color) => r(t, { ar: 1, sz, color, pos: Math.round(sz * 0.2) });
const arLine = (sz) => Math.round(sz * 13.2);

function p(runs, o = {}) {
  let pp = '';
  if (o.keepNext) pp += '<w:keepNext/>';
  if (o.pageBreakBefore) pp += '<w:pageBreakBefore/>';
  if (o.tabs) pp += `<w:tabs>${o.tabs}</w:tabs>`;
  if (o.bidi) pp += '<w:bidi/>';
  pp += `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 0}" w:line="${o.line ?? 240}" w:lineRule="${o.rule ?? 'auto'}"/>`;
  if (o.ind) pp += `<w:ind w:left="${o.ind}" w:hanging="${o.hanging ?? 0}"/>`;
  pp += `<w:jc w:val="${o.jc ?? 'center'}"/>`;
  if (o.markSz) pp += `<w:rPr><w:sz w:val="${o.markSz}"/><w:szCs w:val="${o.markSz}"/></w:rPr>`;
  return `<w:p><w:pPr>${pp}</w:pPr>${runs}</w:p>`;
}
const arP = (t, sz, color) =>
  p(arRun(t, sz, color), { bidi: 1, line: arLine(sz), rule: 'exact' });
const empty = (sz = 16) => p('', { markSz: sz });

const edge = (side, o) =>
  o ? `<w:${side} w:val="${o.val ?? 'single'}" w:sz="${o.sz ?? 8}" w:space="0" w:color="${o.color ?? LINE}"/>`
    : `<w:${side} w:val="nil"/>`;
const borders = (b = {}) => {
  const d = b.all === undefined ? {} : b.all;
  const pick = (k) => (k in b ? b[k] : d);
  return `<w:tcBorders>${edge('top', pick('top'))}${edge('left', pick('left'))}${edge('bottom', pick('bottom'))}${edge('right', pick('right'))}</w:tcBorders>`;
};
function tc(content, o) {
  return `<w:tc><w:tcPr><w:tcW w:w="${o.w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}${borders(o.borders)}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:vAlign w:val="${o.v ?? 'center'}"/></w:tcPr>${content}</w:tc>`;
}
const tr = (cells, h, rule = 'atLeast') =>
  `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${h}" w:hRule="${rule}"/><w:jc w:val="center"/></w:trPr>${cells.join('')}</w:tr>`;
function tbl(rows, widths, o = {}) {
  const W = widths.reduce((a, b) => a + b, 0);
  return `<w:tbl><w:tblPr>${o.rtl ? '<w:bidiVisual/>' : ''}<w:tblW w:w="${W}" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="${o.cm ?? 60}" w:type="dxa"/><w:right w:w="${o.cm ?? 60}" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}
/** `n` column widths that add up to `total`. */
const split = (total, n) => Array.from({ length: n }, (_, k) => Math.floor(total / n) + (k < total % n ? 1 : 0));
const gap = (twips) => p('', { line: twips, rule: 'exact', markSz: 4 });
/** A thin borderless row between two rows of a table. */
const gapRow = (widths, h = 80) => tr(widths.map((w) => tc(p('', { line: h, rule: 'exact', markSz: 2 }), { w, borders: { all: null } })), h, 'exact');

// ── page furniture ─────────────────────────────────────────────────────────
const WIDTH = 10280;
let drawingId = 900;
function logo() {
  const id = ++drawingId;
  const a = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  return `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251671552" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="386080" cy="482600"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="IQRA 1447 logo ${id}" descr="IQRA 1447"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${a}" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="${a}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="IQRA 1447 logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="386080" cy="482600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}
/** A picture in the line, `w` × `h` inches, from an image passed to save(). */
function image(id, w, h) {
  const n = ++drawingId;
  const a = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const cx = Math.round(w * 914400), cy = Math.round(h * 914400);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${a}" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="${a}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
/** The master's page head: logo, IQRA 1447, the subtitle, Name, the one italic line. */
function head(subtitle, line, { first, name = true } = {}) {
  return (
    p(logo() + r('IQRA 1447', { b: 1, sz: 30 }) + '<w:r><w:br/></w:r>' + r(subtitle, { color: '404040' }),
      { keepNext: 1, pageBreakBefore: !first, after: 40 }) +
    (name ? p(r('Name: ', { b: 1, sz: 22 }) + r('________________________________________', { sz: 22 }), { keepNext: 1, after: 80 }) : '') +
    p(r(line, { i: 1, color: '404040', sz: 19 }), { keepNext: 1, after: 120 })
  );
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
function footer(notes) {
  const f = (t, b) => r(t, { b, sz: 20 });
  const page = `<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:rFonts w:ascii="${EN}" w:hAnsi="${EN}" w:cs="${EN}"/><w:b/><w:sz w:val="20"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>`;
  const runs = (notes ? f('Teacher notes: ', 1) + f('______________________________________________________') + f('    Date: ', 1) + f('______________') : '') +
    '<w:r><w:tab/></w:r>' + page;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="clear" w:pos="4680"/><w:tab w:val="clear" w:pos="9360"/><w:tab w:val="right" w:pos="10296"/></w:tabs></w:pPr>${runs}</w:p></w:ftr>`;
}

/** A section's page setup, its footer named by relationship id. */
const SECT = (footer) => `<w:sectPr><w:footerReference w:type="default" r:id="${footer}"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="560" w:right="972" w:bottom="720" w:left="972" w:header="280" w:footer="360" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
/** Ends a section here (the next one starts on a new page); its pages get this footer. */
const sectionEnd = (footer) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr>${SECT(footer)}</w:pPr></w:p>`;

/** Writes the document. The last section's pages carry the Teacher notes footer. */
function save(file, title, body, { images = [] } = {}) {
  const imageRels = images.map((im) => `<Relationship Id="rIdImg${im.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.id}.png"/>`).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${SECT('rIdFooter')}</w:body></w:document>`;
  const CT = 'application/vnd.openxmlformats-officedocument';
  const entries = [
    { name: '[Content_Types].xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="${CT}.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="${CT}.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="${CT}.wordprocessingml.settings+xml"/><Override PartName="/word/fontTable.xml" ContentType="${CT}.wordprocessingml.fontTable+xml"/><Override PartName="/word/theme/theme1.xml" ContentType="${CT}.theme+xml"/><Override PartName="/word/footer1.xml" ContentType="${CT}.wordprocessingml.footer+xml"/><Override PartName="/word/footer2.xml" ContentType="${CT}.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="${CT}.extended-properties+xml"/></Types>`) },
    { name: '_rels/.rels', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`) },
    { name: 'word/document.xml', data: Buffer.from(doc) },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFonts" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/><Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rIdFooterPlain" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>${imageRels}</Relationships>`) },
    { name: 'word/styles.xml', data: part('word/styles.xml') },
    { name: 'word/settings.xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`) },
    { name: 'word/fontTable.xml', data: part('word/fontTable.xml') },
    { name: 'word/theme/theme1.xml', data: part('word/theme/theme1.xml') },
    { name: 'word/footer1.xml', data: Buffer.from(footer(true)) },
    { name: 'word/footer2.xml', data: Buffer.from(footer(false)) },
    { name: 'word/media/logo.png', data: part('word/media/image1.png') },
    ...images.map((im) => ({ name: `word/media/${im.id}.png`, data: im.data })),
    { name: 'docProps/core.xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>IQRA 1447</dc:creator></cp:coreProperties>`) },
    { name: 'docProps/app.xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>`) },
  ];
  mkdirSync(dirname(file), { recursive: true });
  writeDocx(file, entries);
  console.log(`wrote ${file}`);
}

// ── 1. Extra practice: each letter 10 times ────────────────────────────────
// Families, so a teacher copies the one page a child needs: tooth and dots;
// the same tail (and ء, the head of ع); the small letters, و between ر and the
// round heads of ف ق; teeth and loops; the tall letters with م and هـ.
const FAMILIES = [
  ['ب', 'ت', 'ث', 'ن', 'ي'],
  ['ج', 'ح', 'خ', 'ع', 'غ', 'ء'],
  ['د', 'ذ', 'ر', 'ز', 'و', 'ف', 'ق'],
  ['س', 'ش', 'ص', 'ض', 'ط', 'ظ'],
  ['ا', 'ل', 'لا', 'ك', 'م', 'هـ'],
];
const TRACE = 3;
const WRITE = 7;
let lettersBody = '';
{
  const used = FAMILIES.flat().map(letter);
  const missing = Object.keys(NAME).filter((t) => !used.includes(t));
  if (missing.length || used.length !== new Set(used).size) throw new Error(`families must hold every section 1 letter once; missing ${missing}`);

  lettersBody = FAMILIES.map((fam, k) => {
    const widths = split(WIDTH, fam.length);
    const cell = (w, content, b) => tc(content, { w, borders: b });
    const rows = [
      tr(fam.map((t, c) => cell(widths[c], arP(t, 80), { all: {}, top: { sz: 18 } })), 1160),
      tr(fam.map((t, c) => cell(widths[c], p(r(NAME[t], { b: 1, color: '262626', sz: 18 })), { all: {}, bottom: { val: 'double', sz: 6 } })), 320),
      ...Array.from({ length: TRACE }, (_, row) =>
        tr(fam.map((t, c) => cell(widths[c], arP(t, 68, 'B0B0B0'), { all: {}, ...(row === 0 ? { top: { val: 'double', sz: 6 } } : {}) })), 1000)),
      ...Array.from({ length: WRITE }, () => tr(fam.map((_, c) => cell(widths[c], empty(), { all: {} })), 1000)),
    ];
    const dots = k < FAMILIES.length - 1 ? ' Watch the dots!' : '';
    return head('Level 1  ·  Extra Practice  ·  The Letters and Letters That Look Alike',
      `Extra Practice ${k + 1} of ${FAMILIES.length} — Trace the gray letter ${TRACE} times, then write it ${WRITE} times on your own.${dots}`,
      { first: k === 0 }) + tbl(rows, widths, { rtl: 1 });
  }).join('');
}

// ── 1b. Extra practice: the natural madd, each form 10 times ───────────────
// The workbook's Section 5 as it stands — every letter's six forms, Fat-ha,
// Madd Alif, Damma, Madd Waaw, Kasra, Madd Yaa — laid out as the workbook lays
// them (one 13-column table: two letters and a gap, right to left), but each
// form traced 3 times and written 7 (the author's choice, 2026-11-06): two
// letters to a page. The workbook's 26 pt does NOT fit these cells — صُونَ
// ضُونَ and كَنِ كُنِ كِنِ ran onto a second line — so the words are 22 pt and
// 21 pt, and section 3 measures the widest against the cell (MADD_FIT).
const MADD = groups('L1S5', 6);
const MADD_FORMS = 'Fat-ha,Madd Alif,Damma,Madd Waaw,Kasra,Madd Yaa';
const MADD_SZ = { model: 44, trace: 42 };          // half-points
const MADD_CM = 30;                                 // cell margin, twips each side
let maddBody = '', maddCell = 0;
{
  for (const g of MADD) if (g.map((i) => i.caption).join() !== MADD_FORMS) throw new Error(`section 5 group ${g[0].text}: ${g.map((i) => i.caption)}`);
  const GAP = 190, half = split(WIDTH - GAP, 12), widths = [...half.slice(0, 6), GAP, ...half.slice(6)];
  maddCell = Math.min(...half) - 2 * MADD_CM;
  // the workbook's own paragraph for a form: the word raised 14, an exact line
  const form = (t, sz, color, line) => p(r(t, { ar: 1, sz, color, pos: 14 }), { bidi: 1, line, rule: 'exact' });
  const row = (pair, make, h, edge) => tr(pair.flatMap((g, gi) => [
    ...(gi ? [tc(empty(), { w: GAP, borders: { all: null } })] : []),
    ...g.map((item, c) => tc(make(item), { w: widths[gi * 7 + c], borders: { all: {}, ...edge } })),
  ]), h);
  const pages = [];
  for (let k = 0; k < MADD.length; k += 2) pages.push(MADD.slice(k, k + 2));
  maddBody = pages.map((pair, k) => {
    const rows = [
      row(pair, (i) => form(i.text, MADD_SZ.model, '000000', 1120), 1160, { top: { sz: 18 } }),
      row(pair, (i) => p(r(i.caption, { b: 1, color: '262626', sz: 16 })), 320, { bottom: { val: 'double', sz: 6 } }),
      ...Array.from({ length: TRACE }, (_, n) => row(pair, (i) => form(i.text, MADD_SZ.trace, 'B0B0B0', 900), 1000, n === 0 ? { top: { val: 'double', sz: 6 } } : {})),
      ...Array.from({ length: WRITE }, () => row(pair, () => empty(), 1000, {})),
    ];
    return head('Level 1  ·  Extra Practice  ·  Natural Madd',
      `Natural Madd ${k + 1} of ${pages.length} · Section 5 — Trace each one ${TRACE} times, then write it ${WRITE} times on your own.`) +
      tbl(rows, widths, { rtl: 1, cm: MADD_CM });
  }).join('');
}

// ── 2. Hidden pictures ─────────────────────────────────────────────────────
// A picture on a grid: A and B are its colors, every other box is a look-alike
// left white. A box read wrong is a speck in the white or a hole in the picture
// — the sheet marks itself, at arm's length. Islamic things and things the
// Qurʾān names; no animals (the author kept nine of an earlier fifteen).
const COLORS = {
  yellow: 'FFD84D', orange: 'FF9F40', green: '5DBB63', brown: 'B07A4F', red: 'E8564A',
  blue: '5B9BE0', black: '3A3A3A', gray: 'A0A0A0', pink: 'F5A3C7',
};
let seed = 1447;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
/** The pool with each entry repeated `n` times where it is given as [text, n]. */
const weighted = (list) => list.flatMap((x) => (Array.isArray(x) ? Array(x[1]).fill(x[0]) : [x]));

const S3 = 'L1S3', S4 = 'L1S4', S5 = 'L1S5', S6 = 'L1S6';
const notAf = (t) => plain(t) && !t.includes('ف');                 // عَفِ / عَفِّ left the app's lesson 23
const maddKeep = (t) => !/[ىـأإءآ]/.test(t) && !t.startsWith('ي'); // the madd yaa is ي; the hamza and yaa rows stay out
const S6_PAIRS = groups(S6, 2).filter((g) => g[1].caption === 'Shadda' && notAf(g[1].text) && plain(g[1].text));
const SHADDA_FATHA = S6_PAIRS.filter((g) => g[0].caption === 'Fat-ha').map((g) => g[1].text);
const SHADDA_KASRA = S6_PAIRS.filter((g) => g[0].caption === 'Kasra').map((g) => g[1].text);

const L1 = 'Section 1 · The Letters', L2 = 'Section 2 · Letters That Look Alike';
const PICTURES = [
  {
    section: L1, answer: 'a crescent moon and a star', sz: 52,
    art: ['...AAA...', '.AAAA....', 'AAA......', 'AAA...B.B', 'AAA....B.', 'AAA...B.B', 'AAA......', 'AAA......', '.AAAA....', '...AAA...'],
    A: { color: 'yellow', rule: 'every', pool: [letter('ب')] },
    B: { color: 'orange', rule: 'every', pool: [letter('ج')] },
    rest: 'every other letter',
    D: ['ا', 'د', 'ر', 'س', 'ص', 'ط', 'ف', 'ق', 'ك', 'ل', 'م', 'و', 'هـ'].map(letter),
    practices: 'ب and ج among other letters',
  },
  {
    section: L1, answer: 'the Kaaba', sz: 52,
    art: ['.........', '.AAAAAAA.', '.BBBBBBB.', '.AAAAAAA.', '.AAAAAAA.', '.AAAABBA.', '.AAAABBA.', '.AAAABBA.', '.AAAAAAA.', '.........'],
    A: { color: 'black', rule: 'every', pool: [letter('م')] },
    B: { color: 'yellow', rule: 'every', pool: [letter('ف')] },
    rest: 'every other letter',
    D: ['ا', 'ب', 'د', 'ر', 'س', 'ص', 'ط', 'ع', 'ك', 'ل', 'ن', 'و', 'هـ'].map(letter),
    practices: 'م and ف among other letters',
  },
  {
    section: L2, answer: 'a masjid', sz: 52, dots: true,
    art: ['....A....', 'A..AAA..A', 'A.AAAAA.A', 'A.AAAAA.A', 'ABBBBBBBA', 'ABBBBBBBA', 'ABBB.BBBA', 'ABB...BBA', 'ABB...BBA', 'ABB...BBA'],
    A: { color: 'green', rule: 'every', pool: [letter('ت')] },
    B: { color: 'yellow', rule: 'every', pool: [letter('ث')] },
    rest: 'every other letter',
    D: weighted([[letter('ب'), 3], letter('ن'), letter('ي')]),
    practices: 'ت and ث among ب ن ي',
  },
  {
    section: L2, answer: 'a palm tree', sz: 52, dots: true,
    art: ['..AA.AA..', '.AAAAAAA.', 'AAA.A.AAA', 'AA..B..AA', 'A...B...A', '....B....', '....B....', '....B....', '...BBB...', '.BBBBBBB.'],
    A: { color: 'green', rule: 'every', pool: [letter('ج')] },
    B: { color: 'brown', rule: 'every', pool: [letter('ر')] },
    rest: 'every other letter',
    D: weighted([[letter('ح'), 2], [letter('خ'), 2], letter('ع'), letter('غ'), [letter('ز'), 2], letter('د'), letter('ذ')]),
    practices: 'ج and ر among ح خ ع غ ز د ذ',
  },
  {
    section: 'Section 3 · Harakat', answer: 'the sun', sz: 52,
    art: ['A...A...A', '.A..A..A.', '...BBB...', '..BBBBB..', 'AABBBBBAA', '..BBBBB..', '...BBB...', '.A..A..A.', 'A...A...A', '.........'],
    A: { color: 'orange', rule: 'a Damma', pool: pool(S3, 'Damma') },
    B: { color: 'yellow', rule: 'a Fat-ha', pool: pool(S3, 'Fat-ha') },
    rest: 'every box with a Kasra',
    D: pool(S3, 'Kasra'),
    practices: 'Fat-ha and Damma (Kasra stays white)',
  },
  {
    section: 'Section 3 · Harakat', answer: 'a rain cloud', sz: 48,
    art: ['.........', '...AA....', '..AAAAAA.', '.AAAAAAAA', 'AAAAAAAAA', '.AAAAAAA.', '.........', '.B..B..B.', 'B..B..B..', '.........'],
    A: { color: 'gray', rule: 'a Sukoon', pool: pool(S3, 'Sukoon') },
    B: { color: 'blue', rule: 'a Kasra', pool: pool(S3, 'Kasra') },
    rest: 'every other box',
    D: [...pool(S3, 'Fat-ha'), ...pool(S3, 'Damma')],
    practices: 'Sukoon and Kasra among Fat-ha and Damma',
  },
  {
    section: 'Section 4 · Tanween', answer: 'a sailboat', sz: 48,
    art: ['....B....', '....BA...', '...ABAA..', '..AABAAA.', '.AAABAAAA', '....B....', 'BBBBBBBBB', '.BBBBBBB.', '..BBBBB..', '.........'],
    A: { color: 'red', rule: 'Tanween Fath', pool: pool(S4, 'Tanween Fath') },
    B: { color: 'brown', rule: 'Tanween Damm', pool: pool(S4, 'Tanween Damm') },
    rest: 'every other box',
    D: weighted([...pool(S4, 'Fat-ha'), ...pool(S4, 'Damma').map((t) => [t, 2]), ...pool(S4, 'Kasra'), ...pool(S4, 'Tanween Kasr')]),
    practices: 'Tanween Fath and Tanween Damm among single harakat',
  },
  {
    section: 'Section 5 · Natural Madd', answer: 'an olive tree', sz: 40,
    art: ['..AAAAA..', '.AAAAAAA.', 'AAAAAAAAA', 'AAAAAAAAA', '.AAAAAAA.', '..AAAAA..', '....B....', '....B....', '...BBB...', '..BBBBB..'],
    A: { color: 'green', rule: 'Madd Alif', pool: pool(S5, 'Madd Alif', maddKeep) },
    B: { color: 'brown', rule: 'Madd Yaa', pool: pool(S5, 'Madd Yaa', maddKeep) },
    rest: 'every other box',
    D: weighted([...pool(S5, 'Fat-ha', maddKeep).map((t) => [t, 2]), ...pool(S5, 'Kasra', maddKeep).map((t) => [t, 2]), ...pool(S5, 'Damma', maddKeep), ...pool(S5, 'Madd Waaw', maddKeep)]),
    practices: 'Madd Alif and Madd Yaa among short harakat and Madd Waaw',
  },
  // Section 6 is set larger: a Kasra under a Shadda is a small mark, and at
  // 22 pt it was lost (the author, 2026-10-28).
  {
    section: 'Section 6 · Shadda', answer: 'a minaret', sz: 60,
    art: ['....B....', '...AAA...', '...AAA...', '..BBBBB..', '...AAA...', '...AAA...', '...AAA...', '...AAA...', '..AAAAA..', '.AAAAAAA.'],
    A: { color: 'blue', rule: 'Shadda and Fat-ha', pool: SHADDA_FATHA },
    B: { color: 'yellow', rule: 'Shadda and Kasra', pool: SHADDA_KASRA },
    rest: 'every box with no Shadda',
    D: S6_PAIRS.map((g) => g[0].text),
    practices: 'Shadda with Fat-ha and with Kasra among no Shadda',
  },
];
const KEYS = ['A', 'B', 'C'];

const grids = PICTURES.map((pic, k) => {
  seed = 1447 + k;
  if (pic.art.some((row) => row.length !== pic.art[0].length)) throw new Error(`picture ${k + 1}: rows of different lengths`);
  for (const key of KEYS) if (pic[key] && !pic[key].pool.length) throw new Error(`picture ${k + 1}: empty pool ${key}`);
  for (const ch of pic.art.join('')) if (ch !== '.' && !pic[ch]) throw new Error(`picture ${k + 1}: no rule for ${ch}`);
  if (!pic.D.length) throw new Error(`picture ${k + 1}: no look-alikes`);
  return pic.art.map((row) => [...row].map((ch) => ({ ch, t: pick(ch === '.' ? pic.D : pic[ch].pool) })));
});

let picturesBody = '';
{
  picturesBody = PICTURES.map((pic, k) => {
    // a box the child colors with that crayon — the legend, for a child who cannot read the rule
    const RW = [700, 260, 6020, 3300];
    const exSz = Math.min(pic.sz, 52);
    // rows grow with their Arabic: an exact height cut off every mark under the line
    const ruleRow = (swatch, what, arabic) =>
      tr([
        tc(empty(), { w: RW[0], borders: swatch ? { all: { sz: 8 } } : { all: null } }),
        tc(empty(), { w: RW[1], borders: { all: null } }),
        tc(p(r(what, { sz: 24 }), { jc: 'left' }), { w: RW[2], borders: { all: null } }),
        tc(arabic ? arP(arabic, exSz) : empty(), { w: RW[3], borders: { all: null } }),
      ], 560);
    const rule = (c) => (c.rule === 'every' ? `Color every ${NAME[c.pool[0]]} ${c.color}.` : `Color every box with ${c.rule} ${c.color}.`);
    const ex = (pool) => [...new Set(pool)].slice(0, 3).join('   ');
    const used = KEYS.filter((key) => pic[key]);
    const rules = tbl([
      ...used.flatMap((key) => [ruleRow(true, rule(pic[key]), ex(pic[key].pool)), gapRow(RW)]),
      ruleRow(false, `Leave ${pic.rest} white.`, ''),
    ], RW);
    const cols = pic.art[0].length, rows = pic.art.length;
    const W = split(WIDTH, cols);
    const room = 14560 - 1540 - (used.length + 1) * 640 - 360 - 450 - 300;
    const h = Math.min(960, Math.floor(room / rows));
    const grid = tbl(grids[k].map((row) =>
      tr(row.map((cell, c) => tc(arP(cell.t, pic.sz), { w: W[c], borders: { all: { sz: 6, color: '7F7F7F' } } })), h, 'exact')), W);
    const line = `Hidden Picture ${k + 1} · ${pic.section} — Read each box out loud, then color it by the rules.${pic.dots ? ' Watch the dots!' : ' A picture will appear!'}`;
    return head('Level 1  ·  Games', line) + rules + gap(160) + grid + gap(200) +
      p(r('What is the hidden picture?  ', { b: 1, sz: 24 }) + r('_____________________________', { sz: 24 }), { jc: 'left' });
  }).join('');
}

// ── 3. Connect the dots ────────────────────────────────────────────────────
// Join the dots in an order the child already knows — the alphabet song, then
// بَ بُ بِ through the letters, then the tanween — and an Islamic figure
// appears; a dot taken out of order is a line across the picture anyone can
// see. Each figure is drawn in headless Chrome with the Word font (KFGQPC HAFS
// Uthmanic Script; the app's own copy where it is not installed) and set in the
// page as a picture.
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((f) => existsSync(f));
if (!CHROME) throw new Error('Connect the dots needs Chrome or Edge.');
const APP_FONT = pathToFileURL(join(WB, '..', 'app', 'public', 'fonts', 'UthmanicHafs1-Ver09.otf')).href;
const TMP = mkdtempSync(join(tmpdir(), 'iqra-dots-'));
const MUSHAF_FACE = `'KFGQPC HAFS Uthmanic Script', AppMushaf`;
function shoot(svg, w, h, scale, name) {
  const html = join(TMP, `${name}.html`), png = join(TMP, `${name}.png`);
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:AppMushaf;src:url('${APP_FONT}')}html,body{margin:0;background:#fff}svg{display:block}</style>${svg}`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=3000',
    `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, `--screenshot=${png}`, pathToFileURL(html).href], { stdio: 'ignore' });
  return readFileSync(png);
}
/** How wide each text is in the Word font at `pt`, in twips, as Chrome lays it out. */
function measure(texts, pt) {
  const html = join(TMP, 'measure.html');
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:AppMushaf;src:url('${APP_FONT}')}
span{font-family:${MUSHAF_FACE};font-size:${pt}pt;white-space:nowrap}</style><pre id=out></pre><div id=box></div><script>
const res = ${JSON.stringify(texts)}.map((t) => { const s = document.createElement('span'); s.lang = 'ar'; s.dir = 'rtl'; s.textContent = t;
  document.getElementById('box').appendChild(s); return s.getBoundingClientRect().width * 15; });
document.getElementById('out').textContent = 'WIDTHS' + JSON.stringify(res) + 'END';</script>`);
  const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--virtual-time-budget=3000', '--dump-dom', pathToFileURL(html).href],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(dom.split('WIDTHS')[1].split('END')[0]);
}
// MADD_FIT: every Section 5 word must sit on one line in its cell, with room to
// spare — a word wider than its cell wraps in Word, as صُونَ and كَنِ did at 26 pt.
for (const [what, sz] of Object.entries(MADD_SZ)) {
  const texts = MADD.flat().map((i) => i.text), w = measure(texts, sz / 2);
  const k = w.indexOf(Math.max(...w));
  if (w[k] > maddCell * 0.95) throw new Error(`natural madd ${what} at ${sz / 2} pt: ${texts[k]} is ${Math.round(w[k])} twips, the cell holds ${maddCell}`);
  console.log(`natural madd ${what} ${sz / 2} pt: widest ${texts[k]} ${Math.round(w[k])} of ${maddCell} twips`);
}

const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
const inside = (pts, x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** The way out of the figure at dot `i` — where its label goes. */
function outward(pts, i) {
  const n = pts.length, [px, py] = pts[(i - 1 + n) % n], [x, y] = pts[i], [qx, qy] = pts[(i + 1) % n];
  const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const [ax, ay] = unit(x - px, y - py), [bx, by] = unit(qx - x, qy - y);
  let [nx, ny] = unit(ay + by, -(ax + bx));
  if (inside(pts, x + nx * 6, y + ny * 6)) [nx, ny] = [-nx, -ny];
  return [nx, ny];
}

// a masjid: two minarets, the hall, a dome with its finial, a door — 28 dots,
// none closer than 40 units so no two letters crowd (the finial's three were 25
// apart and their letters ran together)
const DOME = (deg) => polar(350, 410, 140, deg);
const MASJID = [[70, 670], [70, 460], [70, 250], [95, 160], [120, 250], [120, 410], [165, 410],
  [210, 410], DOME(150), DOME(120), [330, 272], [350, 180], [370, 272], DOME(60), DOME(30), [490, 410],
  [535, 410], [580, 410], [580, 250], [605, 160], [630, 250], [630, 460], [630, 670],
  [430, 670], [430, 550], [350, 470], [270, 550], [270, 670]];
// a crescent: 17 dots round the outside, 10 back up the inside — 27
const H1 = polar(340, 360, 280, 55);
const R2 = Math.hypot(H1[0] - 450, H1[1] - 360), PHI = (Math.atan2(360 - H1[1], H1[0] - 450) * 180) / Math.PI;
const CRESCENT = [...Array.from({ length: 17 }, (_, k) => polar(340, 360, 280, 55 + (250 * k) / 16)),
  ...Array.from({ length: 10 }, (_, k) => polar(450, 360, R2, 360 - PHI - ((360 - 2 * PHI) * (k + 1)) / 11))];
// ۞, two squares: each tip is three dots — the corner before it, halfway, the tip — 24
const R_IN = (290 * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8);
const STAR = Array.from({ length: 8 }, (_, k) => {
  const tip = polar(350, 360, 290, 90 - 45 * k), corner = polar(350, 360, R_IN, 90 - 45 * k + 22.5);
  return [corner, [(corner[0] + tip[0]) / 2, (corner[1] + tip[1]) / 2], tip];
}).flat();

const firstOf = (gs, letters, n) => letters.map((l) => {
  const g = gs.find((x) => x[0].text.startsWith(l));
  if (!g) throw new Error(`no group for ${l}`);
  return g;
}).slice(0, n);
const DOTS = [
  { section: 'Section 1 · The Letters', answer: 'a masjid', order: 'the alphabet song', pts: MASJID, sz: 32,
    seq: ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ي'].map(letter) },
  { section: 'Section 3 · Harakat', answer: 'a crescent moon', order: 'Fat-ha, Damma, Kasra on each letter, from ب to ر', pts: CRESCENT, sz: 32,
    seq: firstOf(groups(S3, 4), ['بَ', 'تَ', 'ثَ', 'جَ', 'حَ', 'خَ', 'دَ', 'ذَ', 'رَ'], 9).flatMap((g) => g.slice(0, 3).map((i) => i.text)) },
  { section: 'Section 4 · Tanween', answer: '۞, the Rub el Hizb star that marks each quarter of a hizb in the Mushaf', order: 'Tanween Fath, Damm, Kasr on each letter, from ب to ذ', pts: STAR, sz: 30,
    extra: `<circle cx="350" cy="360" r="${(R_IN * 0.5).toFixed(1)}" fill="none" stroke="#8C8C8C" stroke-width="4"/>`,
    seq: firstOf(groups(S4, 6), ['بَ', 'تَ', 'ثَ', 'جَ', 'حَ', 'خَ', 'دَ', 'ذَ'], 8).flatMap((g) => [g[1], g[3], g[5]].map((i) => i.text)) },
];
/** The figure's dots and letters, cropped to what is drawn: { svg, w, h } in units of 0.01 inch. */
function dotsSvg(d, fill) {
  const pts = d.pts, M = 34;
  const labels = pts.map(([x, y], i) => { const [nx, ny] = outward(pts, i); return [x + nx * 34, y + ny * 34]; });
  // letters that land too close to each other, or on a dot, are pushed apart —
  // three dots along one roof put three letters in one heap
  const GAP = d.sz * 1.45, CLEAR = 24;
  for (let it = 0; it < 200; it++) {
    let moved = false;
    const away = (a, bx, by, want) => {
      const dx = a[0] - bx, dy = a[1] - by, dist = Math.hypot(dx, dy);
      if (dist >= want) return 0;
      const ux = dist ? dx / dist : 0, uy = dist ? dy / dist : -1;
      return [ux * (want - dist), uy * (want - dist)];
    };
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const v = away(labels[i], labels[j][0], labels[j][1], GAP);
        if (v) { labels[i][0] += v[0] / 2; labels[i][1] += v[1] / 2; labels[j][0] -= v[0] / 2; labels[j][1] -= v[1] / 2; moved = true; }
      }
      for (const [x, y] of pts) {
        const v = away(labels[i], x, y, CLEAR);
        if (v) { labels[i][0] += v[0]; labels[i][1] += v[1]; moved = true; }
      }
    }
    if (!moved) break;
  }
  const all = [...pts, ...labels];
  const x0 = Math.min(...all.map((q) => q[0])) - M, y0 = Math.min(...all.map((q) => q[1])) - M;
  const w = Math.ceil(Math.max(...all.map((q) => q[0])) + M - x0), h = Math.ceil(Math.max(...all.map((q) => q[1])) + M - y0);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w} ${h}">`;
  if (fill) s += `<polygon points="${pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="#222" stroke-width="5" stroke-linejoin="round"/>`;
  if (d.extra) s += d.extra;
  pts.forEach(([x, y], i) => {
    const [lx, ly] = labels[i];
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="#000"/>`;
    if (i === 0) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="none" stroke="#000" stroke-width="3"/>`;
    s += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-family="${MUSHAF_FACE}" font-size="${d.sz}" text-anchor="middle" dominant-baseline="central">${esc(d.seq[i])}</text>`;
  });
  return { svg: s + '</svg>', w, h };
}
/** Inches to set a w × h figure at, inside a box of maxW × maxH inches. */
const fit = ({ w, h }, maxW, maxH) => { const k = Math.min(maxW / w, maxH / h); return [w * k, h * k]; };
const dotImages = DOTS.map((d, k) => {
  if (d.seq.length !== d.pts.length) throw new Error(`dots ${k + 1}: ${d.seq.length} items for ${d.pts.length} dots`);
  const sheet = dotsSvg(d), answer = dotsSvg(d, '#FFF0B3');
  return {
    size: sheet,
    sheet: { id: `dots${k + 1}`, data: shoot(sheet.svg, sheet.w, sheet.h, 3, `dots${k + 1}`) },
    answer: { id: `dotsAnswer${k + 1}`, data: shoot(answer.svg, answer.w, answer.h, 1, `dotsAnswer${k + 1}`) },
  };
});
let dotsBody = '';
{
  dotsBody = DOTS.map((d, k) =>
    head('Level 1  ·  Games', `Connect the Dots ${k + 1} · ${d.section} — Start at the dot with a ring. Join the dots in this order, then join the last one back to the first.`) +
    p(d.seq.map((t) => arRun(t, 40)).join(r('   ', { ar: 1, sz: 40 })), { bidi: 1, after: 120, line: 288 }) +
    p(image(`dots${k + 1}`, ...fit(dotImages[k].size, 7.0, 6.9))) + gap(120) +
    p(r('What did you draw?  ', { b: 1, sz: 24 }) + r('_____________________________', { sz: 24 }) + r('   Now color it in!', { sz: 24 }), { jc: 'left' }),
  ).join('');
}

// ── 4. The teacher's guide, and the one book ───────────────────────────────
// One Word file for the teachers: the guide and its contents first, then every
// student page; a teacher prints the pages a child needs by their numbers.
{
  const GUIDE_PAGES = 2;
  const sectionsOf = (list) => [...new Set(list.map((x) => x.section.match(/Section (\d)/)[1]))].join(', ');
  const PARTS = [
    { what: 'Extra Practice — the letters', note: `each letter of Sections 1–2 written ${TRACE + WRITE} times (${TRACE} traced, ${WRITE} on their own), one family of look-alike letters to a page`, from: 0, pages: FAMILIES.length, workbook: '1–2' },
    { what: 'Extra Practice — natural madd', note: `all six forms of each letter written ${TRACE + WRITE} times (${TRACE} traced, ${WRITE} on their own), two letters to a page`, pages: Math.ceil(MADD.length / 2), workbook: '5' },
    { what: 'Hidden Pictures', note: 'read each box, color it by the rules, and a picture appears', pages: PICTURES.length, workbook: sectionsOf(PICTURES) },
    { what: 'Connect the Dots', note: 'join the dots in an order the child knows, and an Islamic figure appears', pages: DOTS.length, workbook: sectionsOf(DOTS) },
  ];
  let next = GUIDE_PAGES + 1;
  for (const pt of PARTS) { pt.from = next; pt.to = next + pt.pages - 1; next = pt.to + 1; }
  const range = (x, y) => (x === y ? `${x}` : `${x}–${y}`);
  const [, , picturesPart, dotsPart] = PARTS;

  const h2 = (t, o = {}) => p(r(t, { b: 1, sz: 26, color: '14513A' }), { jc: 'left', before: 160, after: 60, keepNext: 1, ...o });
  const bullet = (t) => p(r('•  ', { sz: 21 }) + r(t, { sz: 21 }), { jc: 'left', ind: 300, hanging: 300, after: 50 });
  const mixed = (bits) => bits.map((x) => (typeof x === 'string' ? r(x, { sz: 19 }) : arRun(x.ar, 30))).join('');
  const arabicIn = (t) => t.split(/([؀-ۿ][؀-ۿ\s]*[؀-ۿ]|[؀-ۿ])/).filter(Boolean).map((x) => (/[؀-ۿ]/.test(x) ? { ar: x } : x));
  const lineCol = { all: { sz: 4, color: 'A6A6A6' } };
  const table = (heads, widths, rows) => tbl([
    tr(heads.map((t, c) => tc(p(r(t, { b: 1, sz: 19 }), { jc: 'left' }), { w: widths[c], borders: lineCol, fill: 'EDEDED' })), 300),
    ...rows.map((cells) => tr(cells.map((content, c) => tc(p(content, { jc: 'left' }), { w: widths[c], borders: lineCol })), 300)),
  ], widths);

  const contents = table(['Pages', 'What', 'Workbook sections', 'What the child does'], [900, 2900, 1600, 4880], [
    [r(range(1, GUIDE_PAGES), { sz: 19, b: 1 }), r('Teacher’s guide and answers', { sz: 19 }), r('—', { sz: 19 }), r('this page and the next: how each game runs, and the answers', { sz: 19 })],
    ...PARTS.map((pt) => [r(range(pt.from, pt.to), { sz: 19, b: 1 }), r(pt.what, { sz: 19 }), r(pt.workbook, { sz: 19 }), r(pt.note, { sz: 19 })]),
  ]);
  const TW = [700, 2700, 4280, 2600];
  // a crayon shown, not only named: a square in its color, then its name
  const crayon = (name, sz = 19) => r('■', { color: COLORS[name], sz: Math.round(sz * 1.5) }) + r(` ${name}`, { sz });
  const colorsOf = (pic) => KEYS.filter((key) => pic[key]).map((key) => pic[key].color);
  const allColors = [...new Set(PICTURES.flatMap(colorsOf))];
  const pictureTable = table(['Page', 'Section', 'What it practices', 'Hidden picture', 'Crayons'], [600, 2000, 3380, 2300, 2000],
    PICTURES.map((pic, k) => [r(String(picturesPart.from + k), { sz: 19 }), r(pic.section.replace('Section ', ''), { sz: 19 }),
      mixed(arabicIn(pic.practices)), r(pic.answer, { sz: 19, b: 1 }), colorsOf(pic).map((c) => crayon(c)).join(r('   ', { sz: 19 }))]));
  const dotsTable = table(['Page', 'Section', 'The order', 'The figure'], TW,
    DOTS.map((d, k) => [r(String(dotsPart.from + k), { sz: 19 }), r(d.section.replace('Section ', ''), { sz: 19 }),
      r(d.order, { sz: 19 }), mixed(arabicIn(d.answer))]));

  // the hidden pictures finished, five to a row — drawn as pictures, because
  // Word widens some columns of so small a table and squeezes others
  const PER_ROW = 5, TH = split(WIDTH, PER_ROW);
  const thumbs = PICTURES.map((pic, k) => {
    const cols = pic.art[0].length, rows = pic.art.length, C = 20;
    const cells = pic.art.flatMap((row, y) => [...row].map((ch, x) =>
      `<rect x="${x * C}" y="${y * C}" width="${C}" height="${C}" fill="#${pic[ch] ? COLORS[pic[ch].color] : 'FFFFFF'}" stroke="#BFBFBF" stroke-width="1"/>`)).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * C}" height="${rows * C}" viewBox="-0.5 -0.5 ${cols * C + 1} ${rows * C + 1}">${cells}</svg>`;
    return { id: `thumb${k + 1}`, data: shoot(svg, cols * C, rows * C, 3, `thumb${k + 1}`), size: { w: cols, h: rows } };
  });
  const thumbRows = [];
  for (let at = 0; at < PICTURES.length; at += PER_ROW) {
    thumbRows.push(tr(TH.map((w, c) => {
      const k = at + c, pic = PICTURES[k];
      return pic
        ? tc(p(image(`thumb${k + 1}`, ...fit(thumbs[k].size, 1.25, 1.25)), { jc: 'left' }) +
            p(r(`p. ${picturesPart.from + k}  `, { b: 1, sz: 16 }) + r(pic.answer.replace(/^(an?|the) /, ''), { sz: 16 }), { jc: 'left', before: 60, after: 120 }),
          { w, borders: { all: null }, v: 'top' })
        : tc(empty(), { w, borders: { all: null } });
    }), 300));
  }
  const DW = split(WIDTH, 3);
  const dotsAnswers = tbl([tr(DOTS.map((d, k) => tc(
    p(image(`dotsAnswer${k + 1}`, ...fit(dotImages[k].size, 1.8, 1.8))) +
      p(r(`p. ${dotsPart.from + k}  `, { b: 1, sz: 16 }) + r(['masjid', 'crescent moon', 'Rub el Hizb star'][k], { sz: 16 }), { before: 40 }),
    { w: DW[k], borders: { all: null }, v: 'top' })), 300)], DW);

  const guideBody =
    head('Level 1  ·  Extra Practice and Games  ·  Teacher’s Guide',
      'Print only the pages a child needs: every page is numbered at the bottom. Nothing here needs marking — each game shows its own mistakes.',
      { first: true, name: false }) +
    h2('What is in this file') + contents +
    h2('Extra Practice — the letters') +
    bullet(`Each letter of Sections 1 and 2, ${TRACE + WRITE} times: ${TRACE} traced in gray, then ${WRITE} on its own. Each page is one family of letters that look alike, so you can copy just the page a child is stuck on.`) +
    bullet(`Natural madd: the workbook’s Section 5 page by page — every letter’s six forms (Fat-ha, Madd Alif, Damma, Madd Waaw, Kasra, Madd Yaa), each ${TRACE + WRITE} times, two letters to a page, in the workbook’s order.`) +
    h2('Hidden Pictures') +
    bullet('Read the color rules out loud once. Each child reads every box out loud, then colors it by the rules.') +
    bullet('To check, glance from the front of the room. A clean picture means every box was read right. A colored box out in the white, or a white box inside the picture, is a box read wrong: point to it, the child reads it to you and fixes it.') +
    p(r('•  ', { sz: 21 }) + r(`Crayons: each sheet uses two colors, shown for each page in the table below. For all ${PICTURES.length} sheets, have these ${allColors.length} ready:`, { sz: 21 }),
      { jc: 'left', ind: 300, hanging: 300, after: 30 }) +
    p(allColors.map((c) => crayon(c, 21)).join(r('     ', { sz: 21 })), { jc: 'left', ind: 300, after: 50 }) +
    bullet('Black-and-white copies are fine: each sheet names its colors, and the child colors a small box beside each rule with that crayon.') +
    gap(80) + pictureTable +
    h2('Connect the Dots', { pageBreakBefore: 1 }) +
    bullet('The order is printed under the title, right to left, and every child already knows it: the alphabet song; then Fat-ha, Damma, Kasra on each letter; then the three tanween on each letter. Start at the dot with a ring, and end back at it.') +
    bullet('To check, look at the figure. A dot taken out of order is a line that cuts across the picture.') +
    bullet('When the figure is done, the child colors it in and says or writes what it is.') +
    gap(80) + dotsTable +
    h2('The answers') + tbl(thumbRows, TH) + gap(120) + dotsAnswers;

  save(join(OUT, 'Extra Practice Sheets', 'Level 1 Extra Practice and Games.docx'), 'Level 1 Extra Practice and Games',
    guideBody + sectionEnd('rIdFooterPlain') + lettersBody + maddBody + picturesBody + dotsBody,
    { images: [...dotImages.map((x) => x.sheet), ...dotImages.map((x) => x.answer), ...thumbs] });
  console.log(PARTS.map((pt) => `${pt.what}: pages ${range(pt.from, pt.to)}`).join('\n'));
}

// ── report ─────────────────────────────────────────────────────────────────
for (const [k, pic] of PICTURES.entries()) {
  const n = { A: 0, B: 0, C: 0, '.': 0 };
  for (const row of pic.art) for (const ch of row) n[ch]++;
  const colors = KEYS.filter((key) => pic[key]).map((key) => `${n[key]} ${pic[key].color} (${new Set(pic[key].pool).size})`).join(', ');
  console.log(`picture ${k + 1} ${pic.answer}: ${colors}, ${n['.']} white (${new Set(pic.D).size})`);
}
