/**
 * Painting a letter as it is traced, pixel by pixel.
 *
 * The glyph is drawn on a canvas and every pixel of its ink is given a
 * MOMENT: which stroke lights it, and how far along that stroke (a share of
 * its length; a dot's pixels are all at 0). Revealing the color is then a
 * rule per pixel — shown when its stroke is done, or is the stroke being
 * traced and the finger has passed its share — so the start of ط's loop
 * lights the start of the loop and nothing else: not the lower loop, not the
 * stem, and a dot never lights its neighbor. A wide brush along the path did
 * all of those (the author, 2026-10-25); a brush cannot know which pixels
 * are "the corresponding segment".
 *
 * The moment is found in two steps (2026-10-25, second round):
 *
 * - **Distance to the line, not to its points.** A pixel's place along a
 *   stroke is its projection onto the nearest SEGMENT of the polyline, so
 *   the share is continuous and the front sweeps square across the stroke.
 *   The first version took the nearest of the 48 sample points, and where
 *   two parts of a letter run close — the head of ع along the top of its
 *   body, the two sides of هـ's loop — the winner flipped from pixel to pixel
 *   with the sampling and the front came out as teeth.
 *
 * - **Ink the pen has passed is lit, whichever part owns it.** Every pixel
 *   within reach of a segment — its stroke's own half-width there, plus a
 *   little — with a clear line of ink between them is covered by that
 *   segment, and the pixel lights at the EARLIEST moment any covering
 *   segment reaches it. Where a stroke crosses or runs over itself (هـ) or
 *   a later stroke stands on an earlier one (ط's stem on its loop) the
 *   first pass inks the overlap, as a pen does on paper, and the later pass
 *   finds it inked: no hole waits for the second pass, and nothing is
 *   painted twice. The reach is the stroke's own thickness, measured on the
 *   glyph where the segment lies, so it ends where the ink does; and the
 *   line of sight keeps it from leaping a gap — the teeth of س, a dot and
 *   its letter, the hamza inside ك. A pixel no segment reaches falls to the
 *   nearest segment it can see.
 *
 * Built once per card and size (~100 k ink pixels against a few hundred
 * segments, with a box test before each projection); painted on every
 * change in a single pass over the raster. The same font and the same
 * string as the SVG text the overlay measures, so the two coincide.
 */

import type { Pt, StrokeTemplate } from './tracing';

export interface PaintRaster {
  /** Device pixels across and down, and the scale from CSS px. */
  w: number;
  h: number;
  scale: number;
  /** Per device pixel: the stroke that lights it (−1 off the ink). */
  stroke: Int16Array;
  /** Per device pixel: how far along that stroke, 0–1. */
  frac: Float32Array;
  /** Per stroke: for a dot, how far its pixels reach from its center (CSS px); else 0. */
  dotRadius: number[];
}

export interface GlyphPlacement {
  fontSize: number;
  textX: number;
  baseline: number;
}

/** Draws the letter the way the overlay's SVG text draws it. */
function drawGlyph(ctx: CanvasRenderingContext2D, letter: string, font: string, g: GlyphPlacement, scale: number, color: string): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.font = `${g.fontSize}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'rtl';
  ctx.fillStyle = color;
  ctx.fillText(letter, g.textX, g.baseline);
}

/** How far past a stroke's own half-width its ink reaches, and the floor in device px. */
const REACH = 1.15;
const REACH_PX = 1.5;
/** A chord through a junction runs on into the crossing part; cap it at this many median half-widths. */
const CHORD_CAP = 2.5;
const CHORD_MAX = 80;

/** One segment of a stroke, in device pixels. */
interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  len: number;
  /** The stroke it belongs to, and the share of that stroke at `a` and per px. */
  s: number;
  t0: number;
  dt: number;
  dot: boolean;
  /** The ink's half-width where the segment lies. */
  hw: number;
  /** How far from the segment a pixel may be and still be its ink (and its square). */
  reach: number;
  reach2: number;
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
}

/** True when the straight line between two points crosses no bare pixel. */
function clearLine(ink: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const x = Math.floor(x0 + dx * u), y = Math.floor(y0 + dy * u);
    if (x < 0 || y < 0 || x >= w || y >= h || !ink[y * w + x]) return false;
  }
  return true;
}

/** Half the chord of ink through (x, y) along the direction (nx, ny), in device px. */
function halfChord(ink: Uint8Array, w: number, h: number, x: number, y: number, nx: number, ny: number): number {
  const at = (px: number, py: number) => {
    const ix = Math.floor(px), iy = Math.floor(py);
    return ix >= 0 && iy >= 0 && ix < w && iy < h && ink[iy * w + ix] === 1;
  };
  if (!at(x, y)) return 0;
  let plus = 0, minus = 0;
  while (plus < CHORD_MAX && at(x + nx * (plus + 0.5), y + ny * (plus + 0.5))) plus += 0.5;
  while (minus < CHORD_MAX && at(x - nx * (minus + 0.5), y - ny * (minus + 0.5))) minus += 0.5;
  return (plus + minus) / 2;
}

function segmentsOf(templates: StrokeTemplate[], scale: number, ink: Uint8Array, w: number, h: number): Seg[] {
  const segs: Seg[] = [];
  templates.forEach((t, s) => {
    if (t.pts.length === 1) {
      const x = t.pts[0][0] * scale, y = t.pts[0][1] * scale;
      // a dot's reach is its own radius: the shorter of two chords through its center
      const hw = Math.min(halfChord(ink, w, h, x, y, 1, 0), halfChord(ink, w, h, x, y, 0, 1));
      const reach = hw + 0.5;
      segs.push({ ax: x, ay: y, bx: x, by: y, len: 0, s, t0: 0, dt: 0, dot: true, hw, reach, reach2: reach * reach, minx: x, miny: y, maxx: x, maxy: y });
      return;
    }
    const mine: Seg[] = [];
    for (let k = 0; k + 1 < t.pts.length; k++) {
      const a = t.pts[k], b = t.pts[k + 1];
      const ax = a[0] * scale, ay = a[1] * scale, bx = b[0] * scale, by = b[1] * scale;
      const len = Math.hypot(bx - ax, by - ay);
      if (len === 0) continue;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const hw = halfChord(ink, w, h, mx, my, -(by - ay) / len, (bx - ax) / len);
      mine.push({
        ax, ay, bx, by, len, s,
        t0: t.length > 0 ? t.cum[k] / t.length : 0,
        dt: t.length > 0 ? 1 / t.length / scale : 0,
        dot: false,
        hw,
        reach: 0,
        reach2: 0,
        minx: Math.min(ax, bx), miny: Math.min(ay, by), maxx: Math.max(ax, bx), maxy: Math.max(ay, by),
      });
    }
    // a chord through a junction (ط's loop under its stem) runs on into the
    // other part; it is capped at a few times the stroke's usual half-width
    const sorted = mine.map((g) => g.hw).filter((v) => v > 0).sort((p, q) => p - q);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    for (const g of mine) {
      const hw = median > 0 ? Math.min(g.hw, median * CHORD_CAP) : g.hw;
      g.hw = hw;
      g.reach = hw * REACH + REACH_PX;
      g.reach2 = g.reach * g.reach;
    }
    segs.push(...mine);
  });
  return segs;
}

export function buildRaster(
  letter: string,
  font: string,
  g: GlyphPlacement,
  size: number,
  templates: StrokeTemplate[],
  scale: number,
): PaintRaster | null {
  const w = Math.round(size * scale), h = w;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  drawGlyph(ctx, letter, font, g, scale, '#000');
  const data = ctx.getImageData(0, 0, w, h).data;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = data[i * 4 + 3] >= 96 ? 1 : 0;

  const stroke = new Int16Array(w * h).fill(-1);
  const frac = new Float32Array(w * h);
  const reach = new Array<number>(templates.length).fill(0);
  const segs = segmentsOf(templates, scale, ink, w, h);
  if (!segs.length) return { w, h, scale, stroke, frac, dotRadius: reach };

  // the segments within reach of the pixel in hand (reused per pixel)
  const cs: number[] = [], ct: number[] = [], cpx: number[] = [], cpy: number[] = [];
  for (let y = 0; y < h; y++) {
    const cy = y + 0.5;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!ink[i]) continue;
      const cx = x + 0.5;
      // the nearest segment at all, and every segment whose ink this may be
      let anyD = Infinity, anyS = -1, anyT = 0;
      cs.length = ct.length = cpx.length = cpy.length = 0;
      for (const sg of segs) {
        const ox = cx < sg.minx ? sg.minx - cx : cx > sg.maxx ? cx - sg.maxx : 0;
        const oy = cy < sg.miny ? sg.miny - cy : cy > sg.maxy ? cy - sg.maxy : 0;
        const boxD = ox * ox + oy * oy;
        if (boxD > sg.reach2 && boxD >= anyD) continue;
        let u = 0;
        if (sg.len > 0) {
          u = ((cx - sg.ax) * (sg.bx - sg.ax) + (cy - sg.ay) * (sg.by - sg.ay)) / (sg.len * sg.len);
          u = u < 0 ? 0 : u > 1 ? 1 : u;
        }
        const px = sg.ax + (sg.bx - sg.ax) * u, py = sg.ay + (sg.by - sg.ay) * u;
        const dx = cx - px, dy = cy - py;
        const d = dx * dx + dy * dy;
        const t = sg.t0 + u * sg.len * sg.dt;
        if (d < anyD) { anyD = d; anyS = sg.s; anyT = t; }
        if (d <= sg.reach2) { cs.push(sg.s); ct.push(t); cpx.push(px); cpy.push(py); }
      }
      if (anyS < 0) continue;
      // the earliest moment among those with a clear line of ink — the line
      // walked only for a candidate that would be earlier than the best so far
      let earlyS = 32767, earlyT = Infinity;
      for (let k = 0; k < cs.length; k++) {
        if (cs[k] > earlyS || (cs[k] === earlyS && ct[k] >= earlyT)) continue;
        if (!clearLine(ink, w, h, cx, cy, cpx[k], cpy[k])) continue;
        earlyS = cs[k];
        earlyT = ct[k];
      }
      let s: number, t: number;
      if (earlyS !== 32767) { s = earlyS; t = earlyT; }
      else {
        // nothing reaches it: the nearest segment, whether or not it can see it
        s = anyS;
        t = anyT;
      }
      stroke[i] = s;
      frac[i] = t;
      if (templates[s].pts.length === 1) {
        const p = templates[s].pts[0];
        reach[s] = Math.max(reach[s], Math.hypot(cx / scale - p[0], cy / scale - p[1]));
      }
    }
  }
  return { w, h, scale, stroke, frac, dotRadius: reach };
}

/**
 * Paints the gray glyph with its colored pixels shown where `shown` says:
 * per stroke, −1 for none, a share 0–1 for "this far along", 2 for all.
 */
export class Painter {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly gray: ImageData | null = null;
  private readonly tint: Map<string, ImageData> = new Map();
  private readonly letter: string;
  private readonly font: string;
  private readonly g: GlyphPlacement;
  readonly raster: PaintRaster;

  constructor(canvas: HTMLCanvasElement, raster: PaintRaster, letter: string, font: string, g: GlyphPlacement, grayColor: string) {
    this.raster = raster;
    this.letter = letter;
    this.font = font;
    this.g = g;
    canvas.width = raster.w;
    canvas.height = raster.h;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;
    this.gray = this.layer(grayColor);
  }

  /** The glyph in one color, as pixels. */
  private layer(color: string): ImageData | null {
    const c = document.createElement('canvas');
    c.width = this.raster.w;
    c.height = this.raster.h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    drawGlyph(ctx, this.letter, this.font, this.g, this.raster.scale, color);
    return ctx.getImageData(0, 0, this.raster.w, this.raster.h);
  }

  paint(shown: ArrayLike<number>, color: string): void {
    const ctx = this.ctx;
    const gray = this.gray;
    if (!ctx || !gray) return;
    let tint = this.tint.get(color);
    if (!tint) {
      tint = this.layer(color) ?? gray;
      this.tint.set(color, tint);
    }
    const out = new ImageData(new Uint8ClampedArray(gray.data), gray.width, gray.height);
    const o = out.data, t = tint.data;
    const { stroke, frac } = this.raster;
    for (let i = 0, j = 0; i < stroke.length; i++, j += 4) {
      const s = stroke[i];
      if (s < 0) continue;
      const th = shown[s];
      if (th === undefined || th < 0) continue;
      if (th >= 2 || frac[i] <= th) {
        o[j] = t[j];
        o[j + 1] = t[j + 1];
        o[j + 2] = t[j + 2];
        o[j + 3] = t[j + 3];
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(out, 0, 0);
  }
}

/** A point a little way along the stroke from `from`, and the tangent there — for the arrow. */
export function aheadOf(t: StrokeTemplate, from: number, by: number): { at: Pt; angle: number } | null {
  if (t.pts.length < 2 || t.length === 0) return null;
  const s0 = Math.min(t.length - 1, from + by);
  const s1 = Math.min(t.length, s0 + Math.max(4, by * 0.4));
  const a = pointOn(t, s0), b = pointOn(t, s1);
  return { at: a, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
}

function pointOn(t: StrokeTemplate, s: number): Pt {
  const at = Math.max(0, Math.min(t.length, s));
  let i = 1;
  while (i < t.cum.length - 1 && t.cum[i] < at) i++;
  const a = t.pts[i - 1], b = t.pts[i];
  const span = t.cum[i] - t.cum[i - 1];
  const u = span === 0 ? 0 : (at - t.cum[i - 1]) / span;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}
