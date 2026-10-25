/**
 * Reading a Word table in the browser, with no library.
 *
 * A .docx is a ZIP holding `word/document.xml`. The generators already read
 * one by hand (`scripts/lib/zip.mjs`) using Node's zlib; the browser has the
 * same inflater behind `DecompressionStream('deflate-raw')`, so the intake
 * system can open the author's own source-of-truth file directly rather than
 * asking them to export or retype it.
 *
 * The parsing is the same shape as the generators' — split on `<w:tr>` and
 * `<w:tc>`, gather `<w:t>` runs — because the two must agree about what a row
 * is. Not every sheet is a table, though: some are written as plain
 * paragraphs, so both are returned and the page offers whichever is there.
 */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

/** One entry out of a ZIP, by exact name. */
async function readZipEntry(buf: ArrayBuffer, entryName: string): Promise<Uint8Array> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // The end-of-central-directory record sits in the last ~64 KB, after any
  // trailing comment, so it has to be searched for backwards.
  let eocd = -1;
  for (let p = buf.byteLength - 22; p >= 0 && p > buf.byteLength - 65558; p--) {
    if (view.getUint32(p, true) === EOCD_SIG) {
      eocd = p;
      break;
    }
  }
  if (eocd === -1) throw new Error('That file is not a .docx (no ZIP directory in it).');

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder('utf-8');

  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== CEN_SIG) throw new Error('That .docx looks damaged.');
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (name === entryName) {
      // The local header repeats the name and extra lengths, and they may
      // differ from the ones in the directory.
      const lNameLen = view.getUint16(localOff + 26, true);
      const lExtraLen = view.getUint16(localOff + 28, true);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(start, start + compSize);
      if (method === 0) return raw;
      if (method !== 8) throw new Error(`Unsupported compression in that .docx (method ${method}).`);
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${entryName} is missing from that .docx.`);
}

/** All the text of one `<w:t>`-bearing fragment, runs joined in order. */
function textOf(fragment: string): string {
  let out = '';
  for (const m of fragment.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) out += m[1];
  return out.trim();
}

/** One table of the sheet, with the heading written above it. */
export interface DocxTable {
  /** The first paragraph with text between the previous table and this one — "Spoken lines — …". */
  title: string;
  rows: string[][];
}

export interface DocxContent {
  /** Table rows of EVERY table, each a list of cell texts. Empty when the file has no table. */
  rows: string[][];
  /** The same rows, table by table, so a sheet of several tables can be
   *  recorded one table at a time (the alphabet sheet: its spoken lines, its
   *  songs, its letter names are three tables of one file). */
  tables: DocxTable[];
  /** Every non-empty paragraph, for sheets written without a table. */
  paragraphs: string[];
}

const rowsOf = (tbl: string) =>
  tbl
    .split(/<w:tr[ >]/)
    .slice(1)
    .map((r) =>
      r
        .split('</w:tr>')[0]
        .split(/<w:tc[ >]/)
        .slice(1)
        .map((c) => textOf(c.split('</w:tc>')[0])),
    );

export async function readDocx(file: File): Promise<DocxContent> {
  const xml = new TextDecoder('utf-8').decode(
    await readZipEntry(await file.arrayBuffer(), 'word/document.xml'),
  );

  const tables: DocxTable[] = [];
  let at = 0;
  for (;;) {
    const a = xml.indexOf('<w:tbl>', at);
    if (a < 0) break;
    const b = xml.indexOf('</w:tbl>', a) + '</w:tbl>'.length;
    // The table's title: the last HEADING before it (the sheet's "Spoken
    // lines — …"), else the first paragraph with text in the gap.
    const gap = xml.slice(at, a);
    const paras = gap.split(/<w:p[ >]/).slice(1).map((p) => p.split('</w:p>')[0]);
    const headings = paras.filter((p) => /<w:pStyle w:val="Heading/.test(p)).map(textOf).filter(Boolean);
    const title = headings[headings.length - 1] ?? paras.map(textOf).find(Boolean) ?? `Table ${tables.length + 1}`;
    tables.push({ title, rows: rowsOf(xml.slice(a, b)) });
    at = b;
  }
  const rows = tables.flatMap((t) => t.rows);

  const paragraphs = xml
    .split(/<w:p[ >]/)
    .slice(1)
    .map((p) => textOf(p.split('</w:p>')[0]))
    .filter(Boolean);

  return { rows, tables, paragraphs };
}

/** The column headed "Slot" — the one cell per row that names the file, on
 *  the sheets built for the intake tool — or -1 where there is none. */
export function slotColumn(rows: string[][]): number {
  return (rows[0] ?? []).findIndex((h) => /^slot\b/i.test(h.trim()));
}

/**
 * Which column holds the words.
 *
 * A sheet's word column is the one carrying Arabic letters in the most rows —
 * كلمات.docx, for instance, has two empty columns before it, and حروف الحلق
 * puts an extra Form column in front for the hamza section. Guessing beats
 * asking, but the page still shows the guess and lets it be changed: a wrong
 * column would name every file after the wrong thing.
 */
export function guessWordColumn(rows: string[][]): number {
  const arabic = /[ء-ي]/;
  const width = Math.max(0, ...rows.map((r) => r.length));
  let best = 0;
  let bestScore = -1;
  for (let c = 0; c < width; c++) {
    let score = 0;
    for (const row of rows) {
      const cell = row[c] ?? '';
      // Longer is better: a Form column holds a single letter, the word column
      // holds a word, and both are Arabic.
      if (arabic.test(cell)) score += Math.min(cell.length, 12);
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/**
 * Every column that holds words — not just the best one.
 *
 * The nūn sākinah sheet has TWO example columns per row, Nūn Sākinah and
 * Tanwīn, and both are recorded. A column counts when its Arabic cells are
 * mostly words rather than single letters (the Letter column) and it carries
 * at least two fifths of the best column's score, so a meaning column with a
 * stray Arabic letter in a note does not qualify. Read in row order, the slots
 * follow the sheet left to right within each row.
 */
export function guessWordColumns(rows: string[][]): number[] {
  // A header that says "Slot" settles it: that column, and only that
  // column, names the files — whatever Arabic the other columns carry (the
  // alphabet sheet's "What to say" is full of it).
  const slot = slotColumn(rows);
  if (slot >= 0) return [slot];
  const arabicLetters = /[ء-ي]/g;
  const width = Math.max(0, ...rows.map((r) => r.length));
  const scores: number[] = [];
  for (let c = 0; c < width; c++) {
    let score = 0;
    for (const row of rows) {
      const letters = ((row[c] ?? '').match(arabicLetters) ?? []).length;
      if (letters >= 2) score += Math.min(letters, 12);
    }
    scores.push(score);
  }
  const best = Math.max(0, ...scores);
  const picked = scores.map((s, c) => (best > 0 && s >= best * 0.4 ? c : -1)).filter((c) => c >= 0);
  return picked.length ? picked : [guessWordColumn(rows)];
}
