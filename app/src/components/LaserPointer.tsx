import { useEffect, useRef } from 'react';
import { LaserStrokes } from '../lib/laserStrokes';
import type { Point } from '../lib/laserStrokes';

/**
 * A teaching laser pointer.
 *
 * A red dot rides under the pointer — the mouse, the pen or the finger — and
 * pressing leaves a red trail that stays on screen and fades together a full
 * second after the LAST mark, as the laser in Samsung Notes does, so pointing
 * again before that adds to it and restarts the clock. The system cursor is
 * hidden while the laser is on: the dot IS the pointer (the author saw a
 * crosshair and no dot, and on the phone a red frame and nothing else,
 * 2026-10-25).
 *
 * On a phone the finger is the laser. Two fingers scroll the page, and a
 * mouse wheel scrolls as ever. Off: the tool button in the lesson's row,
 * which stays above the overlay, the "Laser on" chip at the top, or Escape.
 */

const LINE_WIDTH = 5;
const COLOR = '255, 34, 34';
const DOT_R = 6;
const GLOW_R = 18;

export function LaserPointer({ active, onExit }: { active: boolean; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useRef(new LaserStrokes());
  const rafId = useRef(0);
  /** Where the dot is, or null when no pointer is over the page. */
  const pos = useRef<Point | null>(null);
  /** The fingers down right now, for the two-finger scroll. */
  const fingers = useRef(new Map<number, Point>());
  const panTarget = useRef<Element | null>(null);
  const panY = useRef<number | null>(null);
  const pendingPan = useRef(0);
  const panFrame = useRef(0);
  const panSpeed = useRef(0);
  const lastPanAt = useRef(0);
  const glideFrame = useRef(0);

  useEffect(() => {
    if (!active) {
      store.current.clear();
      pos.current = null;
      fingers.current.clear();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    const point = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });

    /**
     * The scrollable thing under the fingers. The overlay is fixed across the
     * whole window, so it is always what `elementFromPoint` finds; lifting it
     * for one call reveals whatever is really there — the lesson page, or the
     * notes sheet's own scroller.
     */
    const scrollableUnder = (x: number, y: number): Element => {
      canvas.style.pointerEvents = 'none';
      let node = document.elementFromPoint(x, y) as Element | null;
      canvas.style.pointerEvents = '';
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
      if (e.pointerType === 'touch') {
        fingers.current.set(e.pointerId, point(e));
        if (fingers.current.size >= 2) {
          // a second finger: stop pointing, start scrolling
          endStroke();
          pos.current = null;
          const mid = fingersMid();
          panTarget.current = scrollableUnder(mid.x, mid.y);
          panY.current = mid.y;
          lastPanAt.current = e.timeStamp;
          panSpeed.current = 0;
          kick();
          return;
        }
      }
      pos.current = point(e);
      store.current.begin(pos.current, performance.now());
      kick();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (!fingers.current.has(e.pointerId)) return;
        fingers.current.set(e.pointerId, point(e));
        if (fingers.current.size >= 2) {
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
      } else show();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        const wasPanning = fingers.current.size >= 2;
        fingers.current.delete(e.pointerId);
        if (wasPanning) {
          if (fingers.current.size >= 2) return;
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
        // the finger that was the laser lifts: the dot goes, the trail fades
        pos.current = null;
      }
      endStroke();
      kick();
    };

    const onLeave = () => {
      pos.current = null;
      show();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };

    resize();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
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
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, onExit]);

  if (!active) return null;
  return (
    <>
      <canvas ref={canvasRef} className="laser-canvas" aria-hidden="true" />
      <button type="button" className="laser-exit" onClick={onExit}>
        <span className="laser-exit-dot" aria-hidden="true" />
        Laser on · tap to turn off
      </button>
    </>
  );
}
