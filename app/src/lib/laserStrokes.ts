/**
 * The laser pointer's stroke store and fade clock, kept free of the DOM so
 * the behaviour can be tested directly.
 *
 * Marks stay fully visible for HOLD_MS after the last one is made — not
 * after each stroke ends — so pointing again before the second is up adds to
 * what is on screen and restarts the clock. When it finally does expire,
 * everything fades out together rather than stroke by stroke.
 */

export const HOLD_MS = 1000;
export const FADE_MS = 220;

export interface Point {
  x: number;
  y: number;
}

export class LaserStrokes {
  strokes: Point[][] = [];
  drawing = false;
  private lastMark = 0;

  begin(p: Point, now: number): void {
    this.drawing = true;
    this.strokes.push([p]);
    this.lastMark = now;
  }

  extend(p: Point, now: number): void {
    if (!this.drawing) return;
    this.strokes[this.strokes.length - 1]?.push(p);
    this.lastMark = now;
  }

  end(now: number): void {
    this.drawing = false;
    this.lastMark = now;
  }

  clear(): void {
    this.strokes = [];
    this.drawing = false;
  }

  get isEmpty(): boolean {
    return this.strokes.length === 0;
  }

  /** 1 while held, easing to 0 across the fade; 0 once it should be cleared. */
  alphaAt(now: number): number {
    if (this.drawing) return 1; // never fade mid-stroke, however long it takes
    const age = now - this.lastMark;
    if (age <= HOLD_MS) return 1;
    return Math.max(0, 1 - (age - HOLD_MS) / FADE_MS);
  }
}
