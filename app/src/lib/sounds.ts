/**
 * Three small sounds for the tracing cards, made on the spot: a click for a
 * stroke done, a soft two-note knock for "try again", a rising chime for a
 * letter finished. Synthesized rather than recorded — nothing to download,
 * nothing to cut, the same on every device — and quiet, under the voice.
 *
 * Every call happens inside a touch, so the context may be resumed here.
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Opens (or resumes) the context from a touch that starts a stroke, so the
 *  first click or knock needs no gesture of its own — iOS counts only the
 *  touch's own event as one. */
export function prime(): void {
  context();
}

/** A stroke, or a dot, done. */
export function click(): void {
  const c = context();
  if (!c) return;
  tone(c, c.currentTime, 1760, 0.07, 0.12, 'triangle');
}

/** Off the line: two soft low notes, never harsh. */
export function knock(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 220, 0.12, 0.1, 'sine');
  tone(c, t + 0.13, 175, 0.18, 0.1, 'sine');
}

/** The whole letter traced. */
export function chime(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  [[523.25, 0], [659.25, 0.11], [783.99, 0.22], [1046.5, 0.34]].forEach(([f, dt]) => tone(c, t + dt, f, 0.32, 0.1, 'triangle'));
}
