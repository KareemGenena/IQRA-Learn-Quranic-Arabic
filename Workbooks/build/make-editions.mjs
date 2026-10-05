/**
 * The IQRA 1447 practice workbooks: one generic master per level, and the
 * editions printed by a particular masjid derived from it.
 *
 *   node Workbooks/build/make-editions.mjs generic   ONE-TIME: convert the ICNBM-branded
 *                                                    files in Workbooks/ to the generic master
 *   node Workbooks/build/make-editions.mjs icnbm     write Workbooks/ICNBM/*.docx from the masters
 *   node Workbooks/build/make-editions.mjs covers    put freshly rendered art into the masters
 *
 * Render the art first: `node Workbooks/cover/render.mjs`.
 *
 * The masters (`Workbooks/Practice Workbook Level N.docx`) are the only files a
 * person edits — in Word, by hand or with Claude in Word. Every edition is
 * regenerated from them, so a correction is made once. An edition differs from
 * the master in its cover alone: the master's cover has an empty "PRINTED BY"
 * box (a Word text box any masjid can type its name into); an edition's cover
 * image carries the printer's logo and name, and the text box is removed.
 *
 * What `generic` changes, and nothing else (every change is checked against the
 * exact text it replaces, and the run stops if anything differs):
 *   - the title page → a full-page cover image + the "Printed by" text box;
 *   - a new page 2, the copyright page (CC BY 4.0), in native Word text;
 *   - page tops "ICN Bellevue Masjid Maktab Program · Arabic Practice for Quran
 *     Reading · Level N" → "IQRA 1447 · Quranic Arabic Practice Workbook · Level N";
 *     the section openers' second line likewise, and their ICNBM logo → the IQRA mark;
 *   - the footer field: IF PAGE > 1 / = PAGE - 1  →  IF PAGE > 2 / = PAGE - 2, so the
 *     cover and the copyright page are unnumbered and the typed page numbers on the
 *     Table of Contents (physical page − 1 before) stay correct;
 *   - the builder Claude in Word keeps in the document's settings (iqraBuilder5–7,
 *     iqraLogo), so pages added later get the IQRA header and mark, and a note in
 *     iqraHandover saying all of this;
 *   - the file's author properties → "IQRA 1447" (these files are passed around).
 */
import { copyFileSync, mkdirSync, readFileSync, renameSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getEntry, readDocx, removeEntry, setEntry, text, writeDocx } from './docx.mjs';

const WB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = resolve(WB, 'cover/out');
const LEVELS = [1, 2, 3];
const master = L => resolve(WB, `Practice Workbook Level ${L}.docx`);
const icnbmFile = L => resolve(WB, 'ICNBM', `Practice Workbook Level ${L} - ICN Bellevue Masjid.docx`);

const EDITION = 'Edition 1.0 · October 2026';
const TITLE = 'Quranic Arabic Practice Workbook';
const OLD_NAME = 'ICN Bellevue Masjid Maktab Program', OLD_TITLE = 'Arabic Practice for Quran Reading';
const SEP = '  ·  ';
const GREEN = '14513A', GOLD = 'C1A054', BODY = '262626', MUTED = '595959';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const EMU = inches => Math.round(inches * 914400);
const count = (s, sub) => s.split(sub).length - 1;
function check(cond, msg) { if (!cond) throw new Error(msg); }

// ---------------------------------------------------------------- drawing XML
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const PIC = 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const picture = (rid, id, name, cx, cy) =>
  `<a:graphic ${A}><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic ${PIC}>` +
  `<pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
  `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
  `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
  `</pic:pic></a:graphicData></a:graphic>`;

const inlinePic = (rid, id, name, descr, wIn, hIn) => {
  const cx = EMU(wIn), cy = EMU(hIn);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="${name}" descr="${esc(descr)}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks ${A} noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    picture(rid, id, name, cx, cy) + `</wp:inline></w:drawing></w:r>`;
};

/** The cover: one full-page image behind the text, anchored to the page. */
const coverImage = L => {
  const cx = EMU(8.5), cy = EMU(11);
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251640000" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="9001" name="IQRA 1447 cover" descr="${esc(`IQRA 1447 — ${TITLE}, Level ${L}`)}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks ${A} noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    picture('rIdIqraCover', 9001, 'iqra-cover.png', cx, cy) + `</wp:anchor></w:drawing></w:r>`;
};

/**
 * The "PRINTED BY" fill-in: an empty, borderless text box laid exactly inside the
 * frame the cover image draws (cover.html: box x 2.22–6.28 in, y 8.42–9.66 in,
 * its legend at the top). Whatever a masjid types is centred in Perpetua bold green;
 * a logo can be inserted beside it.
 */
const PRINTED_BY_MARK = 'name="Printed by"';
const printedByBox = () => {
  const x = EMU(2.32), y = EMU(8.56), cx = EMU(3.86), cy = EMU(0.98);
  return `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>` +
    `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251660000" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${x}</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>${y}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="9002" ${PRINTED_BY_MARK} descr="Printed by: type the printing masjid's name here, and insert its logo"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic ${A}><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp>` +
    `<wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr>` +
    `<wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/>` +
    `<w:rPr><w:rFonts w:ascii="Perpetua" w:hAnsi="Perpetua" w:cs="Perpetua"/><w:b/><w:bCs/><w:color w:val="${GREEN}"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr>` +
    `</w:pPr></w:p></w:txbxContent></wps:txbx>` +
    `<wps:bodyPr rot="0" vert="horz" wrap="square" lIns="45720" tIns="45720" rIns="45720" bIns="45720" anchor="ctr" anchorCtr="0"><a:noAutofit/></wps:bodyPr>` +
    `</wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice></mc:AlternateContent></w:r>`;
};

// ---------------------------------------------------------------- copyright page
const run = (t, o = {}) => `<w:r><w:rPr><w:rFonts w:ascii="${o.font || 'Calibri'}" w:hAnsi="${o.font || 'Calibri'}" w:cs="${o.font || 'Calibri'}"/>` +
  (o.b ? '<w:b/><w:bCs/>' : '') + (o.i ? '<w:i/><w:iCs/>' : '') +
  `<w:color w:val="${o.c || BODY}"/><w:sz w:val="${o.sz || 23}"/><w:szCs w:val="${o.sz || 23}"/></w:rPr>` +
  `<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const COL = 792;                                       // the copyright text sits 0.55 in inside the margins
const para = (runs, o = {}) => `<w:p><w:pPr>${o.pb ? '<w:pageBreakBefore/>' : ''}${o.keep ? '<w:keepNext/>' : ''}` +
  `<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 100}" w:line="${o.line || 336}" w:lineRule="auto"/>` +
  `<w:ind w:left="${o.left ?? COL}" w:right="${COL}"${o.hanging ? ` w:hanging="${o.hanging}"` : ''}/>` +
  `<w:jc w:val="${o.jc || 'left'}"/></w:pPr>${runs}</w:p>`;
const heading = t => para(run(t, { b: 1, c: GREEN, sz: 25 }), { before: 346, after: 86, keep: 1 });
const body = (...runs) => para(runs.join(''));
const bullet = (...runs) => para(run('•', { c: GOLD }) + '<w:r><w:tab/></w:r>' + runs.join(''), { left: COL + 403, hanging: 245, after: 60 });

const copyrightPage = L => [
  para(inlinePic('rIdIqraLockup', 9003, 'iqra-lockup.png', 'IQRA 1447', 2.4, 1.45), { pb: 1, jc: 'center', before: 432, after: 0, line: 240 }),
  para(run(`${TITLE} · Level ${L}`, { b: 1, c: GREEN, sz: 27 }), { jc: 'center', before: 230, after: 0, line: 240 }),
  para(run(EDITION, { c: MUTED, sz: 20 }), { jc: 'center', before: 40, after: 0, line: 240 }),
  para(inlinePic('rIdIqraDivider', 9004, 'iqra-divider.png', '', 3.25, 3.25 * 81 / 1950), { jc: 'center', before: 400, after: 0, line: 240 }),
  heading('Free to copy, print, share and adapt'),
  body(run('© 2026 IQRA 1447. This workbook is licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0): creativecommons.org/licenses/by/4.0')),
  body(run('You may copy, print, share and adapt it, for any purpose, including selling it, provided you:')),
  bullet(run('credit IQRA 1447 and link to the license;')),
  bullet(run('say so if you changed anything. A changed version is yours, not IQRA 1447’s, and must not be presented as ours.')),
  body(run('Latest edition and corrections: '), run('iqra.muslimbynature.org', { b: 1 })),
  heading('Not covered by this license'),
  bullet(run('The name and logo of IQRA 1447, and the name and logo of whoever printed this copy.')),
  bullet(run('The Quranic text. It is written in the Madinah Mushaf script and checked against the Tanzil Quran Text (Uthmani), © Tanzil Project — tanzil.net.')),
  bullet(run('The Arabic typeface, KFGQPC Uthmanic Script HAFS, © King Fahd Glorious Quran Printing Complex.')),
  heading('Purpose'),
  body(run('Prophet Muhammad, peace be upon him, said: “When the son of Adam dies, his deeds stop except for three: continuous charity (sadaqa jariya), beneficial knowledge, or a righteous child making duaa for him.”')),
  para(run('We pray to The Most Generous to accept this small effort and put baraka in it.', { i: 1, c: GREEN }), { jc: 'center', before: 430, after: 0 }),
  para(inlinePic('rIdIqraDiamond', 9005, 'iqra-diamond.png', '', 0.12, 0.12), { jc: 'center', before: 200, after: 0, line: 240 }),
].join('');

const coverParagraph = L =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>` +
  coverImage(L) + printedByBox() + `</w:p>`;

// ---------------------------------------------------------------- page tops
const PARA = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*<\/w:p>/g;
const RUN = /<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*<\/w:r>/g;
const tText = s => [...s.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join('');
const norm = s => s.replace(/\s+/g, ' ').trim();
const setText = (r, t) => r.replace(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/, `<w:t xml:space="preserve">${esc(t)}</w:t>`);
const rPr = r => (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
const MARK_H = 482600, MARK_W = Math.round(MARK_H * 240 / 300);       // mark-small.png is 240 × 300

/** Rebuilds a paragraph's runs: f(run, index, runs) returns the new run or '' to drop it. */
function mapRuns(p, f) {
  const runs = [...p.matchAll(RUN)];
  let out = '', at = 0;
  runs.forEach((m, i) => { out += p.slice(at, m.index) + f(m[0], i, runs.map(x => x[0])); at = m.index + m[0].length; });
  return (out + p.slice(at)).replace(/<w:proofErr [^>]*\/>/g, '');
}

function convertHeaders(xml, L, notes) {
  let openers = 0, conts = 0;
  const out = xml.replace(PARA, p => {
    if (!p.includes('<w:pageBreakBefore/>') || !p.includes('ICN Bellevue')) return p;
    check(!p.includes('w:txbxContent') && !p.includes('mc:AlternateContent'), `L${L}: a page top holds a text box`);
    const t = norm(tText(p));
    if (p.includes('<wp:anchor')) {
      check(t === norm(`${OLD_NAME}${OLD_TITLE}${SEP}Level ${L}`), `L${L}: unexpected opener text: ${t}`);
      openers++;
      let afterBr = false, firstGrey = true;
      let q = mapRuns(p, r => {
        if (r.includes('<w:drawing>')) return r;
        if (r.includes('<w:br/>')) { afterBr = true; return r; }
        if (!r.includes('<w:t')) return r;
        if (!afterBr) { check(tText(r) === OLD_NAME, `L${L}: opener name run: ${tText(r)}`); return setText(r, 'IQRA 1447'); }
        if (firstGrey) { firstGrey = false; return setText(r, `${TITLE}${SEP}Level ${L}`); }
        return '';
      });
      // Level 1's openers name the picture "logo.png" and one is 543925 wide: same logo, same place
      const ext = /<wp:extent cx="\d+" cy="\d+"\/>/g, aext = /<a:ext cx="\d+" cy="\d+"\/>/g, pic = /name="(?:ICNBM Logo|logo)\.png"/;
      check(count(q, 'r:embed="rId6"') === 1 && (q.match(ext) || []).length === 1 && (q.match(aext) || []).length === 1
        && count(q, 'name="ICNBM Logo"') === 1 && pic.test(q), `L${L}: opener logo markup differs`);
      return q.replace(ext, `<wp:extent cx="${MARK_W}" cy="${MARK_H}"/>`).replace(aext, `<a:ext cx="${MARK_W}" cy="${MARK_H}"/>`)
        .replace('name="ICNBM Logo"', 'name="IQRA 1447 logo" descr="IQRA 1447"').replace(pic, 'name="IQRA 1447 logo.png"');
    }
    check(t === norm(`${OLD_NAME}${SEP}${OLD_TITLE}${SEP}Level ${L}`), `L${L}: unexpected page-top text: ${t}`);
    conts++;
    let first = null;
    return mapRuns(p, r => {
      if (!r.includes('<w:t')) return r;
      if (first === null) { first = rPr(r); return setText(r, `IQRA 1447${SEP}${TITLE}${SEP}Level ${L}`); }
      if (rPr(r) !== first) notes.add(`L${L}: a page-top run had different formatting; the first run's was kept`);
      return '';
    });
  });
  return { out, openers, conts };
}

// ---------------------------------------------------------------- settings stored by Claude in Word
const unx = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const enx = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function editSettings(xml, f) {
  return xml.replace(/<we:property name="([^"]+)" value="([^"]*)"\/>/g, (all, name, v) => {
    const cur = JSON.parse(unx(v)), next = f(name, cur);
    return next === undefined ? all : `<we:property name="${name}" value="${enx(JSON.stringify(next))}"/>`;
  });
}
const withNote = (handover, note) => { const h = JSON.parse(handover); h.edition = note; return JSON.stringify(h); };

const GENERIC_NOTE = L => `2026-10-04 (Claude Code): this file is the GENERIC IQRA 1447 master. Page 1 is a full-page ` +
  `cover image (word/media/iqra-cover.png) with an empty "Printed by" text box for the masjid that prints it; page 2 is the ` +
  `copyright page (CC BY 4.0). Page tops read "IQRA 1447 · ${TITLE} · Level ${L}"; section openers carry the IQRA mark ` +
  `(the builders and iqraLogo in these settings were updated to match — older skills still say ICN Bellevue: do not use ` +
  `their headers). Footer: IF PAGE > 2 and = PAGE - 2, so Table of Contents numbers = physical page − 2. Edit only this ` +
  `file; "node Workbooks/build/make-editions.mjs icnbm" regenerates the ICN Bellevue edition from it.`;

// ---------------------------------------------------------------- commands
const art = f => readFileSync(resolve(ART, f));

function generic() {
  for (const L of LEVELS) {
    const path = master(L), notes = new Set();
    const e = readDocx(path);
    let doc = text(getEntry(e, 'word/document.xml'));
    if (!doc.includes('ICN Bellevue')) { console.log(`Level ${L}: already generic — skipped`); continue; }
    // Level 3's Makharij diagram is built of text boxes. A paragraph holding one contains other
    // paragraphs, which PARA cannot see whole — harmless, because such a paragraph is never a
    // page top; convertHeaders refuses one that is.

    // 1. page tops
    const h = convertHeaders(doc, L, notes);
    doc = h.out;

    // 2. title page → cover + copyright page
    const bodyAt = doc.indexOf('<w:body>') + '<w:body>'.length;
    const firstHeader = doc.indexOf('<w:pageBreakBefore/>', bodyAt);
    const titleEnd = Math.max(doc.lastIndexOf('<w:p ', firstHeader), doc.lastIndexOf('<w:p>', firstHeader));   // start of that header's paragraph
    check(titleEnd > bodyAt, `L${L}: could not find the end of the title page`);
    const title = doc.slice(bodyAt, titleEnd), tt = norm(tText(title));
    check(tt === norm(`${OLD_NAME}${OLD_TITLE}Level ${L}By: IQRA 1447`), `L${L}: unexpected title page text: ${tt}`);
    check(count(title, 'r:embed="rId6"') === 1 && count(title, 'r:embed="rId7"') === 1, `L${L}: title page images differ`);
    doc = doc.slice(0, bodyAt) + coverParagraph(L) + copyrightPage(L) + doc.slice(titleEnd);

    check(!doc.includes('ICN Bellevue') && !doc.includes(OLD_TITLE) && !doc.includes('ICNBM'), `L${L}: old branding left`);
    check(!doc.includes('r:embed="rId7"'), `L${L}: the favicon is still referenced`);
    check(count(doc, 'r:embed="rId6"') === h.openers, `L${L}: section-opener logo count differs`);
    check(count(doc, `IQRA 1447${SEP}${TITLE}${SEP}Level ${L}`) === h.conts, `L${L}: page-top count differs`);
    setEntry(e, 'word/document.xml', doc);

    // 3. pictures
    let rels = text(getEntry(e, 'word/_rels/document.xml.rels'));
    check(/<Relationship Id="rId7"[^>]*Target="media\/image2\.png"\/>/.test(rels) && /Id="rId6"[^>]*Target="media\/image1\.png"/.test(rels), `L${L}: picture relationships differ`);
    rels = rels.replace(/<Relationship Id="rId7"[^>]*\/>/, '');
    const IMG = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
    rels = rels.replace('</Relationships>', ['Cover:iqra-cover', 'Lockup:iqra-lockup', 'Divider:iqra-divider', 'Diamond:iqra-diamond']
      .map(s => { const [id, f] = s.split(':'); return `<Relationship Id="rIdIqra${id}" Type="${IMG}" Target="media/${f}.png"/>`; }).join('') + '</Relationships>');
    setEntry(e, 'word/_rels/document.xml.rels', rels);
    check(/<Default Extension="png"/.test(text(getEntry(e, '[Content_Types].xml'))), `L${L}: no PNG content type`);
    setEntry(e, 'word/media/image1.png', art('mark-small.png'));          // the section openers' logo: ICNBM → IQRA mark
    removeEntry(e, 'word/media/image2.png');                              // the favicon was used only by the old title page
    setEntry(e, 'word/media/iqra-cover.png', art(`cover-L${L}.png`));
    setEntry(e, 'word/media/iqra-lockup.png', art('lockup.png'));
    setEntry(e, 'word/media/iqra-divider.png', art('divider.png'));
    setEntry(e, 'word/media/iqra-diamond.png', art('diamond.png'));

    // 4. footer numbering
    let foot = text(getEntry(e, 'word/footer2.xml'));
    check(count(foot, '> &gt; 1 "</w:instrText>') === 1 && count(foot, '> - 1 </w:instrText>') === 1, `L${L}: footer field differs`);
    foot = foot.replace('> &gt; 1 "</w:instrText>', '> &gt; 2 "</w:instrText>').replace('> - 1 </w:instrText>', '> - 2 </w:instrText>');
    setEntry(e, 'word/footer2.xml', foot);

    // 5. Claude in Word's stored builder, logo and handover
    const logo64 = art('mark-small.png').toString('base64');
    let builders = 0;
    const ext = editSettings(text(getEntry(e, 'word/webextensions/webextension1.xml')), (name, v) => {
      if (/^iqraBuilder\d+$/.test(name)) {
        check(count(v, OLD_NAME) === 2 && count(v, OLD_TITLE) === 2 && count(v, 'cx="543974"') === 2, `L${L}: ${name} differs from the known builder`);
        builders++;
        const b = v.replaceAll(OLD_NAME, 'IQRA 1447').replaceAll(OLD_TITLE, TITLE).replaceAll('cx="543974"', `cx="${MARK_W}"`)
          .replaceAll('name="ICNBM Logo.png"', 'name="IQRA 1447 logo.png"').replaceAll('name="ICNBM Logo"', 'name="IQRA 1447 logo"');
        check(!b.includes('ICN Bellevue') && !b.includes('ICNBM'), `L${L}: old branding left in ${name}`);
        return b;
      }
      if (name === 'iqraLogo') return logo64;
      if (name === 'iqraHandover') return withNote(v, GENERIC_NOTE(L));
    });
    setEntry(e, 'word/webextensions/webextension1.xml', ext);

    // 6. author properties
    let core = text(getEntry(e, 'docProps/core.xml'));
    core = core.replace(/<dc:creator>[^<]*<\/dc:creator>/, '<dc:creator>IQRA 1447</dc:creator>')
      .replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>IQRA 1447</cp:lastModifiedBy>')
      .replace(/<dc:title\s*\/>|<dc:title>[^<]*<\/dc:title>/, `<dc:title>${esc(`${TITLE} — Level ${L}`)}</dc:title>`);
    check(core.includes('<dc:creator>IQRA 1447</dc:creator>') && core.includes('<dc:title>'), `L${L}: core properties differ`);
    setEntry(e, 'docProps/core.xml', core);

    writeDocx(path + '.tmp', e); renameSync(path + '.tmp', path);
    console.log(`Level ${L}: cover + copyright page added · ${h.openers} section openers · ${h.conts} page tops · footer PAGE − 2 · ${builders} stored builder(s) updated`);
    for (const n of notes) console.log('  note:', n);
  }
}

function covers() {
  for (const L of LEVELS) {
    const e = readDocx(master(L));
    check(text(getEntry(e, 'word/document.xml')).includes(PRINTED_BY_MARK), `L${L}: not a generic master yet — run "generic" first`);
    setEntry(e, 'word/media/iqra-cover.png', art(`cover-L${L}.png`));
    setEntry(e, 'word/media/iqra-lockup.png', art('lockup.png'));
    setEntry(e, 'word/media/iqra-divider.png', art('divider.png'));
    setEntry(e, 'word/media/iqra-diamond.png', art('diamond.png'));
    setEntry(e, 'word/media/image1.png', art('mark-small.png'));
    writeDocx(master(L) + '.tmp', e); renameSync(master(L) + '.tmp', master(L));
    console.log(`Level ${L}: art refreshed`);
  }
}

function icnbm() {
  mkdirSync(resolve(WB, 'ICNBM'), { recursive: true });
  for (const L of LEVELS) {
    const e = readDocx(master(L));
    let doc = text(getEntry(e, 'word/document.xml'));
    const mark = doc.indexOf(PRINTED_BY_MARK);
    check(mark > 0 && !doc.includes('ICN Bellevue'), `L${L}: the master is not generic — run "generic" first`);
    const start = doc.lastIndexOf('<w:r><mc:AlternateContent>', mark), endTag = '</mc:AlternateContent></w:r>';
    const end = doc.indexOf(endTag, mark) + endTag.length;
    check(start > 0 && end > mark, `L${L}: could not find the "Printed by" text box`);
    doc = doc.slice(0, start) + doc.slice(end);             // the printer's name is in the cover image itself
    setEntry(e, 'word/document.xml', doc);
    setEntry(e, 'word/media/iqra-cover.png', art(`cover-L${L}-icnbm.png`));
    let core = text(getEntry(e, 'docProps/core.xml'));
    core = core.replace(/<dc:title>[^<]*<\/dc:title>/, `<dc:title>${esc(`${TITLE} — Level ${L} — printed by ICN Bellevue Masjid Maktab Program`)}</dc:title>`);
    setEntry(e, 'docProps/core.xml', core);
    const ext = editSettings(text(getEntry(e, 'word/webextensions/webextension1.xml')), (name, v) => name === 'iqraHandover'
      ? withNote(v, `ICN BELLEVUE EDITION — generated from the generic master by "node Workbooks/build/make-editions.mjs icnbm". ` +
        `Do not edit this file: edit Workbooks/Practice Workbook Level ${L}.docx and regenerate.`) : undefined);
    setEntry(e, 'word/webextensions/webextension1.xml', ext);
    writeDocx(icnbmFile(L), e);
    console.log(`Level ${L}: ${icnbmFile(L).split(/[\\/]/).slice(-2).join('/')}`);
  }
}

const cmd = process.argv[2];
({ generic, icnbm, covers }[cmd] || (() => { console.error('usage: make-editions.mjs generic | icnbm | covers'); process.exit(1); }))();
