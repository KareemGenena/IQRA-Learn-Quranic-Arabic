import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { splitClusters, unreadFinalMaddah, unreadFinalNasal } from '../lib/graphemes';
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
}

/** The small مـ of a low iqlāb mīm, placed under its kasra. */
interface MiniMeem {
  left: number;
  top: number;
  size: number;
  dim: boolean;
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
function miniMetrics(font: string): { fontAsc: number; asc: number } | null {
  const c = ctx2d();
  if (!c) return null;
  c.font = font;
  const m = c.measureText('م' + ZWJ);
  return { fontAsc: m.fontBoundingBoxAscent, asc: m.actualBoundingBoxAscent };
}

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
  if (!any) return null;
  // Dilate by one device pixel.
  const out = new Uint8ClampedArray(pw * ph);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = y * pw + x;
      if (!raw[i]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= ph) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < pw) out[yy * pw + xx] = 255;
        }
      }
    }
  }
  return out;
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

/** The x (canvas px) of the topmost ink in a mask-like alpha array within a window — a stem's top. */
function topInkX(stage: Stage, a: Uint8ClampedArray, x0: number, x1: number): number | null {
  const pw = Math.ceil(stage.w * stage.dpr);
  const ph = Math.ceil(stage.h * stage.dpr);
  const px0 = Math.max(0, Math.floor((x0 - stage.originX) * stage.dpr));
  const px1 = Math.min(pw, Math.ceil((x1 - stage.originX) * stage.dpr));
  for (let y = 0; y < ph; y++) {
    let sum = 0, n = 0;
    for (let x = px0; x < px1; x++) if (a[y * pw + x] > INK) { sum += x; n++; }
    if (n) return stage.originX + sum / n / stage.dpr;
  }
  return null;
}

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
        /** The pixels of the marks `re` takes off cluster i. */
        const markPixels = (i: number, re: RegExp, from = displayText) => {
          const b = boxOf(i);
          if (!b) return null;
          const without = withoutMarks(from, clusters[i], re);
          if (without === from) return null;
          const a = from === displayText ? base : drawAlpha(stage, from);
          const bb = drawAlpha(stage, without);
          if (!a || !bb) return null;
          const [x0, x1] = window_(b);
          return diffMask(stage, a, bb, x0, x1);
        };

        clusters.forEach((c, i) => {
          const isFinalNasal = nasal?.index === i;

          // A staggered tanwīn: erase the single vowel, draw it twice.
          const staggered = c.text.match(STAGGERED_RE);
          if (staggered) {
            const vowel = STAGGERED_TO_VOWEL[staggered[0]];
            const m = markPixels(i, new RegExp(vowel, 'g'));
            const bb = m && bounds(stage, m);
            if (m && bb) {
              erase.push(m);
              const mask = toMask(stage, m, 0, 0);
              if (mask) {
                const half = (bb.width * STAGGER) / 2;
                // Centred on the single mark's place — except over ط ظ, where
                // the first stroke goes above the stem and the second past it.
                let shift = 0;
                const b = boxOf(i);
                if (b && STEM_LEFT.test(lettersOf(c.text)[0] ?? '') && vowel !== KASRA) {
                  const bare = drawAlpha(stage, withoutMarks(displayText, c, new RegExp(vowel, 'g')));
                  const stemX = bare && topInkX(stage, bare, b.left - fontPx * 0.1, b.left + b.width + fontPx * 0.1);
                  if (stemX !== null && stemX !== undefined) shift = stemX - (bb.left + bb.width / 2 + half);
                }
                const cls = `layer-stroke${isFinalNasal ? ' layer-silent' : ''}`;
                next.push({ className: cls, mask, dx: shift + half });
                next.push({ className: cls, mask, dx: shift - half });
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
              // The span's top is its line box, not the glyph's ink: pull it up
              // by the gap between the two so the مـ starts just under the kasra.
              const size = fontPx * 0.42;
              const mini = miniMetrics(`${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`);
              nextMeems.push({
                left: bb.left + bb.width / 2,
                top: bb.top + bb.height + fontPx * 0.02 - (mini ? mini.fontAsc - mini.asc : 0),
                size,
                dim: isFinalNasal,
              });
            }
          }
          KASRA_MEEM_RE.lastIndex = 0;

          // A final iqlāb mīm on a fatḥa or ḍamma: the font's own glyph, greyed
          // (vowel and mīm, found separately so the composite glyph is never
          // compared with the plain letter).
          if (isFinalNasal && !staggered && c.text.includes(SMALL_HIGH_MEEM) && !KASRA_MEEM_RE.test(c.text)) {
            const meem = markPixels(i, /ۢ/g);
            const withoutMeem = withoutMarks(displayText, c, /ۢ/g);
            const vowel = markPixels(i, /[َُ]/g, withoutMeem);
            for (const m of [meem, vowel]) if (m) { erase.push(m); grey.push(m); }
          }
          KASRA_MEEM_RE.lastIndex = 0;

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
              const x0 = b.left - fontPx * 0.08;
              const x1 = b.left + b.width + fontPx * 0.08;
              const m = diffMask(stage, aa, bb, x0, x1);
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
          if (mask) next.unshift({ className: 'layer-silent', mask });
        }
        if (erase.length) {
          nextBase = toMask(stage, union(erase), textRect.left - wrapRect.left, textRect.top - wrapRect.top, true);
        }
      }
    }

    // ── the clipped layers ───────────────────────────────────────────────
    if (prefixClusters > 0) {
      const clip = clipTo(0, prefixClusters);
      if (clip) next.push({ className: 'layer-prefix', clip });
    }
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
            ...(layer.dx ? { transform: `translateX(${layer.dx.toFixed(2)}px)` } : {}),
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
          style={{ left: m.left, top: m.top, fontSize: m.size }}
          dir="rtl"
          lang="ar"
          aria-hidden="true"
        >
          {'م' + ZWJ}
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
