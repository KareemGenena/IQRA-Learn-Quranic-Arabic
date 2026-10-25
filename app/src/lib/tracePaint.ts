/**
 * Painting a letter as it is traced, pixel by pixel.
 *
 * The glyph is drawn on a canvas and every pixel of its ink is given to the
 * NEAREST point of the letter's strokes: which stroke, and how far along it
 * (a share of the stroke's length; a dot's pixels are all at 0). Revealing
 * the color is then a rule per pixel — shown when its stroke is done, or is
 * the stroke being traced and the finger has passed its share — so the
 * start of ط's loop lights the start of the loop and nothing else: not the
 * lower loop, not the stem, and a dot never lights its neighbor. A wide
 * brush along the path did all of those (the author, 2026-10-25); a brush
 * cannot know which pixels are "the corresponding segment", a nearest-point
 * assignment is exactly that.
 *
 * Built once per card and size (a few tens of milliseconds: ~100 k ink
 * pixels against ~100 stroke points); painted on every change in a single
 * pass over the raster. The same font and the same string as the SVG text
 * the overlay measures, so the two coincide.
 */

import type { Pt, StrokeTemplate } from './tracing';

export interface PaintRaster {
  /** Device pixels across and down, and the scale from CSS px. */
  w: number;
  h: number;
  scale: number;
  /** Per device pixel: the stroke it belongs to (−1 off the ink). */
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

  // every stroke point, flattened: x, y (CSS px), stroke, share
  const px: number[] = [], py: number[] = [], ps: number[] = [], pf: number[] = [];
  templates.forEach((t, s) => {
    t.pts.forEach((p, k) => {
      px.push(p[0]);
      py.push(p[1]);
      ps.push(s);
      pf.push(t.length > 0 ? t.cum[k] / t.length : 0);
    });
  });
  const n = px.length;
  const stroke = new Int16Array(w * h).fill(-1);
  const frac = new Float32Array(w * h);
  const reach = new Array<number>(templates.length).fill(0);
  if (!n) return { w, h, scale, stroke, frac, dotRadius: reach };

  for (let y = 0; y < h; y++) {
    const cy = (y + 0.5) / scale;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (data[i * 4 + 3] < 96) continue;
      const cx = (x + 0.5) / scale;
      let best = 0, bd = Infinity;
      for (let k = 0; k < n; k++) {
        const dx = px[k] - cx, dy = py[k] - cy;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = k; }
      }
      stroke[i] = ps[best];
      frac[i] = pf[best];
      const s = ps[best];
      if (templates[s].pts.length === 1) reach[s] = Math.max(reach[s], Math.sqrt(bd));
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
