import { useEffect, useRef, useState } from 'react';
import { LaserStrokes } from '../lib/laserStrokes';
import type { Point } from '../lib/laserStrokes';

/**
 * A teaching laser pointer.
 *
 * A red dot rides under the pointer — the mouse, the pen or the finger — and
 * pressing leaves a red trail that stays on screen and fades together a full
 * second after the LAST mark, as the laser in Samsung Notes does, so pointing
 * again before that adds to it and restarts the clock. The system cursor is
 * hidden while the laser is on: the dot IS the pointer.
 *
 * Who points and who scrolls (2026-11-23, the author: "you can't finger
 * scroll with the laser on"):
 * - Once a PEN has touched the laser on this device (remembered), the pen
 *   points and a FINGER works the page: one finger scrolls, a tap goes
 *   through to what is under it (Play, Next), as the notes sheet has it.
 * - Before that — a phone, a laptop's touch screen — one finger points and
 *   TWO fingers scroll. A mouse points; its wheel scrolls as ever.
 * A pen's dot leaves the screen when the pen lifts: it used to stay where the
 * pen last touched until something else moved (the author, 2026-11-23). A pen
 * that hovers shows its dot while it hovers, and the dot goes a second after
 * the hover stops reporting, so a pen leaving the screen without a
 * `pointerleave` cannot leave it behind either.
 *
 * Off: the tool button in the lesson's row, which stays at the top of the
 * screen and above the overlay, or Escape. A hint says who scrolls, for three
 * seconds, when the laser comes on.
 */

const LINE_WIDTH = 5;
const COLOR = '255, 34, 34';
const DOT_R = 6;
const GLOW_R = 18;
/** A finger that moves less than this is a tap. */
const TAP_SLOP = 10;
const TAP_MS = 500;
/** A hovering pen's dot goes this long after its last report. */
const HOVER_MS = 1000;
const PEN_KEY = 'iqra-laser-pen';

function penKnown(): boolean {
  try {
    return localStorage.getItem(PEN_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberPen(): void {
  try {
    localStorage.setItem(PEN_KEY, '1');
  } catch {
    // private mode: the pen is known for this visit only
  }
}

const touchScreen = () => typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

export function LaserPointer({ active, onExit }: { active: boolean; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useRef(new LaserStrokes());
  const rafId = useRef(0);
  /** Where the dot is, or null when no pointer is over the page. */
  const pos = useRef<Point | null>(null);
  /** The fingers down right now, for scrolling. */
  const fingers = useRef(new Map<number, Point>());
  const panTarget = useRef<Element | null>(null);
  const panY = useRef<number | null>(null);
  const pendingPan = useRef(0);
  const panFrame = useRef(0);
  const panSpeed = useRef(0);
  const lastPanAt = useRef(0);
  const glideFrame = useRef(0);
  const [hint, setHint] = useState<string | null>(null);
  // The parent hands a new function every render; the laser must not
  // restart (and re-show its hint) because of that.
  const exit = useRef(onExit);
  exit.current = onExit;

  useEffect(() => {
    if (!active) {
      store.current.clear();
      pos.current = null;
      fingers.current.clear();
      setHint(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let penMode = penKnown();
    let hoverTimer = 0;
    /** A one-finger touch that may turn out to be a tap, to pass through. */
    let tap: { id: number; x: number; y: number; at: number; moved: boolean } | null = null;
    /** A finished tap waiting for the browser's own click, which carries the
     *  user gesture (iOS starts audio only inside one). */
    let tapped: { x: number; y: number; at: number } | null = null;

    let hintTimer = 0;
    const say = (text: string) => {
      setHint(text);
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => setHint(null), 3000);
    };
    if (touchScreen()) say(penMode ? 'The pen points · a finger scrolls' : 'One finger points · two fingers scroll');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    };

    const drawDot = (p: Point) => {
      const glow = ctx.createRadialGradient(p.x, p.y, DOT_R * 0.6, p.x, p.y, GLOW_R);
      glow.addColorStop(0, `rgba(${COLOR}, 0.55)`);
      glow.addColorStop(1, `rgba(${COLOR}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, GLOW_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${COLOR})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, DOT_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 235, 235, 0.95)';
      ctx.beginPath();
      ctx.arc(p.x - DOT_R * 0.25, p.y - DOT_R * 0.25, DOT_R * 0.35, 0, Math.PI * 2);
      ctx.fill();
    };

    /** The trail at its current alpha, then the dot. Returns whether the trail still shows. */
    const render = (): boolean => {
      const alpha = store.current.alphaAt(performance.now());
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const live = alpha > 0;
      if (!live) store.current.clear();
      else {
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
        ctx.fillStyle = `rgba(${COLOR}, ${alpha})`;
        for (const stroke of store.current.strokes) {
          if (stroke.length === 1) {
            ctx.beginPath();
            ctx.arc(stroke[0].x, stroke[0].y, LINE_WIDTH / 2, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }
          ctx.beginPath();
          ctx.moveTo(stroke[0].x, stroke[0].y);
          for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
          ctx.stroke();
        }
      }
      if (pos.current) drawDot(pos.current);
      return live;
    };

    // The loop runs only while a trail is fading; a moving dot is drawn on
    // its own event, so an idle laser costs no frames.
    const loop = () => {
      rafId.current = render() ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!rafId.current) rafId.current = requestAnimationFrame(loop);
    };
    const show = () => {
      if (!rafId.current) render();
    };
    const hideDot = () => {
      window.clearTimeout(hoverTimer);
      pos.current = null;
      show();
    };

    const point = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });

    /** What is under the overlay at a point — lifted for one call. */
    const under = (x: number, y: number): Element | null => {
      canvas.style.pointerEvents = 'none';
      const node = document.elementFromPoint(x, y);
      canvas.style.pointerEvents = '';
      return node;
    };

    /**
     * The scrollable thing under the fingers: the lesson page, or a scroller
     * of its own.
     */
    const scrollableUnder = (x: number, y: number): Element => {
      let node = under(x, y);
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      return document.scrollingElement ?? document.documentElement;
    };

    const applyPan = () => {
      panFrame.current = 0;
      const target = panTarget.current;
      if (!target) return;
      target.scrollTop -= pendingPan.current;
      pendingPan.current = 0;
    };

    const fingersMid = (): Point => {
      let x = 0, y = 0;
      for (const p of fingers.current.values()) { x += p.x; y += p.y; }
      const n = fingers.current.size || 1;
      return { x: x / n, y: y / n };
    };

    /** Fingers scroll: in pen mode any number of them, else two or more. */
    const scrolling = () => fingers.current.size >= (penMode ? 1 : 2);

    const startPan = (timeStamp: number) => {
      const mid = fingersMid();
      panTarget.current = scrollableUnder(mid.x, mid.y);
      panY.current = mid.y;
      lastPanAt.current = timeStamp;
      panSpeed.current = 0;
    };

    const endStroke = () => {
      if (store.current.drawing) store.current.end(performance.now()); // the one-second clock starts here
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // a pointer id we can't capture is still perfectly drawable
      }
      if (glideFrame.current) cancelAnimationFrame(glideFrame.current);
      glideFrame.current = 0;
      if (e.pointerType === 'pen' && !penMode) {
        penMode = true;
        rememberPen();
        // a finger that was pointing now scrolls instead
        fingers.current.clear();
      }
      if (e.pointerType === 'touch') {
        // A palm on the glass while the pen draws is not a finger.
        if (penMode && store.current.drawing) return;
        fingers.current.set(e.pointerId, point(e));
        if (scrolling()) {
          if (!penMode) {
            // a second finger: stop pointing, start scrolling
            endStroke();
            pos.current = null;
          }
          tap = penMode && fingers.current.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp, moved: false } : null;
          startPan(e.timeStamp);
          kick();
          return;
        }
      }
      window.clearTimeout(hoverTimer);
      pos.current = point(e);
      store.current.begin(pos.current, performance.now());
      kick();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (!fingers.current.has(e.pointerId)) return;
        fingers.current.set(e.pointerId, point(e));
        if (scrolling()) {
          if (tap && (tap.id !== e.pointerId || Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP)) tap.moved = true;
          if (panY.current === null) return;
          const mid = fingersMid();
          const dy = mid.y - panY.current;
          panY.current = mid.y;
          const dt = e.timeStamp - lastPanAt.current;
          if (dt > 0) panSpeed.current = dy / dt;
          lastPanAt.current = e.timeStamp;
          pendingPan.current += dy;
          if (!panFrame.current) panFrame.current = requestAnimationFrame(applyPan);
          return;
        }
      }
      e.preventDefault();
      pos.current = point(e);
      if (store.current.drawing) {
        store.current.extend(pos.current, performance.now());
        kick();
      } else {
        show();
        // a hovering pen: the dot goes when the reports stop
        if (e.pointerType === 'pen') {
          window.clearTimeout(hoverTimer);
          hoverTimer = window.setTimeout(hideDot, HOVER_MS);
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (!fingers.current.has(e.pointerId)) return;
        const wasScrolling = scrolling();
        fingers.current.delete(e.pointerId);
        if (wasScrolling) {
          if (tap && tap.id === e.pointerId && !tap.moved && e.timeStamp - tap.at < TAP_MS && e.type === 'pointerup') {
            tapped = { x: tap.x, y: tap.y, at: performance.now() };
          }
          tap = null;
          if (scrolling()) {
            // fingers remain: carry on from where they are, without a jump
            panY.current = fingersMid().y;
            return;
          }
          panY.current = null;
          // Carry on after the fingers lift, as the notes sheet does.
          let speed = panSpeed.current;
          panSpeed.current = 0;
          if (Math.abs(speed) >= 0.05) {
            let last = performance.now();
            const step = (now: number) => {
              const dt = Math.min(now - last, 32);
              last = now;
              const target = panTarget.current;
              if (!target) return;
              target.scrollTop -= speed * dt;
              speed *= Math.pow(0.94, dt);
              glideFrame.current = Math.abs(speed) > 0.02 ? requestAnimationFrame(step) : 0;
            };
            glideFrame.current = requestAnimationFrame(step);
          }
          return;
        }
      }
      // A finger or a pen leaves the glass: the dot goes with it, the trail
      // fades. A mouse is still there, and so is its dot.
      if (e.pointerType !== 'mouse') {
        window.clearTimeout(hoverTimer);
        pos.current = null;
      }
      endStroke();
      kick();
    };

    /**
     * The browser's own click after a finger's tap, in pen mode: handed to
     * what is under the overlay. Inside the click, so a Play it reaches may
     * start sound on iOS.
     */
    const onClick = () => {
      const t = tapped;
      tapped = null;
      if (!t || performance.now() - t.at > 1000) return;
      const node = under(t.x, t.y);
      const target = (node?.closest('button, a, summary, label, [role="button"], input, select, textarea') ?? node) as HTMLElement | null;
      if (!target) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.focus();
      if (typeof target.click === 'function') target.click();
      else target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: t.x, clientY: t.y, view: window }));
    };

    const onLeave = () => hideDot();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit.current();
    };

    resize();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
      window.clearTimeout(hoverTimer);
      window.clearTimeout(hintTimer);
      // Switching the laser off mid-flick must not leave a page still moving.
      cancelAnimationFrame(glideFrame.current);
      cancelAnimationFrame(panFrame.current);
      glideFrame.current = 0;
      panFrame.current = 0;
      panY.current = null;
      fingers.current.clear();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);

  if (!active) return null;
  return (
    <>
      <canvas ref={canvasRef} className="laser-canvas" aria-hidden="true" />
      {hint && (
        <p className="laser-hint" role="status">
          <span className="laser-hint-dot" aria-hidden="true" />
          {hint}
        </p>
      )}
    </>
  );
}
