/**
 * Tracing a letter with a finger: the rule of what counts.
 *
 * A letter is a list of strokes in writing order, each a polyline (or a
 * single point: a dot to tap), in the frame of the glyph's ink box — the
 * font's own glyph thinned and walked (scripts/tracing/), or the teacher's
 * own hand (the card's authoring mode, kept in the cloud). The learner
 * traces the current stroke from its start to its end; the finger may be
 * slow, may stop, may lift and come back — only LEAVING THE LINE is a
 * mistake. So:
 *
 * - A touch begins a stroke only near the dot: where the finger last
 *   reached (a lifted finger continues from where it was), or the stroke's
 *   start when the touch is nearer to that. A touch anywhere else is
 *   ignored, never scolded.
 * - While the finger moves, its nearest point on the stroke is looked for
 *   in a window ONE BAND ahead of the progress made (and a little behind,
 *   for a wobble), and progress only ever advances — so the finger must
 *   travel the stroke in its direction, and a hop across a loop finds no
 *   near point in the window and is "off the line" like any wander.
 * - The stroke's TURNING POINTS are checkpoints: the window does not move
 *   past one until the finger has come close to it. A straight swipe
 *   across the mouth of ت or along the teeth of س stays within a finger's
 *   width of the line and would otherwise pass; it never touches the
 *   bottom of the bowl or the tips of the teeth, so it stalls there and
 *   wanders off the stalled window instead.
 * - Off the line by more than the band (a finger is wide; the band is
 *   generous) is the one mistake: the stroke starts over.
 * - Reaching the end completes the stroke, lifted or not. Lifting early
 *   keeps what was traced: incomplete is not wrong.
 *
 * No clock anywhere: a child who traces slowly is never told to hurry.
 * Pure geometry, so it can be reasoned about and tested without a browser.
 */

export type Pt = [number, number];

export interface StrokeTemplate {
  /** Points in screen pixels. One point is a dot to tap. */
  pts: Pt[];
  /** Cumulative arc length at each point (px). */
  cum: number[];
  length: number;
  /** Arc lengths of the stroke's turning points — the checkpoints. */
  checks: number[];
}

export interface TraceOptions {
  /** How far from the line the finger may be, px. */
  band: number;
  /** How close to the dot a touch must begin, px. */
  startRadius: number;
  /** How close a tap must be to its dot, px — tighter where dots are close together. */
  tapRadius: number;
  /** How far ahead along the stroke the finger may jump at once, px. */
  lookahead: number;
  /** How far behind the progress the nearest point may lie, px. */
  backSlack: number;
  /** How close the finger must come to a turning point to pass it, px. */
  checkRadius: number;
  /** Share of the stroke's length that completes it. */
  done: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeTemplate(norm: Pt[], box: Box, minCheckSpacing = 0): StrokeTemplate {
  const pts: Pt[] = norm.map(([nx, ny]) => [box.x + nx * box.w, box.y + ny * box.h]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const length = cum[cum.length - 1];
  return { pts, cum, length, checks: turningPoints(pts, cum, minCheckSpacing) };
}

/**
 * Where the stroke turns: the bottom of a bowl, the tip of a tooth, the
 * corner of د. The turn at a point is the angle between the way in (over
 * the four points before) and the way out (the four after); a point is a
 * turning point when that angle exceeds 40° and is the sharpest in its
 * neighborhood, and turning points nearer than `spacing` merge into the
 * sharper one. Near the ends nothing is a checkpoint — the end itself is.
 */
export function turningPoints(pts: Pt[], cum: number[], spacing: number): number[] {
  const n = pts.length;
  if (n < 9) return [];
  const K = 4;
  const turn: number[] = new Array(n).fill(0);
  for (let i = K; i < n - K; i++) {
    const a = pts[i - K], b = pts[i], c = pts[i + K];
    const inX = b[0] - a[0], inY = b[1] - a[1], outX = c[0] - b[0], outY = c[1] - b[1];
    const dot = inX * outX + inY * outY;
    const cross = inX * outY - inY * outX;
    turn[i] = Math.abs(Math.atan2(cross, dot));
  }
  const MIN = (40 * Math.PI) / 180;
  const picked: { s: number; t: number }[] = [];
  for (let i = K; i < n - K; i++) {
    if (turn[i] < MIN) continue;
    let max = true;
    for (let k = i - 3; k <= i + 3; k++) if (k !== i && k >= 0 && k < n && turn[k] > turn[i]) max = false;
    if (!max) continue;
    const s = cum[i];
    const last = picked[picked.length - 1];
    if (last && s - last.s < spacing) {
      if (turn[i] > last.t) picked[picked.length - 1] = { s, t: turn[i] };
      continue;
    }
    picked.push({ s, t: turn[i] });
  }
  const L = cum[n - 1];
  return picked.map((p) => p.s).filter((s) => s > spacing * 0.6 && s < L - spacing * 0.6);
}

/** The point `s` px along the stroke. */
export function pointAt(t: StrokeTemplate, s: number): Pt {
  if (t.pts.length === 1) return t.pts[0];
  const at = Math.max(0, Math.min(t.length, s));
  let i = 1;
  while (i < t.cum.length - 1 && t.cum[i] < at) i++;
  const a = t.pts[i - 1], b = t.pts[i];
  const span = t.cum[i] - t.cum[i - 1];
  const u = span === 0 ? 0 : (at - t.cum[i - 1]) / span;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/**
 * The nearest point on the stroke to `p`, looking only at arc lengths in
 * [from, to]: its arc length and its distance.
 */
export function nearestAlong(t: StrokeTemplate, p: Pt, from: number, to: number): { s: number; d: number } {
  let best = { s: Math.max(0, from), d: Infinity };
  const lo = Math.max(0, from), hi = Math.min(t.length, to);
  for (let i = 1; i < t.pts.length; i++) {
    const s0 = t.cum[i - 1], s1 = t.cum[i];
    if (s1 < lo || s0 > hi) continue;
    const a = t.pts[i - 1], b = t.pts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let u = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    const uLo = s1 === s0 ? 0 : (lo - s0) / (s1 - s0);
    const uHi = s1 === s0 ? 1 : (hi - s0) / (s1 - s0);
    u = Math.max(Math.max(0, uLo), Math.min(Math.min(1, uHi), u));
    const q: Pt = [a[0] + dx * u, a[1] + dy * u];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best.d) best = { s: s0 + (s1 - s0) * u, d };
  }
  return best;
}

export type DownResult = 'start' | 'ignore' | 'done';
export type MoveResult = 'ok' | 'off' | 'done' | 'idle';

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** One stroke being traced. */
export class StrokeTracer {
  /** Arc length reached, px. */
  progress = 0;
  /** True while a finger is on the line. */
  active = false;
  /** The next turning point the finger has still to reach. */
  nextCheck = 0;
  /** The finger's closest approach to that turning point so far. */
  closest = Infinity;
  readonly t: StrokeTemplate;
  readonly opts: TraceOptions;

  constructor(t: StrokeTemplate, opts: TraceOptions) {
    this.t = t;
    this.opts = opts;
  }

  get isTap(): boolean {
    return this.t.pts.length === 1;
  }

  get fraction(): number {
    return this.t.length === 0 ? (this.progress > 0 ? 1 : 0) : this.progress / this.t.length;
  }

  /** Where the dot is: the start, or where the finger last reached. */
  get dot(): Pt {
    return pointAt(this.t, this.progress);
  }

  /** Puts the tracer at a share of the stroke — after a resize, the same place on a new board. */
  setFraction(f: number): void {
    this.progress = Math.max(0, Math.min(1, f)) * this.t.length;
    this.nextCheck = this.t.checks.filter((c) => c <= this.progress).length;
    this.closest = Infinity;
    this.active = false;
  }

  down(p: Pt): DownResult {
    if (this.isTap) {
      if (dist(p, this.t.pts[0]) <= this.opts.tapRadius) {
        this.progress = 1;
        return 'done';
      }
      return 'ignore';
    }
    // Continue from where the finger was, or start the stroke over from its
    // first dot. The point the finger last reached is tried FIRST: a head
    // that bends back near its start (ج ح خ ع غ هـ, the loops of ص ض ط ظ)
    // puts the waiting dot inside the start's radius, and a finger put back
    // on it threw the trace away (review, 2026-10-24). Only a touch nearer
    // the start than the dot restarts.
    const dStart = dist(p, this.t.pts[0]);
    if (this.progress > 0) {
      const dDot = dist(p, this.dot);
      if (dDot <= this.opts.startRadius && dDot <= dStart) {
        this.active = true;
        return 'start';
      }
    }
    if (dStart <= this.opts.startRadius) {
      this.reset();
      this.active = true;
      return 'start';
    }
    return 'ignore';
  }

  move(p: Pt): MoveResult {
    if (!this.active || this.isTap) return 'idle';
    let { s, d } = nearestAlong(this.t, p, this.progress - this.opts.backSlack, this.progress + this.opts.lookahead);
    if (d > this.opts.band) {
      this.active = false;
      this.reset();
      return 'off';
    }
    // The checkpoints: the window does not pass a turning point the finger
    // has not come close to. A finger that stays on the line reaches it; a
    // shortcut stalls here and then wanders out of the stalled window.
    while (this.nextCheck < this.t.checks.length) {
      const c = this.t.checks[this.nextCheck];
      this.closest = Math.min(this.closest, dist(p, pointAt(this.t, c)));
      if (s < c) break;
      if (this.closest <= this.opts.checkRadius) {
        this.nextCheck += 1;
        this.closest = Infinity;
        continue;
      }
      s = Math.min(s, Math.max(0, c - 0.5));
      break;
    }
    if (s > this.progress) this.progress = s;
    if (this.progress >= this.opts.done * this.t.length) {
      this.active = false;
      this.progress = this.t.length;
      return 'done';
    }
    return 'ok';
  }

  /** The finger lifted: what was traced stays. */
  up(): 'done' | 'rest' {
    this.active = false;
    if (this.isTap) return this.progress > 0 ? 'done' : 'rest';
    if (this.progress >= this.opts.done * this.t.length) {
      this.progress = this.t.length;
      return 'done';
    }
    return 'rest';
  }

  reset(): void {
    this.progress = 0;
    this.active = false;
    this.nextCheck = 0;
    this.closest = Infinity;
  }
}

/**
 * The tolerances for a board of side `size` px: a finger is about 40 px
 * wide. The lookahead is short on purpose — about one band — so a finger
 * that jumps across the mouth of a ب or a ن from one arm to the other finds
 * nothing near enough in its window and is off the line, while a fast
 * honest finger (a few px per event) never outruns it. A first version
 * allowed 0.22 of the stroke and a 130 px hop across a bowl was accepted as
 * progress (2026-10-24). `tapRadius` is the start radius until `tapRadii`
 * tightens it for dots that sit close together.
 */
export function tolerances(size: number, strokeLength: number): TraceOptions {
  const band = Math.max(22, size * 0.11);
  return {
    band,
    startRadius: band * 1.8,
    tapRadius: band * 1.8,
    lookahead: Math.min(band * 2, Math.max(band, strokeLength * 0.12)),
    backSlack: band * 1.5,
    checkRadius: band * 0.45,
    done: 0.94,
  };
}

/** A dot's radius: no more than half the way to the nearest other dot, so
 *  the two dots of ت and the three of ث are told apart (never under 14 px). */
export function tapRadius(base: number, at: Pt, others: Pt[]): number {
  let near = Infinity;
  for (const o of others) near = Math.min(near, dist(at, o));
  return Math.max(14, Math.min(base, near * 0.45));
}

// ── authored strokes: the teacher's own hand becomes the template ───────────

export function smoothPts(pts: Pt[], win: number): Pt[] {
  const h = Math.floor(win / 2);
  return pts.map((_, i) => {
    let sx = 0, sy = 0, c = 0;
    for (let k = i - h; k <= i + h; k++) if (k >= 0 && k < pts.length) { sx += pts[k][0]; sy += pts[k][1]; c++; }
    return [sx / c, sy / c];
  });
}

export function resamplePts(pts: Pt[], count: number): Pt[] {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + dist(pts[i], pts[i - 1]));
  const L = d[d.length - 1];
  if (L === 0) return [pts[0]];
  const out: Pt[] = [];
  for (let k = 0; k < count; k++) {
    const t = (L * k) / (count - 1);
    let i = 1;
    while (i < d.length - 1 && d[i] < t) i++;
    const u = d[i] === d[i - 1] ? 0 : (t - d[i - 1]) / (d[i] - d[i - 1]);
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]);
  }
  return out;
}

/**
 * A stroke drawn on the board (screen px) as a template: a short one is a
 * tap at its middle; a longer one is smoothed, resampled to 48 points and
 * put in the frame of the ink box.
 */
export function authoredStroke(raw: Pt[], box: Box, tapMax: number): Pt[] {
  const norm = ([x, y]: Pt): Pt => [(x - box.x) / box.w, (y - box.y) / box.h];
  let L = 0;
  for (let i = 1; i < raw.length; i++) L += dist(raw[i], raw[i - 1]);
  if (raw.length < 2 || L < tapMax) {
    const cx = raw.reduce((a, p) => a + p[0], 0) / raw.length;
    const cy = raw.reduce((a, p) => a + p[1], 0) / raw.length;
    return [norm([cx, cy])];
  }
  return resamplePts(smoothPts(raw, 5), 48).map(norm).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
}
