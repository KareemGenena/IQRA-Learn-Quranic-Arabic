import { useEffect, useRef } from 'react';
import { LaserStrokes } from '../lib/laserStrokes';
import type { Point } from '../lib/laserStrokes';

/**
 * A teaching laser pointer, modelled on the one in Samsung Notes.
 *
 * Strokes are drawn solid red and simply stay on screen; they are not wiped
 * when the pen lifts. Everything currently on screen disappears together
 * once a full second has passed since the LAST mark was made — so pointing
 * again before that adds to what is already there and restarts the clock.
 *
 * While it is on, the overlay swallows pointer events, so nothing underneath
 * can be tapped by accident. Escape leaves the mode.
 */

const LINE_WIDTH = 5;
const COLOR = '255, 34, 34';

export function LaserPointer({ active, onExit }: { active: boolean; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useRef(new LaserStrokes());
  const rafId = useRef(0);
  /** Finger-scrolling state, so the laser can stay on while the page moves. */
  const panning = useRef<number | null>(null);
  const panTarget = useRef<Element | null>(null);
  const pendingPan = useRef(0);
  const panFrame = useRef(0);
  const panSpeed = useRef(0);
  const lastPanAt = useRef(0);
  const glideFrame = useRef(0);

  useEffect(() => {
    if (!active) {
      store.current.clear();
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
    };
    resize();

    const draw = () => {
      const alpha = store.current.alphaAt(performance.now());
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (alpha <= 0) {
        store.current.clear();
        rafId.current = 0;
        return; // stop the loop until the next mark
      }

      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
      for (const stroke of store.current.strokes) {
        if (stroke.length === 1) {
          // A tap with no movement still leaves a dot.
          ctx.beginPath();
          ctx.arc(stroke[0].x, stroke[0].y, LINE_WIDTH / 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${COLOR}, ${alpha})`;
          ctx.fill();
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.stroke();
      }
      rafId.current = requestAnimationFrame(draw);
    };

    const kick = () => {
      if (!rafId.current) rafId.current = requestAnimationFrame(draw);
    };

    const point = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });

    /**
     * The scrollable thing under a finger.
     *
     * The overlay is fixed across the whole window, so it is always what
     * `elementFromPoint` finds; lifting it for one call reveals whatever the
     * finger is really over — the lesson page, or the notes sheet's own
     * scroller — so the same drag scrolls whichever it is.
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

    const onDown = (e: PointerEvent) => {
      // A stylus draws, a finger scrolls — the same split the notes canvas
      // makes, and for the same reason: `touch-action` would apply to the pen
      // too, so the overlay keeps `none` and a finger drag is scrolled here.
      // Before this, teaching over a shared screen meant switching the laser
      // off to move the page and on again to point at the next word.
      if (e.pointerType === 'touch') {
        if (glideFrame.current) cancelAnimationFrame(glideFrame.current);
        glideFrame.current = 0;
        panTarget.current = scrollableUnder(e.clientX, e.clientY);
        panning.current = e.clientY;
        lastPanAt.current = e.timeStamp;
        panSpeed.current = 0;
        return;
      }
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // a pointer id we can't capture is still perfectly drawable
      }
      store.current.begin(point(e), performance.now());
      kick();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (panning.current === null) return;
        const dy = e.clientY - panning.current;
        panning.current = e.clientY;
        const dt = e.timeStamp - lastPanAt.current;
        if (dt > 0) panSpeed.current = dy / dt;
        lastPanAt.current = e.timeStamp;
        pendingPan.current += dy;
        if (!panFrame.current) panFrame.current = requestAnimationFrame(applyPan);
        return;
      }
      if (!store.current.drawing) return;
      e.preventDefault();
      store.current.extend(point(e), performance.now());
      kick();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (panning.current === null) return;
        panning.current = null;
        // Carry on after the finger lifts, as the notes sheet does.
        let speed = panSpeed.current;
        panSpeed.current = 0;
        if (Math.abs(speed) < 0.05) return;
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
        return;
      }
      store.current.end(performance.now()); // the one-second clock starts here
      kick();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
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
      panning.current = null;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, onExit]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="laser-canvas" aria-hidden="true" />;
}
