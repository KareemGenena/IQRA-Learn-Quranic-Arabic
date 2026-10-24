/**
 * Lessons cut from the practice workbooks — Levels 1 and 2 of the app.
 *
 *   node scripts/make-workbook-lessons.mjs            every lesson in the map
 *   node scripts/make-workbook-lessons.mjs 21 23      some
 *
 * `Workbooks/lessons.map.json` says which workbook section each lesson is cut
 * from. Two phases, like every other lesson:
 *
 *   1. THE SHEET. The first run writes `Word Tables/<sheet>.docx` from the
 *      master: one row per item (Page · Card · Word · Note), the Word column
 *      the only Arabic one, so the intake tool records it row by row and
 *      names the files with their marks kept (بَ بُ بِ would otherwise be one
 *      file). From then on the sheet is the author's — a deleted row drops a
 *      word, a reordered one moves it — and this script never overwrites it.
 *      Delete the sheet to have it written afresh from the master.
 *   2. THE LESSON. Read the sheet; group its rows into cards by the Card
 *      column (a letter and its six forms, a pair, a lone word); take each
 *      item's caption from the master by its exact text ("Fat-ha", "د + ر");
 *      one lesson section per workbook page — a page is a sitting — titled
 *      by its printed number; match the takes in `Audio/Audio - Lesson NN/`
 *      by takes.mjs's rule (exact text, else an unambiguous key) and cut
 *      them, stop readings included; write `public/lessons/lessonNN/words.json`.
 *
 * A card's id is its ordinal in the sheet and is spent whether or not it was
 * recorded. The companion page reuses these clips by exact text once they
 * exist — a word recorded once serves the lesson and the page it is traced
 * on — so run make-workbook.mjs after recording.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getEntry, readDocx, setEntry, text as entryText, writeDocx } from '../../Workbooks/build/docx.mjs';
import { readZipEntry } from './lib/zip.mjs';
import { ROOT, WB, hasArabic, readWorkbook, textOf } from './lib/workbook.mjs';
import { exact, findTake, key, keyCounts, takesOf } from './lib/takes.mjs';
import { readWav, splitIntoN, writeSegment } from './lib/wav.mjs';
import { attachStops } from './lib/stop.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PUB = join(here, '..', 'public');
const SHEETS = join(ROOT, 'Word Tables');
const TEMPLATE = join(SHEETS, 'كلمات.docx');
const FONT = 'KFGQPC HAFS Uthmanic Script'; // the author's Word font (CLAUDE.md §4)

const MAP = JSON.parse(readFileSync(join(WB, 'lessons.map.json'), 'utf8'));
const wanted = process.argv.slice(2).map(Number).filter(Boolean);
const NUMBERS = (wanted.length ? wanted : Object.keys(MAP).map(Number).filter(Boolean)).sort((a, b) => a - b);

const masters = new Map(); // level -> readWorkbook(level)
const master = (L) => masters.get(L) ?? masters.set(L, readWorkbook(L)).get(L);

// ── the sheet ──────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const WIDTHS = [1200, 1200, 4500, 2840];
const cell = (txt, i, arabic) => {
  const sz = arabic ? 42 : 24;
  const rpr = `<w:rPr>${arabic ? `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${arabic ? '<w:rtl/>' : ''}<w:lang w:bidi="ar-EG"/></w:rPr>`;
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${WIDTHS[i]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr>${arabic ? '<w:bidi/>' : ''}<w:jc w:val="center"/>${rpr}</w:pPr>` +
    (txt ? `<w:r>${rpr}<w:t xml:space="preserve">${esc(txt)}</w:t></w:r>` : '') +
    `</w:p></w:tc>`
  );
};
const row = (cells, header = false) =>
  `<w:tr><w:trPr><w:trHeight w:val="600"/></w:trPr>${cells.map((c, i) => cell(c, i, !header && i === 2)).join('')}</w:tr>`;
const para = (txt) => `<w:p><w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(txt)}</w:t></w:r></w:p>`;

function writeSheet(n, meta, items) {
  const entries = readDocx(TEMPLATE);
  const doc = getEntry(entries, 'word/document.xml');
  const xml = entryText(doc);
  const a = xml.indexOf('<w:tbl>');
  const b = xml.indexOf('</w:tbl>') + '</w:tbl>'.length;
  const sec = master(meta.level).sections.find((s) => s.id === meta.source);
  const note = para(
    `Lesson ${n} — ${meta.title}. Cut from Practice Workbook Level ${meta.level}, Section ${sec.n} (${sec.title}) by scripts/make-workbook-lessons.mjs. ` +
      `Page is the workbook's printed page; rows with the same Card are one card. Delete a row to drop a word; this file is never overwritten.`,
  );
  const table =
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="9740" w:type="dxa"/>` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${WIDTHS.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    row(['Page', 'Card', 'Word', 'Note'], true) +
    items.map((it) => row([String(it.page), String(it.card), it.text, ''])).join('') +
    `</w:tbl>`;
  setEntry(entries, 'word/document.xml', xml.slice(0, a) + note + table + xml.slice(b));
  writeDocx(join(SHEETS, meta.sheet), entries);
}

/** The sheet's rows: page, card, word — the header row skipped. */
function readSheet(path) {
  const xml = readZipEntry(path, 'word/document.xml').toString('utf8');
  const tbl = xml.slice(xml.indexOf('<w:tbl>'), xml.indexOf('</w:tbl>'));
  const rows = [...tbl.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((r) =>
    [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => textOf(c[0])),
  );
  return rows
    .filter((r) => r.length >= 3 && hasArabic(r[2]))
    .map((r) => ({ page: Number(r[0]), card: Number(r[1]), text: r[2].normalize('NFC').trim() }));
}

// ── each lesson ────────────────────────────────────────────────────────────
for (const n of NUMBERS) {
  const meta = MAP[n];
  if (!meta) {
    console.log(`lesson ${n}: not in lessons.map.json`);
    continue;
  }
  const nn = String(n).padStart(2, '0');
  const wb = master(meta.level);
  const sec = wb.sections.find((s) => s.id === meta.source);
  if (!sec) throw new Error(`lesson ${n}: ${meta.source} is not a section of Workbook Level ${meta.level}`);
  const pages = wb.pages.filter((p) => p.section === meta.source);

  // 1. the sheet, once.
  // A column group of the master is one card only when it is a letter and its
  // forms — every caption a form label: Fat-ha, Tanween Damm, Madd Alif,
  // Shadda. Where the captions are decompositions ("و + ر + د") or timing
  // dots ("●●  ●") the group is just two words sharing a column, and each is
  // a card of its own with its caption as a badge.
  const isLabel = (c) => !!c && !/[+●]/.test(c);
  const sheetPath = join(SHEETS, meta.sheet);
  if (!existsSync(sheetPath)) {
    const items = [];
    let card = 0;
    for (const p of pages) {
      const groups = new Map();
      for (const it of p.items) {
        const g = `${it.row}/${it.group}`;
        (groups.get(g) ?? groups.set(g, []).get(g)).push(it);
      }
      for (const its of groups.values()) {
        const together = its.length > 1 && its.every((it) => isLabel(it.caption));
        if (together) {
          card += 1;
          for (const it of its) items.push({ page: p.printed, card, text: it.text });
        } else {
          for (const it of its) {
            card += 1;
            items.push({ page: p.printed, card, text: it.text });
          }
        }
      }
    }
    writeSheet(n, meta, items);
    console.log(`lesson ${n}: wrote ${meta.sheet} — ${items.length} rows, ${card} cards, from ${meta.source}`);
  }

  // 2. the lesson, from the sheet
  const rows = readSheet(sheetPath);
  const captionOf = new Map();
  for (const p of pages) for (const it of p.items) if (!captionOf.has(exact(it.text))) captionOf.set(exact(it.text), it.caption);
  // The teaching lines of the master — the page's "★ Tip" lines, then the
  // rule printed above each of its tables ("Heavy (1): ر has a fatha: رَ") —
  // are the page's hint, one line each. The author may replace a page's
  // tips in lessons.map.json (`tips`, by printed page) and give a word its
  // own rule chip (`notes`, by exact text). The (i) is for meanings only
  // (2026-10-24), never for a rule, and never the same text on every card.
  const tipsOf = new Map();
  const rulesOf = new Map();
  const ruleOf = new Map();
  for (const p of pages) {
    tipsOf.set(p.printed, meta.tips?.[String(p.printed)] ?? p.tips ?? []);
    rulesOf.set(p.printed, [...new Set(p.items.map((it) => it.rule).filter(Boolean))]);
    for (const it of p.items) if (it.rule && !ruleOf.has(exact(it.text))) ruleOf.set(exact(it.text), it.rule);
  }
  // "[ر Heavy (1)] · رَ" → "[ر Heavy] · رَ": the number is the paper's
  // cross-reference to its rule table; on a card the rule is its own chip,
  // the reason and nothing else ("Raa with damma", not "Heavy (4)").
  const deNumber = (c) => (c ?? '').replace(/ \(\d+\)\]/, ']');
  const reasonOf = (text) => {
    const note = meta.notes?.[text];
    if (note) return note;
    const m = /^(Heavy|Light) \(\d+\):\s*(.+)$/.exec(ruleOf.get(exact(text)) ?? '');
    if (!m) return undefined;
    // "ر has a fatha:  رَ" → "ر has a fatha": the example is the word itself.
    const reason = m[2].replace(/\s+/g, ' ').replace(/:\s*[؀-ۿ\s]+$/, '').trim();
    return `${m[1]} · ${reason}`;
  };
  // A caption part that only repeats a piece of the word ("· رَ", "· مَرۡ",
  // "· لُواْ") is dropped — the learner can see the ر in the word (the
  // author, 2026-10-24). A decomposition (أ + كۡ + ث + ر) or a change
  // (دٌ ← دۡ) is not a piece of the word and stays.
  const bare = (s) => s.replace(/[ً-ٰٟۖ-ࣰۭ-ࣲـ​-‍]/g, '').replace(/\s+/g, '');
  const chipOf = (caption, text) =>
    deNumber(caption)
      .split(/\s+·\s+/)
      .filter((part) => !(/^[؀-ۿ\s]+$/.test(part) && bare(text).includes(bare(part))))
      .join(' · ');

  const cards = [];
  for (const r of rows) {
    let c = cards[cards.length - 1];
    if (!c || c.card !== r.card) {
      c = { card: r.card, page: r.page, texts: [] };
      cards.push(c);
    }
    c.texts.push(r.text);
  }
  const multi = cards.some((c) => c.texts.length > 1);

  // A page is headed by its part of the workbook section ("Raa", "Hams
  // (whisper)"), carried over the pages a part spans, else by the lesson's
  // title — never "Page 54": the number is the paper's, and the workbook
  // button above the lesson already says where that is (the author,
  // 2026-10-24). The hint is the teaching alone.
  let part = '';
  const partOf = new Map();
  for (const p of pages) {
    if (p.part) part = p.part;
    partOf.set(p.printed, part);
  }
  // Tips may be given for a RUN of cards rather than a whole page —
  // "56:39-44", the sheet's card numbers — so that the screen whose words
  // all end in a sukoon gets the stop line and the screen before it does
  // not (the author, 2026-10-24). Each run is its own section, hence its
  // own screen(s); a page's other cards keep the page's tips.
  const ranges = Object.keys(meta.tips ?? {})
    .map((k) => /^(\d+):(\d+)-(\d+)$/.exec(k))
    .filter(Boolean)
    .map((m) => ({ page: Number(m[1]), from: Number(m[2]), to: Number(m[3]), lines: meta.tips[m[0]] }));
  const sectionOf = (c) => {
    const r = ranges.find((x) => x.page === c.page && c.card >= x.from && c.card <= x.to);
    return r ? `p${c.page}-${r.from}` : `p${c.page}`;
  };
  const sections = [];
  for (const c of cards) {
    const id = sectionOf(c);
    if (sections.some((s) => s.id === id)) continue;
    const r = ranges.find((x) => `p${x.page}-${x.from}` === id);
    const lines = [...(r ? r.lines : (tipsOf.get(c.page) ?? [])), ...(rulesOf.get(c.page) ?? [])];
    sections.push({
      id,
      title: partOf.get(c.page) || meta.title,
      titleArabic: '',
      hint: lines.length ? lines.join('\n') : 'Tap a form to hear it.',
    });
  }

  const src = join(ROOT, 'Audio', `Audio - Lesson ${nn}`);
  const outDir = join(PUB, 'audio', `lesson${nn}`);
  const takes = takesOf(src);
  const counts = keyCounts(cards.flatMap((c) => c.texts));
  const ambiguous = new Set();
  const used = new Set();
  const notYet = [];
  let written = 0;

  const cut = (text, file) => {
    const take = findTake(takes, text, counts, { ambiguous });
    if (!take) {
      notYet.push(text);
      return false;
    }
    mkdirSync(outDir, { recursive: true });
    const wav = readWav(join(src, take.file));
    const { segments } = splitIntoN(wav, 1);
    writeSegment(wav, segments[0][0], segments[0][1], join(outDir, file), { mono: true });
    used.add(take.file);
    written += 1;
    return true;
  };

  const words = cards.map((c, i) => {
    const id = i + 1;
    const wn = String(id).padStart(2, '0');
    const base = { id, section: sectionOf(c), badges: [] };
    if (c.texts.length > 1) {
      const forms = c.texts.map((text, j) => {
        const audio = `word${wn}${'abcdefgh'[j] ?? j}.wav`;
        cut(text, audio);
        return { text, audio, timings: null };
      });
      // Per card, not per lesson: "Shadda with Kasra" rows read Kasra · Shadda
      // where the rest read Fat-ha · Shadda.
      const formLabels = c.texts.map((t) => captionOf.get(exact(t)) ?? '');
      return { ...base, forms, formLabels };
    }
    const text = c.texts[0];
    const audio = `word${wn}.wav`;
    cut(text, audio);
    const caption = captionOf.get(exact(text));
    // One chip: the rule where the table has one, else the caption without
    // any piece of the word.
    const reason = reasonOf(text);
    const badges = [reason ?? chipOf(caption ?? '', text)].filter(Boolean);
    return { ...base, text, audio, timings: null, badges };
  });

  const lesson = {
    lesson: n,
    title: meta.title,
    titleArabic: meta.titleArabic,
    kind: 'letters',
    audioPath: `audio/lesson${nn}/`,
    perPage: multi ? 3 : 6,
    sections,
    words,
  };
  attachStops(lesson, src, outDir, key);
  mkdirSync(join(PUB, 'lessons', `lesson${nn}`), { recursive: true });
  writeFileSync(join(PUB, 'lessons', `lesson${nn}`, 'words.json'), JSON.stringify(lesson, null, 2), 'utf8');

  const forms = words.reduce((s, w) => s + (w.forms ? w.forms.length : 1), 0);
  console.log(
    `lesson ${n} (${meta.title}): ${cards.length} cards, ${forms} forms over ${sections.length} pages; ${written} clips cut, ${notYet.length} not yet recorded`,
  );
  if (!existsSync(src)) console.log(`  no Audio - Lesson ${nn} folder yet — record ${meta.sheet} in the intake tool`);
  const unused = [...takes.byExact.values()].map((v) => v.file).filter((f) => !used.has(f));
  if (unused.length) console.log(`  takes matching no row: ${unused.join(', ')}`);
  if (ambiguous.size) console.log(`  AMBIGUOUS, not used: ${[...ambiguous].join('; ')}`);
}
