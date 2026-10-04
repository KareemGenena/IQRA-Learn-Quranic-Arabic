import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isTanwinLigature, splitClusters, unreadFinalMaddah, unreadFinalNasal } from '../lib/graphemes';
import type { LetterCluster } from '../lib/graphemes';
import type { HighlightPhase } from '../lib/timing';

interface Props {
  text: string;
  clusters: LetterCluster[];
  /** Cluster to highlight while it is being pronounced, or null. */
  activeIndex: number | null;
  /** 'ghunna' while the ghunna that opens the active letter sounds — the
   *  highlight stays on the letter but changes colour. */
  activePhase?: HighlightPhase;
  /** Cluster awaiting a calibration tap — marked with an underline. */
  pendingIndex?: number | null;
  /** Leading clusters forming the ال prefix, painted in the accent colour. */
  prefixClusters?: number;
  /** Clusters written but not pronounced — painted faded. */
  silentClusters?: number[];
  /** A single cluster painted as the letter being taught. */
  markCluster?: number;
  /** Grey the last letter's vowel: it is written, and at the stop it is not said. */
  dimFinalMark?: boolean;
  className?: string;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** CSS for a mask: which pixels of a layer show. */
interface Mask {
  image: string;
  size: string;
  position: string;
}

/**
 * A copy of the text painted in another colour. `clip` limits it to a
 * horizontal range (the ال prefix, the taught letter); `mask` limits it to the
 * exact pixels of a mark or a letter; `dx` shifts it sideways (the strokes of
 * a staggered tanwīn).
 */
interface Layer {
  className: string;
  clip?: string;
  mask?: Mask;
  dx?: number;
  /** Lifts the strokes of a pair clear of a ط ظ stem. */
  dy?: number;
}

/** The small م of an iqlāb mīm, drawn beside its kasra or ḍamma. */
interface MiniMeem {
  left: number;
  top: number;
  size: number;
  dim: boolean;
  /** Where the glyph is cut off, in px from the span's top: a short tail. */
  cutAt?: number;
}

/** Shared so the default prop is a STABLE reference — a fresh `[]` default
 *  would change identity on every render and re-trigger the layout effect
 *  forever. */
const NO_CLUSTERS: number[] = [];

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

const sameJson = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x, i) => JSON.stringify(x) === JSON.stringify(b[i]));

/** Short vowels and tanween — what a stop takes off the final letter. */
const FINAL_VOWEL_RE = /[ً-ِ]/g;
/** The maddah — unread on a final long vowel with no next word to reach. */
const MADDAH_RE = /ٓ/g;

/**
 * The STAGGERED tanwīn (مُتَتَابِع, U+08F0–08F2) is not in this font — KFGQPC
 * Uthmanic Hafs v09 has only the stacked forms, and a browser that cannot find
 * the glyph falls back to another font for the whole letter. So the string is
 * DISPLAYED with the single vowel in its place; that vowel's pixels are then
 * erased from the base text and drawn twice, side by side, from masked copies
 * of the very same string. The data keeps U+08F0–08F2: that is what the
 * timing engine and the greying read.
 *
 * The low iqlāb mīm is kasra + U+06E2 in this font's own spelling, but the
 * glyph the font makes of that pair carries a vertical stem the author's
 * Mushaf does not — it writes a small مـ. So the pair is displayed as the kasra
 * alone and the small مـ is drawn beneath it (`MiniMeem`).
 */
const STAGGERED_TO_VOWEL: Record<string, string> = { 'ࣰ': 'َ', 'ࣱ': 'ُ', 'ࣲ': 'ِ' };
const STAGGERED_RE = /[ࣰ-ࣲ]/g;
const KASRA_MEEM_RE = /ِۢ/g;
const KASRA = 'ِ';
const SMALL_HIGH_MEEM = 'ۢ';
const ZWJ = '‍';
/** Zero-width space: takes the small mīm's place in the display string so it
 *  keeps the length of the data string — every cluster offset indexes both. */
const ZWSP = '​';
const toDisplay = (s: string) =>
  s.replace(STAGGERED_RE, (m) => STAGGERED_TO_VOWEL[m]).replace(KASRA_MEEM_RE, KASRA + ZWSP);

/** Letters that join to the letter after them, and those that never do. */
const JOINS_FORWARD = /[بت-خس-غف-هيئ]/;
const MARKS_RE = /[ً-ٰٟۖ-ࣰۭ-ࣲ]/g;
const lettersOf = (s: string) => [...s.replace(MARKS_RE, '')];

/**
 * Two strings whose difference is exactly one letter: the text up to and
 * including cluster i, and the text up to the letter before it — each with a
 * joiner where the cut letter joined, so the neighbours keep the forms they
 * have in the whole word. Both are drawn from the RIGHT edge, and in Arabic a
 * glyph's place depends only on what precedes it, so the letter lands where
 * it lands in the full text and nothing else moves. Taking the letter out of
 * the full string instead shifted every word after it into the picture.
 */
function letterPair(display: string, clusters: LetterCluster[], i: number): [string, string] {
  const c = clusters[i];
  const prev = clusters[i - 1];
  const next = clusters[i + 1];
  const letters = lettersOf(c.text);
  const last = letters[letters.length - 1] ?? '';
  const joinedFromPrev = !!prev && prev.end === c.start && JOINS_FORWARD.test(lettersOf(prev.text).pop() ?? '');
  const joinedToNext = !!next && next.start === c.end && JOINS_FORWARD.test(last);
  const withLetter = display.slice(0, c.end) + (joinedToNext ? ZWJ : '');
  const without = display.slice(0, c.start) + (joinedFromPrev ? ZWJ : '');
  return [withLetter, without];
}

/** The string with some marks of one cluster removed. */
function withoutMarks(display: string, c: LetterCluster, re: RegExp): string {
  return display.slice(0, c.start) + display.slice(c.start, c.end).replace(re, '') + display.slice(c.end);
}

// ── the pixel work ──────────────────────────────────────────────────────────

let inkCtx: CanvasRenderingContext2D | null | undefined;
function ctx2d() {
  if (inkCtx === undefined) inkCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  return inkCtx;
}

/** Font metrics the canvas can tell us. */
function fontAscent(font: string): number | null {
  const c = ctx2d();
  if (!c) return null;
  c.font = font;
  return c.measureText('م').fontBoundingBoxAscent;
}

/** Where the small مـ's ink sits inside its own line box, at its own size. */
interface MiniMetrics {
  fontAsc: number;
  asc: number;
  /** The advance, which is the span's width, and where the ink ends inside it. */
  width: number;
  inkRight: number;
  desc: number;
}
function miniMetrics(font: string): MiniMetrics | null {
  const c = ctx2d();
  if (!c) return null;
  c.font = font;
  c.direction = 'ltr';
  c.textAlign = 'start';
  const m = c.measureText(MINI_MEEM);
  return {
    fontAsc: m.fontBoundingBoxAscent,
    asc: m.actualBoundingBoxAscent,
    desc: m.actualBoundingBoxDescent,
    width: m.width,
    inkRight: m.actualBoundingBoxRight,
  };
}

/**
 * Where to put a small م so that its ink's RIGHT edge stands at `inkRightX`
 * and its ink's top at `inkTopY` (wrap CSS px). The span is centred on
 * `left` by its own transform and its top is a line box, not the glyph's
 * ink, hence the two corrections.
 */
function placeMini(mini: MiniMetrics, inkRightX: number, inkTopY: number, size: number, dim: boolean, keep?: number): MiniMeem {
  const inkTop = mini.fontAsc - mini.asc;
  return {
    left: inkRightX - mini.inkRight + mini.width / 2,
    top: inkTopY - inkTop,
    size,
    dim,
    // `keep` is the share of the glyph's ink height that stays: the font's
    // isolated م hangs a long stem, the Mushaf's small mīm a short tail.
    cutAt: keep === undefined ? undefined : inkTop + keep * (mini.asc + mini.desc),
  };
}

/** The small iqlāb mīm the Mushaf writes: an isolated م at half the text
 *  size — a head with a tail hanging from it. Under a kasra the tail is
 *  short (`MINI_KEEP` of the glyph); beside a ḍamma it runs down past the
 *  shadda, the glyph's full length. */
const MINI_MEEM = 'م';
const MINI_SIZE = 0.5;
const MINI_SIZE_DAMMA = 0.575;
const MINI_KEEP = 0.75;
const FATHA = 'َ';
const DAMMA = 'ُ';

/**
 * Everything the pixel work needs to draw a string exactly where the page
 * draws it: the canvas covers the word's box plus a margin either side (marks
 * overhang the first and last letters), scaled to the device.
 */
interface Stage {
  font: string;
  /** Canvas size in CSS px, and the device scale. */
  w: number;
  h: number;
  dpr: number;
  /** The canvas's left edge, in wrap coordinates (negative: the margin). */
  originX: number;
  /** Where the string's right edge and baseline fall, in canvas CSS px. */
  right: number;
  baseline: number;
}

/** The alpha channel of the string drawn on the stage. */
function drawAlpha(stage: Stage, s: string): Uint8ClampedArray | null {
  const c = ctx2d();
  if (!c) return null;
  const cv = c.canvas;
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  if (cv.width !== pw || cv.height !== ph) {
    cv.width = pw;
    cv.height = ph;
  }
  c.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
  c.clearRect(0, 0, stage.w, stage.h);
  c.font = stage.font;
  c.direction = 'rtl';
  c.textAlign = 'right';
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#000';
  c.fillText(s, stage.right, stage.baseline);
  const data = c.getImageData(0, 0, pw, ph).data;
  const alpha = new Uint8ClampedArray(pw * ph);
  for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = data[j];
  return alpha;
}

const INK = 40;

/**
 * The pixels that are ink in `a` and not in `b`, within a horizontal window
 * (CSS px, wrap coordinates), grown by one device pixel so anti-aliased edges
 * are covered. This is how a mark, or a letter, is found: draw the string
 * with it and without it, and the difference is exactly it — where the font
 * put it, on that letter, in that form. Bounding boxes cannot do this (a kasra
 * under a final ع lies inside the letter's own tail), and any other font's
 * glyph would sit at the wrong height.
 */
function diffMask(stage: Stage, a: Uint8ClampedArray, b: Uint8ClampedArray, x0: number, x1: number): Uint8ClampedArray | null {
  const raw = rawDiff(stage, a, b, x0, x1);
  return raw && dilate(stage, raw, b);
}

/** The exact difference — ink in `a` and not in `b` — within a window, ungrown. */
function rawDiff(stage: Stage, a: Uint8ClampedArray, b: Uint8ClampedArray, x0: number, x1: number): Uint8ClampedArray | null {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const px0 = Math.max(0, Math.floor((x0 - stage.originX) * stage.dpr));
  const px1 = Math.min(pw, Math.ceil((x1 - stage.originX) * stage.dpr));
  const raw = new Uint8ClampedArray(pw * ph);
  let any = false;
  for (let y = 0; y < ph; y++) {
    for (let x = px0; x < px1; x++) {
      const i = y * pw + x;
      if (a[i] > INK && b[i] <= INK) {
        raw[i] = 255;
        any = true;
      }
    }
  }
  return any ? raw : null;
}

/**
 * Grow a mask by one device pixel so anti-aliased edges are covered — but
 * never onto ink that is there WITHOUT the thing (a neighbouring letter, the
 * stem a kasra crosses): erasing or greying those pixels notched the mīm's
 * tail under مُّسۡتَقِيمࣲ and fringed every letter a mark touches.
 */
function dilate(stage: Stage, raw: Uint8ClampedArray, b: Uint8ClampedArray): Uint8ClampedArray {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const out = new Uint8ClampedArray(pw * ph);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = y * pw + x;
      if (!raw[i]) continue;
      // Every pixel of the mask itself stays, whatever `b` has there: the
      // foot put back under a stem lies on the joiner's stub in `b`, and
      // only the GROWTH is kept off ink.
      out[i] = 255;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= ph) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= pw) continue;
          const j = yy * pw + xx;
          if (b[j] <= INK / 2) out[j] = 255;
        }
      }
    }
  }
  return out;
}

/**
 * A mask for a layer that will be SHIFTED by (sx, sy) device pixels: drop
 * every pixel that would land on ink of `b` once moved. The second stroke of
 * a staggered pair is the first one's pixels moved sideways, and its
 * anti-aliased edge, moved, fell on the tail of the مࣲ of مُّسۡتَقِيمࣲ and
 * lightened it — the layer paints over the base, and the base is only ever
 * erased where the UNSHIFTED mark was.
 */
function offInk(stage: Stage, m: Uint8ClampedArray, b: Uint8ClampedArray, sx: number, sy: number): Uint8ClampedArray {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const out = new Uint8ClampedArray(pw * ph);
  for (let y = 0; y < ph; y++) {
    const yy = y + sy;
    if (yy < 0 || yy >= ph) continue;
    for (let x = 0; x < pw; x++) {
      const i = y * pw + x;
      if (!m[i]) continue;
      const xx = x + sx;
      if (xx < 0 || xx >= pw) continue;
      if (b[yy * pw + xx] <= INK / 2) out[i] = m[i];
    }
  }
  return out;
}

/** A run of columns, with the top of the tallest run in them (device px). */
interface Band {
  left: number;
  right: number;
  top: number;
}

/**
 * The STEM of a mask: the contiguous band of columns around the tallest
 * vertical run whose own longest run is at least `share` of it. A silent alif
 * is found as the difference between the word drawn with it and without it,
 * and in this font the letter BEFORE a final alif takes a raised joining
 * form: so that difference also held the neighbour's changed join, the
 * underside of its bowl, its vowel moved a few pixels — and, standing on
 * their own further along, vertical pieces of the neighbour tall enough to
 * pass for a stem (a stripe through the ع of سِرَاعࣰا, the kāf's arm of
 * مَلِكࣰا). Hence ONE band, and only the one the tallest run is in. A leaning
 * stroke's per-column runs are shorter than its height, which is why the
 * share is 0.35 and not 0.5.
 */
function stemBand(stage: Stage, m: Uint8ClampedArray, share: number): Band | null {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const run = new Int32Array(pw);
  const runTop = new Int32Array(pw);
  let tallest = 0, at = -1;
  for (let x = 0; x < pw; x++) {
    let cur = 0;
    for (let y = 0; y <= ph; y++) {
      if (y < ph && m[y * pw + x]) {
        cur++;
        continue;
      }
      if (cur > run[x]) {
        run[x] = cur;
        runTop[x] = y - cur;
      }
      cur = 0;
    }
    if (run[x] > tallest) {
      tallest = run[x];
      at = x;
    }
  }
  if (!tallest) return null;
  let left = at, right = at, top = runTop[at];
  while (left > 0 && run[left - 1] >= share * tallest) {
    left--;
    if (runTop[left] < top) top = runTop[left];
  }
  while (right < pw - 1 && run[right + 1] >= share * tallest) {
    right++;
    if (runTop[right] < top) top = runTop[right];
  }
  return { left, right, top };
}

/** `m` restricted to the band's columns. */
function inBand(stage: Stage, m: Uint8ClampedArray, band: Band): Uint8ClampedArray {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const out = new Uint8ClampedArray(pw * ph);
  for (let y = 0; y < ph; y++) for (let x = band.left; x <= band.right; x++) out[y * pw + x] = m[y * pw + x];
  return out;
}

/**
 * Ink of `a` inside the band's columns, from the stem's top down: the
 * letter's own foot, which the joiner's stub in the drawing without the
 * letter had taken out of the difference (black under the stem of the lam of
 * لِّلنَّاسِ). Nothing above the stem's top — that could only be a neighbour's
 * vowel leaning over.
 */
function bandInk(stage: Stage, a: Uint8ClampedArray, band: Band): Uint8ClampedArray {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const out = new Uint8ClampedArray(pw * ph);
  for (let y = band.top; y < ph; y++) for (let x = band.left; x <= band.right; x++) if (a[y * pw + x] > INK) out[y * pw + x] = 255;
  return out;
}

/** `m` inside columns [x0, x1] and above row y1 (device px). */
function clipRect(stage: Stage, m: Uint8ClampedArray, x0: number, x1: number, y1: number): Uint8ClampedArray {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const out = new Uint8ClampedArray(pw * ph);
  for (let y = 0; y < Math.min(ph, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(pw - 1, x1); x++) out[y * pw + x] = m[y * pw + x];
  return out;
}

/** 4-connected components of a mask. */
interface Components {
  label: Int32Array;
  size: number[];
  box: { x0: number; y0: number; x1: number; y1: number }[];
}
function components(stage: Stage, m: Uint8ClampedArray): Components {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const label = new Int32Array(pw * ph).fill(-1);
  const size: number[] = [];
  const box: Components['box'] = [];
  const stack: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || label[i] >= 0) continue;
    const id = size.length;
    size.push(0);
    box.push({ x0: pw, y0: ph, x1: -1, y1: -1 });
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const j = stack.pop() as number;
      const x = j % pw, y = (j - x) / pw;
      size[id]++;
      const b = box[id];
      if (x < b.x0) b.x0 = x;
      if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y;
      if (y > b.y1) b.y1 = y;
      const nb = [x > 0 ? j - 1 : -1, x < pw - 1 ? j + 1 : -1, y > 0 ? j - pw : -1, y < ph - 1 ? j + pw : -1];
      for (const k of nb) {
        if (k >= 0 && m[k] && label[k] < 0) {
          label[k] = id;
          stack.push(k);
        }
      }
    }
  }
  return { label, size, box };
}

/** One component of `m`, by its label. */
function pick(stage: Stage, m: Uint8ClampedArray, label: Int32Array, id: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(m.length);
  for (let i = 0; i < m.length; i++) if (m[i] && label[i] === id) out[i] = 255;
  void stage;
  return out;
}

/** A component's box in wrap CSS px. */
function toBox(stage: Stage, b: { x0: number; y0: number; x1: number; y1: number }): Box {
  return { left: stage.originX + b.x0 / stage.dpr, top: b.y0 / stage.dpr, width: (b.x1 + 1 - b.x0) / stage.dpr, height: (b.y1 + 1 - b.y0) / stage.dpr };
}

/** `m` without its components of fewer than `minPx` pixels — anti-aliased leftovers of a cut. */
function dropSpecks(stage: Stage, m: Uint8ClampedArray, minPx: number): Uint8ClampedArray {
  const { label, size } = components(stage, m);
  const out = new Uint8ClampedArray(m.length);
  for (let i = 0; i < m.length; i++) if (m[i] && size[label[i]] >= minPx) out[i] = 255;
  return out;
}

/**
 * `d` without the components that have a counterpart in `r` within `dist`
 * device pixels: a letter part that MOVED between two drawings shows up as a
 * piece in each difference, close together — the dots of ة, which the
 * composite glyph of ةَۢ sets a few pixels away from where the bare ة has
 * them. A mark that is simply absent from the other drawing has no
 * counterpart and stays.
 */
function dropMoved(stage: Stage, d: Uint8ClampedArray, r: Uint8ClampedArray, dist: number): Uint8ClampedArray {
  const cd = components(stage, d);
  const cr = components(stage, r);
  // A counterpart is close AND the same shape — a box of the same width and
  // height, a similar number of pixels: the composite's outline differs from
  // the bare glyph's by slivers all over the body, and the fatḥa sitting
  // right above the moved dots is not to be taken for them.
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(3, 0.3 * Math.max(a, b));
  const moved = cd.box.map((b, i) =>
    cr.box.some((o, j) => {
      const ratio = cr.size[j] / cd.size[i];
      return (
        ratio > 0.5 && ratio < 2 &&
        near(b.x1 - b.x0, o.x1 - o.x0) && near(b.y1 - b.y0, o.y1 - o.y0) &&
        o.x0 - dist <= b.x1 && o.x1 + dist >= b.x0 && o.y0 - dist <= b.y1 && o.y1 + dist >= b.y0
      );
    }),
  );
  const out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i++) if (d[i] && !moved[cd.label[i]]) out[i] = 255;
  return out;
}

/** How many pixels of `m` land on ink of `b` once shifted by (sx, sy) device px. */
function collisions(stage: Stage, m: Uint8ClampedArray, b: Uint8ClampedArray, sx: number, sy: number): number {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  let n = 0;
  for (let y = 0; y < ph; y++) {
    const yy = y + sy;
    if (yy < 0 || yy >= ph) continue;
    for (let x = 0; x < pw; x++) {
      if (!m[y * pw + x]) continue;
      const xx = x + sx;
      if (xx >= 0 && xx < pw && b[yy * pw + xx] > INK / 2) n++;
    }
  }
  return n;
}

/**
 * The alif of a lam-alif ligature, by the ligature's geometry. In this font
 * the lam is the upright stroke on the right, running from the top down to
 * the base — one vertical run above and below the junction alike — and the
 * alif is the arm that comes in from its rounded head at the top-left and
 * touches the lam part-way down (قَوۡلࣰا, وَرَجُلࣰا) or near the base (عَمَلࣰا,
 * ظِلࣰّا). What leaves the junction downwards to the left is the lam's foot,
 * black. So the alif is, row by row from the arm's first row, the ink left
 * of the right-hand run, down to the row where the arm's right edge stops
 * advancing towards the lam — either because the two have merged into one
 * run (then the arm's tip is the merged run's part left of the lam's edge,
 * as long as that run's own left edge still advances) or because the left
 * run has begun to draw back into the foot. Runs are counted on the FULL
 * drawing: the joiner's stub in the drawing without the ligature punches a
 * hole through the lam's stroke. Null when the two arms are never seen.
 */
function ligatureAlif(stage: Stage, ink: Uint8ClampedArray, full: Uint8ClampedArray, box: Box, pad: number): Uint8ClampedArray | null {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const px0 = Math.max(0, Math.floor((box.left - pad - stage.originX) * stage.dpr));
  // The ligature's own box on the right: past it lies the join from the letter before.
  const px1 = Math.min(pw, Math.ceil((box.left + box.width - stage.originX) * stage.dpr));
  const rows: [number, number][][] = [];
  for (let y = 0; y < ph; y++) {
    const runs: [number, number][] = [];
    let start = -1, gap = 0;
    for (let x = px0; x <= px1; x++) {
      const on = x < px1 && full[y * pw + x] > INK;
      if (on) {
        if (start < 0) start = x;
        gap = 0;
      } else if (start >= 0) {
        // A gap of a pixel or two inside a stroke is anti-aliasing, not a split.
        if (++gap > 2 || x === px1) {
          runs.push([start, x - gap]);
          start = -1;
          gap = 0;
        }
      }
    }
    rows.push(runs);
  }
  const firstTwo = rows.findIndex((r) => r.length >= 2);
  if (firstTwo < 0) return null;
  const [l0, r0] = rows[firstTwo];
  const gap0 = (l0[1] + r0[0]) / 2;
  // Walk down the arm. `edge` is how far right it has reached.
  const cut = new Float64Array(ph).fill(NaN); // per row: the alif is ink left of this x
  let edge = -Infinity;
  let lamLeft = r0[0];
  for (let y = firstTwo; y < ph; y++) {
    const runs = rows[y];
    if (!runs.length) break;
    if (runs.length >= 2) {
      // Everything but the right-hand run is the arm: a gap of anti-aliasing
      // inside it (where the head's curl meets the stroke) splits it in two.
      const arm = runs[runs.length - 2], right = runs[runs.length - 1];
      if (arm[1] < edge - 1) break; // drawing back: the foot has begun
      if (arm[1] > edge) edge = arm[1];
      lamLeft = right[0];
      cut[y] = right[0];
    } else {
      // Merged: the arm's tip lies left of the lam's edge, while the run's
      // own left edge still advances; once it draws back, the foot has begun.
      const run = runs[0];
      if (run[0] < edge - 1 && rows[y - 1].length === 1) break;
      if (run[0] > edge) edge = run[0];
      cut[y] = lamLeft;
      // A merged run followed by two runs again is the junction of an arm
      // meeting the lam part-way down: stop there.
      if (y + 1 < ph && rows[y + 1].length >= 2) break;
    }
  }
  const out = new Uint8ClampedArray(pw * ph);
  for (let yy = 0; yy < ph; yy++) {
    const runs = rows[yy];
    for (let x = 0; x < pw; x++) {
      const i = yy * pw + x;
      if (!ink[i]) continue;
      let alif = false;
      if (yy < firstTwo) alif = runs.length === 1 && (runs[0][0] + runs[0][1]) / 2 < gap0;
      else if (!Number.isNaN(cut[yy])) alif = x < cut[yy];
      if (alif) out[i] = 255;
    }
  }
  return out;
}

/** Drop every mask pixel at or below a y (wrap CSS px). */
function above(stage: Stage, m: Uint8ClampedArray, y: number): Uint8ClampedArray {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const py = Math.max(0, Math.min(ph, Math.round(y * stage.dpr)));
  const out = new Uint8ClampedArray(m);
  out.fill(0, py * pw);
  return out;
}

/** The base's ink in the left `share` of a cluster's box — the alif half of a lam-alif ligature. */
function leftHalfMask(stage: Stage, base: Uint8ClampedArray, box: Box, share: number): Uint8ClampedArray | null {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const px0 = Math.max(0, Math.floor((box.left - stage.originX) * stage.dpr));
  const px1 = Math.min(pw, Math.ceil((box.left + box.width * share - stage.originX) * stage.dpr));
  const out = new Uint8ClampedArray(pw * ph);
  let any = false;
  for (let y = 0; y < ph; y++) {
    for (let x = px0; x < px1; x++) {
      const i = y * pw + x;
      if (base[i] > INK / 2) {
        out[i] = 255;
        any = true;
      }
    }
  }
  return any ? out : null;
}

/** Bounding box of a mask, in wrap CSS px. */
function bounds(stage: Stage, m: Uint8ClampedArray): Box | null {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  let x0 = pw, x1 = -1, y0 = ph, y1 = -1;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (!m[y * pw + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { left: stage.originX + x0 / stage.dpr, top: y0 / stage.dpr, width: (x1 + 1 - x0) / stage.dpr, height: (y1 + 1 - y0) / stage.dpr };
}

/** `a` without the pixels of `b`. */
const minus = (a: Uint8ClampedArray, b: Uint8ClampedArray): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i++) if (a[i] && !b[i]) out[i] = 255;
  return out;
};

const union = (ms: Uint8ClampedArray[]): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(ms[0].length);
  for (const m of ms) for (let i = 0; i < m.length; i++) if (m[i]) out[i] = 255;
  return out;
};

/**
 * A CSS mask from a pixel array, positioned for an element whose box sits at
 * (`boxLeft`, `boxTop`) in wrap coordinates. `invert` keeps everything BUT the
 * pixels — that is the base text with its redrawn marks erased.
 */
function toMask(stage: Stage, m: Uint8ClampedArray, boxLeft: number, boxTop: number, invert = false): Mask | null {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const cv = document.createElement('canvas');
  cv.width = pw;
  cv.height = ph;
  const c = cv.getContext('2d');
  if (!c) return null;
  const img = c.createImageData(pw, ph);
  const d = img.data;
  for (let i = 0, j = 0; i < m.length; i++, j += 4) {
    d[j] = d[j + 1] = d[j + 2] = 255;
    d[j + 3] = invert ? 255 - m[i] : m[i];
  }
  c.putImageData(img, 0, 0);
  return {
    image: `url(${cv.toDataURL('image/png')})`,
    size: `${stage.w}px ${stage.h}px`,
    position: `${(stage.originX - boxLeft).toFixed(2)}px ${(-boxTop).toFixed(2)}px`,
  };
}

const maskStyle = (m: Mask | undefined): React.CSSProperties =>
  m
    ? {
        maskImage: m.image,
        maskSize: m.size,
        maskPosition: m.position,
        maskRepeat: 'no-repeat',
        WebkitMaskImage: m.image,
        WebkitMaskSize: m.size,
        WebkitMaskPosition: m.position,
        WebkitMaskRepeat: 'no-repeat',
      }
    : {};

/** How far apart the two strokes of a staggered tanwīn sit (centre to
 *  centre), as a share of one stroke's width: the first stroke's tail runs
 *  into the second's head, as in the Mushaf. */
const STAGGER = 0.7;
/** Letters whose stem stands LEFT of the body: the Mushaf sets the pair's
 *  first stroke over the stem and the second beyond it, not over the loop
 *  where the font hangs a single mark. */
const STEM_LEFT = /[طظ]/; // ط ظ

/** The topmost ink in an alpha array within a window — a stem's top — in wrap CSS px. */
function topInk(stage: Stage, a: Uint8ClampedArray, x0: number, x1: number): { x: number; y: number } | null {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const px0 = Math.max(0, Math.floor((x0 - stage.originX) * stage.dpr));
  const px1 = Math.min(pw, Math.ceil((x1 - stage.originX) * stage.dpr));
  for (let y = 0; y < ph; y++) {
    let sum = 0, n = 0;
    for (let x = px0; x < px1; x++) if (a[y * pw + x] > INK) { sum += x; n++; }
    if (n) return { x: stage.originX + sum / n / stage.dpr, y: y / stage.dpr };
  }
  return null;
}

/** How far the pair must clear a ط ظ stem, in em. */
const STEM_GAP = 0.04;

/** Ink pixels of `a` that `b` lacks, within a window — how far two renderings disagree. */
function countExtra(stage: Stage, a: Uint8ClampedArray, b: Uint8ClampedArray, x0: number, x1: number): number {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const px0 = Math.max(0, Math.floor((x0 - stage.originX) * stage.dpr));
  const px1 = Math.min(pw, Math.ceil((x1 - stage.originX) * stage.dpr));
  let n = 0;
  for (let y = 0; y < ph; y++) for (let x = px0; x < px1; x++) { const i = y * pw + x; if (a[i] > INK && b[i] <= INK) n++; }
  return n;
}

/**
 * Renders an Arabic word as ONE intact text node — never split into spans,
 * which would break the cursive joining — and paints on top of it:
 *
 *  - the active letter's highlight, an absolutely positioned box measured
 *    with the Range API;
 *  - recoloured letter ranges (the ال prefix, the taught letter), each a full
 *    copy of the same string clipped to that range;
 *  - recoloured or redrawn MARKS and silent letters, each a full copy of the
 *    same string masked to that thing's own pixels — the same string, so the
 *    shaping is identical and the copy lands exactly on the original; the
 *    base text has those pixels erased, so nothing shows through underneath.
 *    Stripping a mark out of the copy instead is not safe in this font: it
 *    swaps letter glyphs for some letter-plus-mark pairs, and the two copies
 *    no longer coincided (زَكِيَّةَۢ blurred).
 */
export function ArabicWord({
  text,
  clusters,
  activeIndex,
  activePhase = null,
  pendingIndex = null,
  prefixClusters = 0,
  silentClusters = NO_CLUSTERS,
  markCluster,
  dimFinalMark = false,
  className,
}: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [highlight, setHighlight] = useState<Box | null>(null);
  const [pending, setPending] = useState<Box | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [baseMask, setBaseMask] = useState<Mask | null>(null);
  const [meems, setMeems] = useState<MiniMeem[]>([]);
  /** What is drawn: the staggered tanwīn as its single vowel, kasra + small
   *  mīm as the kasra (plus a zero-width space). Same length as `text`, so
   *  every cluster offset holds — a card whose display string came out
   *  shorter lost every layer, because its last cluster could not be measured. */
  const displayText = toDisplay(text);
  if (displayText.length !== text.length) throw new Error(`ArabicWord: display string changed length for "${text}"`);
  /** Bumped when the webfont finishes loading or the box resizes, so every
   *  measurement is redone against the real glyphs. */
  const [revision, setRevision] = useState(0);
  /** Stable dependency for the silent list — callers may hand us a new array
   *  with identical contents on every render. */
  const silentKey = silentClusters.join(',');

  /** Screen box of clusters [from, to), relative to the wrapper. */
  const measure = useCallback((from: number, to: number): Box | null => {
    const wrap = wrapRef.current;
    const node = textRef.current?.firstChild;
    if (!wrap || !node || from < 0 || to > clusters.length || from >= to) return null;

    const range = document.createRange();
    try {
      range.setStart(node, clusters[from].start);
      range.setEnd(node, clusters[to - 1].end);
    } catch {
      return null;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    const wrapRect = wrap.getBoundingClientRect();
    return {
      left: rect.left - wrapRect.left,
      top: rect.top - wrapRect.top,
      width: rect.width,
      height: rect.height,
    };
  }, [clusters]);

  // Re-measure once the webfont is ready and whenever the element actually
  // changes size: glyph metrics differ between the fallback and real font.
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && setRevision((r) => r + 1));
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') {
      return () => {
        alive = false;
      };
    }
    // Only react to a real size change — bumping on every notification would
    // feed back into the layer effect and spin.
    let lastW = -1;
    let lastH = -1;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (Math.abs(width - lastW) < 0.5 && Math.abs(height - lastH) < 0.5) return;
      lastW = width;
      lastH = height;
      setRevision((r) => r + 1);
    });
    ro.observe(wrap);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const textEl = textRef.current;
    if (!wrap || !textEl) return;
    const wrapRect = wrap.getBoundingClientRect();
    const wrapWidth = wrapRect.width;

    // Clip horizontally only: the full height is kept so tall diacritics and
    // low vowels are never sliced off.
    const clipTo = (from: number, to: number): string | null => {
      const box = measure(from, to);
      if (!box) return null;
      const right = Math.max(0, wrapWidth - (box.left + box.width));
      return `inset(0 ${right.toFixed(2)}px 0 ${Math.max(0, box.left).toFixed(2)}px)`;
    };

    const next: Layer[] = [];
    const nextMeems: MiniMeem[] = [];
    let nextBase: Mask | null = null;

    // The ال prefix goes under everything else. A silent sun lam sits INSIDE
    // it (ٱلنَّاسِ), and the grey must win there — this was the order before
    // the masks too: prefix, then silent, then the marked letter on top.
    if (prefixClusters > 0) {
      const clip = clipTo(0, prefixClusters);
      if (clip) next.push({ className: 'layer-prefix', clip });
    }
    const underPixels = next.length;

    // ── the pixel-exact layers ───────────────────────────────────────────
    const cs = getComputedStyle(textEl);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const fontPx = parseFloat(cs.fontSize) || 40;
    const asc = fontAscent(font);
    const textRect = textEl.getBoundingClientRect();
    if (asc !== null && clusters.length && textRect.width > 0) {
      const margin = fontPx * 0.6;
      const stage: Stage = {
        font,
        w: wrapWidth + margin * 2,
        h: wrapRect.height,
        dpr: Math.min(3, window.devicePixelRatio || 1),
        originX: -margin,
        right: textRect.right - wrapRect.left + margin,
        baseline: textRect.top - wrapRect.top + asc,
      };
      const base = drawAlpha(stage, displayText);
      if (base) {
        const nasal = unreadFinalNasal(text);
        const erase: Uint8ClampedArray[] = [];
        const grey: Uint8ClampedArray[] = [];
        const boxOf = (i: number) => measure(i, i + 1);
        const window_ = (b: Box) => [b.left - fontPx * 0.5, b.left + b.width + fontPx * 0.5] as const;
        /** The pixels of the marks `re` takes off cluster i, and the drawing without them. */
        const markPair = (i: number, re: RegExp, from = displayText): { m: Uint8ClampedArray; without: Uint8ClampedArray } | null => {
          const b = boxOf(i);
          if (!b) return null;
          const without = withoutMarks(from, clusters[i], re);
          if (without === from) return null;
          const a = from === displayText ? base : drawAlpha(stage, from);
          const bb = drawAlpha(stage, without);
          if (!a || !bb) return null;
          const [x0, x1] = window_(b);
          const m = diffMask(stage, a, bb, x0, x1);
          return m && { m, without: bb };
        };
        const markPixels = (i: number, re: RegExp, from = displayText) => markPair(i, re, from)?.m ?? null;
        const devPx = (v: number) => Math.round(v * stage.dpr);

        clusters.forEach((c, i) => {
          const isFinalNasal = nasal?.index === i;

          // A staggered tanwīn: erase the single vowel, draw it twice.
          const staggered = c.text.match(STAGGERED_RE);
          if (staggered) {
            const vowel = STAGGERED_TO_VOWEL[staggered[0]];
            const pair = markPair(i, new RegExp(vowel, 'g'));
            let m = pair?.m ?? null;
            // Over a shadda the font composes shadda + vowel into one glyph,
            // whose shadda half differs a little from the plain shadda — and
            // those differences would be taken for the vowel and nicked out
            // of the base. The vowel sits wholly above the shadda, so keep
            // only what lies above the plain shadda's top.
            if (m && vowel !== KASRA && c.text.includes('ّ')) {
              const shaddaOnly = withoutMarks(displayText, c, new RegExp(vowel, 'g'));
              const s = markPixels(i, /ّ/g, shaddaOnly);
              const sb = s && bounds(stage, s);
              // The cut leaves anti-aliased specks of the composite's shadda
              // half behind; nothing of a vowel is that small.
              if (sb) m = dropSpecks(stage, above(stage, m, sb.top + fontPx * 0.04), 8);
            }
            const bb = m && bounds(stage, m);
            if (m && bb && pair) {
              erase.push(m);
              // Where each stroke goes, from the single mark's place (CSS px).
              // The Mushaf steps the pair DOWN TO THE LEFT: the second stroke
              // about 0.6 of the mark's width left of the first and 0.75 below
              // it for a fatḥa (measured on عَذَابࣰا and قَوۡلࣰا), a shallower
              // 0.55 / 0.45 for a kasra (بِعَذَابࣲ); ḍammas sit side by side. The
              // stroke nearer the letter keeps the mark's own height — the lower
              // one of a fatḥa pair, the upper one of a kasra pair.
              const w = bb.width;
              const strokes =
                vowel === FATHA
                  ? [{ x: 0.3 * w, y: -0.75 * w }, { x: -0.3 * w, y: 0 }]
                  : vowel === KASRA
                    ? [{ x: 0.275 * w, y: 0 }, { x: -0.275 * w, y: 0.45 * w }]
                    : [{ x: (w * STAGGER) / 2, y: 0 }, { x: -(w * STAGGER) / 2, y: 0 }];
              const [s1, s2] = strokes;
              // Except over ط ظ, where the first stroke goes above the stem and
              // the second past it, and the pair is lifted so that neither tail
              // touches the stem.
              let shift = 0;
              let lift = 0;
              const b = boxOf(i);
              if (b && STEM_LEFT.test(lettersOf(c.text)[0] ?? '') && vowel !== KASRA) {
                const stem = topInk(stage, pair.without, b.left - fontPx * 0.1, b.left + b.width + fontPx * 0.1);
                if (stem) {
                  shift = stem.x - (bb.left + bb.width / 2 + s1.x);
                  const clear = stem.y - fontPx * STEM_GAP;
                  const bottom = bb.top + bb.height + Math.max(s1.y, s2.y);
                  if (bottom > clear) lift = clear - bottom;
                }
              }
              // A stroke must not run into a neighbour's ink: shifted out from
              // under the single mark, the kasra pair of رَّسُولࣲ met the tail
              // of the و. Slide both strokes away from the side that collides,
              // a device pixel at a time, as far as 0.15 em, keeping the best.
              let slide = 0;
              {
                const hit = (s: { x: number; y: number }, d: number) =>
                  collisions(stage, m, pair.without, devPx(shift + s.x + d), devPx(lift + s.y));
                const hits = (d: number) => hit(s1, d) + hit(s2, d);
                let best = hits(0);
                if (best > 0) {
                  const dir = hit(s1, 0) >= hit(s2, 0) ? -1 : 1;
                  for (let d = 1 / stage.dpr; d <= fontPx * 0.15; d += 1 / stage.dpr) {
                    const h = hits(dir * d);
                    if (h < best) {
                      best = h;
                      slide = dir * d;
                    }
                    if (h === 0) break;
                  }
                }
              }
              const cls = `layer-stroke${isFinalNasal ? ' layer-silent' : ''}`;
              for (const s of strokes) {
                // Each stroke is masked to the vowel's pixels minus any that
                // would still land on a letter once shifted.
                const dx = shift + slide + s.x;
                const dy = lift + s.y;
                const mask = toMask(stage, offInk(stage, m, pair.without, devPx(dx), devPx(dy)), 0, 0);
                if (mask) next.push({ className: cls, mask, dx, dy: dy || undefined });
              }
            }
          }

          // A low iqlāb mīm: the kasra stays (grey if final); the مـ is drawn.
          if (KASRA_MEEM_RE.test(c.text)) {
            KASRA_MEEM_RE.lastIndex = 0;
            const m = markPixels(i, /ِ/g);
            const bb = m && bounds(stage, m);
            if (m && bb) {
              if (isFinalNasal) {
                erase.push(m);
                grey.push(m);
              }
              // The Mushaf sets the small م to the LEFT of the kasra, a gap of
              // about 0.6 of the kasra's length between them, its head level
              // with the kasra and its tail reaching about a kasra's length
              // below it (measured on كِرَامِۭ بَرَرَةٍ).
              const size = fontPx * MINI_SIZE;
              const mini = miniMetrics(`${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`);
              if (mini) nextMeems.push(placeMini(mini, bb.left - 0.55 * bb.width, bb.top + fontPx * 0.02, size, isFinalNasal, MINI_KEEP));
            }
          }
          KASRA_MEEM_RE.lastIndex = 0;

          // A small high mīm on a ḍamma (صُمُّۢ بُكۡمٌ, عَذَابٌ أَلِيمُۢ): the font
          // sets a flat small mīm beside the ḍamma's shadda; the Mushaf sets
          // a small م to the LEFT of the ḍamma, its head's top above the
          // ḍamma's, its tail hanging down past the shadda (measured on
          // صُمُّۢ). So the font's mīm is erased and the small م drawn. On a
          // fatḥa the font's glyph stands.
          let dammaMeem: Uint8ClampedArray | null = null;
          if (c.text.includes(DAMMA) && c.text.includes(SMALL_HIGH_MEEM) && !KASRA_MEEM_RE.test(c.text)) {
            KASRA_MEEM_RE.lastIndex = 0;
            const b = boxOf(i);
            // All the cluster's marks at once, against the bare letter, with
            // the letter parts the composite glyph moves dropped: taking the
            // mīm out alone moved the ḍamma up into its place, and the mīm then
            // passed for a moved ḍamma. The font sets the mīm to the LEFT of
            // the other marks (مُّۢ: ḍamma over shadda, mīm beside them), or
            // else above them; the ḍamma is the topmost of the rest.
            const bare = b && drawAlpha(stage, withoutMarks(displayText, c, MARKS_RE));
            if (b && bare) {
              const [x0, x1] = window_(b);
              const d = rawDiff(stage, base, bare, x0, x1);
              const r = rawDiff(stage, bare, base, x0, x1);
              const marks = d ? (r ? dropMoved(stage, d, r, Math.round(fontPx * 0.1 * stage.dpr)) : d) : null;
              const parts = marks && components(stage, marks);
              if (parts) {
                const pieces = parts.size
                  .map((n, id) => ({ id, n, box: parts.box[id] }))
                  .filter((p) => p.n >= 6)
                  .sort((p, q) => p.box.y0 - q.box.y0);
                const leftOfAll = pieces.find((p) => pieces.every((q) => q === p || p.box.x1 < q.box.x0));
                const meem = leftOfAll ?? pieces[0];
                const damma = pieces.find((p) => p !== meem);
                if (meem && damma) {
                  dammaMeem = dilate(stage, pick(stage, marks, parts.label, meem.id), bare);
                  erase.push(dammaMeem);
                  const db = toBox(stage, damma.box);
                  const size = fontPx * MINI_SIZE_DAMMA;
                  const mini = miniMetrics(`${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`);
                  if (mini) nextMeems.push(placeMini(mini, db.left - 0.3 * db.width, db.top - 0.4 * db.height, size, isFinalNasal));
                }
              }
            }
          }
          KASRA_MEEM_RE.lastIndex = 0;

          // A final iqlāb mīm on a fatḥa or ḍamma: the font's own glyph, greyed
          // — vowel and mīm together, as the difference against the BARE
          // letter. The font composes ة + fatḥa + mīm into one glyph that sets
          // the ة's dots a few pixels from where the bare ة has them, so the
          // difference also holds the moved dots: a piece in each direction,
          // close together, which `dropMoved` takes out. (Removing the mīm
          // alone compared the composite with the plain ةَ and greyed the dots
          // of زَكِيَّةَۢ.)
          if (isFinalNasal && !staggered && c.text.includes(SMALL_HIGH_MEEM) && !KASRA_MEEM_RE.test(c.text)) {
            const b = boxOf(i);
            const bare = drawAlpha(stage, withoutMarks(displayText, c, /[َُۢ]/g));
            if (b && bare) {
              const [x0, x1] = window_(b);
              const d = rawDiff(stage, base, bare, x0, x1);
              const r = rawDiff(stage, bare, base, x0, x1);
              if (d) {
                const m = dilate(stage, r ? dropMoved(stage, d, r, Math.round(fontPx * 0.1 * stage.dpr)) : d, bare);
                erase.push(m);
                // On a ḍamma the font's mīm is erased and redrawn, not greyed in place.
                grey.push(dammaMeem ? minus(m, dammaMeem) : m);
              }
            }
          }
          KASRA_MEEM_RE.lastIndex = 0;

          // The alif fused into a lam-alif ligature after a tanwīn fatḥ, when a
          // word follows: silent, and half of one glyph — its left half is greyed.
          if (isTanwinLigature(clusters, i) && i < clusters.length - 1) {
            const b = boxOf(i);
            if (b) {
              // The ligature's own ink, marks off, and the alif told from the
              // lam by the strokes' geometry (`ligatureAlif`). A straight cut
              // at the middle greyed the alif's head and the lam's foot and
              // left the alif's arm black.
              const letters = displayText.slice(0, c.start) + displayText.slice(c.start, c.end).replace(MARKS_RE, '');
              const [, without] = letterPair(displayText, clusters, i);
              const aa = drawAlpha(stage, letters);
              const ww = drawAlpha(stage, without);
              const [x0, x1] = [b.left - fontPx * 0.08, b.left + b.width + fontPx * 0.08];
              const ink = aa && ww && rawDiff(stage, aa, ww, x0, x1);
              const split = ink && aa && ww && ligatureAlif(stage, ink, aa, b, fontPx * 0.08);
              const m = split && ww ? dilate(stage, split, ww) : leftHalfMask(stage, base, b, 0.5);
              if (m) {
                erase.push(m);
                grey.push(m);
              }
            }
          }

          // A silent letter: greyed to its own pixels, not to a box that its
          // neighbours' ink runs into (the ع before a tanwīn alif).
          if (silentClusters.includes(i)) {
            const b = boxOf(i);
            const [withLetter, without] = letterPair(displayText, clusters, i);
            const aa = drawAlpha(stage, withLetter);
            const bb = drawAlpha(stage, without);
            if (b && aa && bb) {
              // A tight window: the letter before this one may take a different
              // contextual form when it is not followed by it (ع before alif),
              // and that letter's marks then move — they must not be swept in.
              // A lam keeps to its own box, base stroke and all; an alif is
              // reduced to its stem, since the raised join of the letter before
              // it lands inside even a tight window.
              const letter = lettersOf(c.text)[0] ?? '';
              const stem = /[اٱ]/.test(letter);
              const pad = letter === 'ل' ? 0 : fontPx * 0.08;
              const x0 = b.left - pad;
              const x1 = b.left + b.width + pad;
              let raw = rawDiff(stage, aa, bb, x0, x1);
              let against = bb;
              if (raw && letter === 'ل') {
                // The lam keeps its whole difference inside its box, and gets
                // back the foot under its stem that the joiner's stub took out.
                const band = stemBand(stage, raw, 0.35);
                if (band) {
                  const cols = { left: Math.floor((x0 - stage.originX) * stage.dpr), right: Math.ceil((x1 - stage.originX) * stage.dpr), top: band.top };
                  raw = union([raw, bandInk(stage, base, cols)]);
                }
              }
              if (raw && stem) {
                // The letter before may have ink where the alif stands once the
                // alif is not there to fuse with — a plain medial kāf's arm
                // crosses the whole of مَلِكࣰا's alif, which the subtraction then
                // cut into fragments. Then the pair is taken one letter further
                // back, and the stem filter finds the alif in the ligature.
                const prev = clusters[i - 1];
                const pp = clusters[i - 2];
                const intrudes = countExtra(stage, bb, aa, x0, x1);
                const size = raw.reduce((n, v) => n + (v ? 1 : 0), 0);
                if (prev && prev.end === c.start && intrudes > size * 0.05) {
                  const joined = !!pp && pp.end === prev.start && JOINS_FORWARD.test(lettersOf(pp.text).pop() ?? '');
                  const bb2 = drawAlpha(stage, displayText.slice(0, prev.start) + (joined ? ZWJ : ''));
                  if (bb2) {
                    raw = rawDiff(stage, aa, bb2, x0, x1);
                    against = bb2;
                  }
                }
                // The alif is its stem's columns and the foot beneath them,
                // plus its own marks (a zero) and, for ٱ, the waṣl sign — each
                // found as marks are, by the difference its removal makes,
                // never as "whatever stands above the stem": that was the
                // neighbour's fatḥa leaning over the alif of فَٱنقَلَبُواْ.
                const band = raw && stemBand(stage, raw, 0.35);
                if (raw && band) {
                  const parts = [inBand(stage, raw, band), bandInk(stage, base, band)];
                  const own = markPixels(i, MARKS_RE);
                  if (own) parts.push(own);
                  if (letter === 'ٱ') {
                    const plain = drawAlpha(stage, displayText.slice(0, c.start) + c.text.replace('ٱ', 'ا') + displayText.slice(c.end));
                    // Only what stands over the stem: ا is narrower than ٱ, so
                    // every letter after it moves, and the difference held a
                    // crescent of the nūn's tooth in فَٱنقَلَبُواْ.
                    const pad = Math.round(fontPx * 0.1 * stage.dpr);
                    const sign = plain && diffMask(stage, base, plain, x0, x1);
                    if (sign) parts.push(clipRect(stage, sign, band.left - pad, band.right + pad, band.top + 2));
                  }
                  raw = union(parts);
                }
              }
              const m = raw && dilate(stage, raw, against);
              // The prefix drawing must agree with the word itself in that
              // window. When the letter is part of a ligature the font forms
              // only with what FOLLOWS (the لله of بِٱللَّهِ), it does not, and the
              // mask would grey the wrong pixels — fall back to a clipped box.
              const disagree = countExtra(stage, aa, base, x0, x1);
              const size = m ? m.reduce((n, v) => n + (v ? 1 : 0), 0) : 0;
              if (m && disagree <= size * 0.05) {
                erase.push(m);
                grey.push(m);
              } else {
                const clip = clipTo(i, i + 1);
                if (clip) next.push({ className: 'layer-silent', clip });
              }
            }
          }
        });

        const last = clusters.length - 1;
        if (dimFinalMark) {
          const m = markPixels(last, FINAL_VOWEL_RE);
          if (m) { erase.push(m); grey.push(m); }
        }
        if (unreadFinalMaddah(text)) {
          const m = markPixels(last, MADDAH_RE);
          if (m) { erase.push(m); grey.push(m); }
        }

        if (grey.length) {
          const mask = toMask(stage, union(grey), 0, 0);
          // Under the strokes and the clipped fallbacks, over the prefix.
          if (mask) next.splice(underPixels, 0, { className: 'layer-silent', mask });
        }
        if (erase.length) {
          nextBase = toMask(stage, union(erase), textRect.left - wrapRect.left, textRect.top - wrapRect.top, true);
        }
      }
    }

    // ── the marked letter, over everything ──────────────────────────────
    if (markCluster !== undefined) {
      const clip = clipTo(markCluster, markCluster + 1);
      if (clip) next.push({ className: 'layer-mark', clip });
    }

    // Only commit a real change: setting an equal-but-new array would
    // re-render, which would run this effect again.
    setLayers((prev) => (sameJson(prev, next) ? prev : next));
    setMeems((prev) => (sameJson(prev, nextMeems) ? prev : nextMeems));
    setBaseMask((prev) => (JSON.stringify(prev) === JSON.stringify(nextBase) ? prev : nextBase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, prefixClusters, silentKey, markCluster, dimFinalMark, clusters, text, revision]);

  useLayoutEffect(() => {
    const box = activeIndex === null ? null : measure(activeIndex, activeIndex + 1);
    const next = box && {
      left: box.left - 3,
      top: box.top - 2,
      width: box.width + 6,
      height: box.height + 4,
    };
    setHighlight((prev) => (sameBox(prev, next) ? prev : next));
  }, [measure, activeIndex, text, revision]);

  useLayoutEffect(() => {
    const next = pendingIndex === null ? null : measure(pendingIndex, pendingIndex + 1);
    setPending((prev) => (sameBox(prev, next) ? prev : next));
  }, [measure, pendingIndex, text, revision]);

  /**
   * Shrink a long phrase until it fits, rather than letting it run out of the
   * card.
   *
   * Wrapping would be the obvious answer and is the wrong one here: every
   * highlight and every recoloured layer is measured off one bounding rect,
   * so a phrase broken across two lines would clip the wrong region on both.
   * Staying on one line and scaling the type keeps that geometry exactly as
   * it was. The floor is 0.55 — below that the marks stop being legible, and
   * a phrase that long wants breaking up in the sheet.
   */
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = textRef.current;
    if (!wrap || !el) return;

    const fit = () => {
      wrap.style.removeProperty('--fit');
      const cs = getComputedStyle(wrap);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const available = wrap.clientWidth - pad;
      const needed = el.scrollWidth;
      if (!available || !needed) return;
      const scale = Math.max(0.55, Math.min(1, available / needed));
      if (scale >= 1) return; // it already fits; nothing was changed
      wrap.style.setProperty('--fit', String(scale));
      // Every layer was measured off the old layout, so take them again.
      setRevision((r) => r + 1);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span ref={wrapRef} className={`arabic-word ${className ?? ''}`}>
      {highlight && (
        <span
          className={`letter-highlight${activePhase ? ` phase-${activePhase}` : ''}`}
          style={{ left: highlight.left, top: highlight.top, width: highlight.width, height: highlight.height }}
        />
      )}
      {pending && (
        <span
          className="letter-pending"
          style={{ left: pending.left, width: pending.width, top: pending.top + pending.height }}
        />
      )}
      <span ref={textRef} className="arabic-text" dir="rtl" lang="ar" style={maskStyle(baseMask ?? undefined)}>
        {displayText}
      </span>
      {layers.map((layer, i) => (
        <span
          key={`${layer.className}-${i}`}
          className={`arabic-text arabic-layer ${layer.className}`}
          style={{
            ...(layer.clip ? { clipPath: layer.clip } : {}),
            ...maskStyle(layer.mask),
            ...(layer.dx || layer.dy ? { transform: `translate(${(layer.dx ?? 0).toFixed(2)}px, ${(layer.dy ?? 0).toFixed(2)}px)` } : {}),
          }}
          dir="rtl"
          lang="ar"
          aria-hidden="true"
        >
          {displayText}
        </span>
      ))}
      {meems.map((m, i) => (
        <span
          key={`meem-${i}`}
          className={`arabic-text tanwin-meem${m.dim ? ' layer-silent' : ''}`}
          style={{
            left: m.left,
            top: m.top,
            fontSize: m.size,
            ...(m.cutAt === undefined ? {} : { clipPath: `polygon(-100% 0, 200% 0, 200% ${m.cutAt.toFixed(2)}px, -100% ${m.cutAt.toFixed(2)}px)` }),
          }}
          dir="rtl"
          lang="ar"
          aria-hidden="true"
        >
          {MINI_MEEM}
        </span>
      ))}
    </span>
  );
}

/** Convenience for callers that don't already have the clusters. */
export function useClusters(text: string): LetterCluster[] {
  const ref = useRef<{ text: string; clusters: LetterCluster[] }>({ text: '', clusters: [] });
  if (ref.current.text !== text) ref.current = { text, clusters: splitClusters(text) };
  return ref.current.clusters;
}
