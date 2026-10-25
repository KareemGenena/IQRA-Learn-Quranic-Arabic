import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePlayable } from '../lib/usePlayable';
import { StrokeTracer, authoredStroke, makeTemplate, pointAt, tapRadius, tolerances } from '../lib/tracing';
import type { Box, Pt } from '../lib/tracing';
import { Painter, aheadOf, buildRaster } from '../lib/tracePaint';
import type { PaintRaster } from '../lib/tracePaint';
import { chime, click, knock, prime } from '../lib/sounds';
import { cloudTrace, deleteCloudTrace, loadCloudTraces, onTracesChange, saveCloudTrace } from '../lib/tracingStore';
import { getSession, isAdminEmail } from '../lib/auth';
import { Mixed } from './Mixed';
import type { CardProps } from '../pages/SectionedLesson';

/**
 * One letter to trace, with a finger or a pen.
 *
 * The card opens, the letter's NAME is heard (the teacher's recording),
 * then the letter PAINTS ITSELF stroke by stroke in its family color over
 * the gray glyph — the font's own shape, the strokes the teacher's (or,
 * until he draws them, derived from the glyph) — and Manāra asks the
 * learner to trace it: start at the dot, follow the arrow. The finger's
 * path is checked against the stroke as it moves (src/lib/tracing.ts):
 * leaving the line is the one mistake — a soft knock, "Try again", the
 * stroke starts over; being slow, stopping or lifting is not — what was
 * traced stays and the dot waits where the finger left. Each stroke done
 * clicks; the whole letter done chimes and Manāra is pleased.
 *
 * The letter is painted on a canvas PIXEL BY PIXEL: every pixel of the ink
 * belongs to its nearest stroke point (src/lib/tracePaint.ts), so a stroke
 * lights only its own part of the glyph, in order, and a dot only itself.
 * Above the canvas an SVG carries the guide line, the dot, the arrow, the
 * dot rings and the teacher's drawing. Both use the same font measure.
 *
 * Phones: the board scrolls like the rest of the page unless the touch
 * begins at the dot (or a stroke is under way) — only then is the scroll
 * taken. A new card scrolls its board into view. Someone who cannot write
 * watches instead: "Watch all" plays each letter's name and demonstration
 * and turns to the next by itself; D replays the demonstration; the N and
 * P keys turn the cards as everywhere.
 *
 * The admin can TEACH the strokes: draw the letter on the board, stroke by
 * stroke, and save — every device then traces that hand instead of the
 * font-derived default (src/lib/tracingStore.ts).
 */

// The family the app's @font-face DECLARES (index.css), not the file's
// internal name: a web font matches by its declared name only.
const FONT = "'Uthmanic Hafs', 'Noto Naskh Arabic', serif";
/** The share of the board the letter's ink box fills. */
const FILL = 0.68;
const MANARA = { still: 'manara.png', ask: 'manara-beam.png', sorry: 'manara-dim.png', done: 'manara-well-done.png' } as const;
const WATCH_KEY = 'iqra-watch';

type Phase = 'name' | 'demo' | 'trace' | 'sorry' | 'done' | 'none';

interface Geom {
  fontSize: number;
  textX: number;
  baseline: number;
  box: Box;
}

/** Where the letter's ink falls on a board of `size` px, by the font's own measure. */
function measure(letter: string, size: number): Geom | null {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return null;
  const ref = 100;
  c.font = `${ref}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.direction = 'rtl';
  const m = c.measureText(letter);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  if (!(w > 0) || !(h > 0)) return null;
  const fontSize = (ref * FILL * size) / Math.max(w, h);
  const k = fontSize / ref;
  const textX = size / 2 - ((m.actualBoundingBoxRight - m.actualBoundingBoxLeft) * k) / 2;
  const baseline = size / 2 - ((m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) * k) / 2;
  return {
    fontSize,
    textX,
    baseline,
    box: { x: textX - m.actualBoundingBoxLeft * k, y: baseline - m.actualBoundingBoxAscent * k, w: w * k, h: h * k },
  };
}

const pathOf = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

const readWatch = () => {
  try {
    return localStorage.getItem(WATCH_KEY) === '1';
  } catch {
    return false;
  }
};

export function TraceCard({ lesson, item, rate, displayNo, register }: CardProps) {
  const playable = item.forms[0];
  const { playing, play } = usePlayable(lesson, playable, rate);
  useEffect(() => {
    register?.(playable.key, () => play());
  }, [register, playable.key, play]);

  const letter = item.letter ?? '';
  const fam = `fam-${(item.family ?? 0) % 7}`;
  const img = (file: string) => `${import.meta.env.BASE_URL}${lesson.imagePath ?? ''}${file}?v=${__IMAGE_VERSION__}`;
  const admin = isAdminEmail(getSession()?.email);

  // ── the strokes: the teacher's, if he drew them; else the font's ────────
  const [cloudTick, setCloudTick] = useState(0);
  useEffect(() => {
    void loadCloudTraces().then(() => setCloudTick((t) => t + 1));
    return onTracesChange(() => setCloudTick((t) => t + 1));
  }, []);
  const taught = useMemo(() => cloudTrace(letter), [letter, cloudTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const strokes = taught?.strokes ?? item.trace?.strokes ?? null;

  // ── the board's size and the letter's place on it ───────────────────────
  const cardRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    setSize(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let on = true;
    const done = () => on && setFontReady(true);
    if (!document.fonts) done();
    else document.fonts.load(`100px ${FONT}`).then(done, done);
    return () => {
      on = false;
    };
  }, []);
  const geom = useMemo(() => (size > 0 && fontReady && letter ? measure(letter, size) : null), [size, fontReady, letter]);
  const geomRef = useRef<Geom | null>(null);
  geomRef.current = geom;
  const band = tolerances(size, 0).band;
  const templates = useMemo(
    () => (geom && strokes ? strokes.map((s) => makeTemplate(s as Pt[], geom.box, band)) : []),
    [geom, strokes, band],
  );
  /** A dot's own size on this board, from the glyph (the ring on a dot to tap). */
  const dotR = geom ? Math.max(6, (item.trace?.dotRadius ?? 0.06) * Math.max(geom.box.w, geom.box.h)) : 8;

  // ── the painter: the glyph's pixels given to the strokes ───────────────
  const painter = useRef<Painter | null>(null);
  const [rasterTick, setRasterTick] = useState(0);
  useLayoutEffect(() => {
    painter.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !geom || !letter) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const raster: PaintRaster | null = buildRaster(letter, FONT, geom, size, templates, scale);
    if (!raster) return;
    const gray = getComputedStyle(canvas).getPropertyValue('--trace-gray').trim() || '#d9dde3';
    painter.current = new Painter(canvas, raster, letter, FONT, geom, gray);
    setRasterTick((t) => t + 1);
  }, [geom, templates, size, letter]);

  // ── the tracers: one per stroke, re-made when the board changes size,
  //    keeping each stroke's share of progress ─────────────────────────────
  const tracers = useRef<StrokeTracer[]>([]);
  const [cur, setCur] = useState(0);
  const curRef = useRef(0);
  curRef.current = cur;
  const [tick, setTick] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  useLayoutEffect(() => {
    const old = tracers.current;
    const taps = templates.filter((t) => t.pts.length === 1).map((t) => t.pts[0]);
    tracers.current = templates.map((t, i) => {
      const opts = tolerances(size, t.length);
      if (t.pts.length === 1) opts.tapRadius = Math.max(dotR * 1.6, tapRadius(opts.startRadius, t.pts[0], taps.filter((p) => p !== t.pts[0])));
      const tr = new StrokeTracer(t, opts);
      const was = old[i];
      if (was && was.t.pts.length === t.pts.length) tr.setFraction(was.fraction);
      return tr;
    });
    redraw();
  }, [templates, size, redraw, dotR]);

  // ── the phases: name → demo → trace → done ──────────────────────────────
  const [phase, setPhase] = useState<Phase>(strokes ? 'name' : 'none');
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const [nudge, setNudge] = useState(0);
  const demoRef = useRef<{ cancel: () => void } | null>(null);
  const demoPenRef = useRef<SVGCircleElement>(null);
  /** What the demonstration has painted: strokes done, and the one under way. */
  const demoState = useRef<{ stroke: number; frac: number } | null>(null);
  const [flash, setFlash] = useState(false);
  /** While off the line: the share of the stroke shown in red; false otherwise. */
  const flashing = useRef<number | false>(false);
  const [watching, setWatching] = useState(readWatch);

  /** The colored pixels to show, from the tracing state (or the demonstration's). */
  const paint = useCallback(() => {
    const p = painter.current;
    const card = cardRef.current;
    if (!p || !card) return;
    const n = templates.length;
    const shown = new Float32Array(n).fill(-1);
    const ph = phaseRef.current;
    if (ph === 'done') shown.fill(2);
    else if (ph === 'demo') {
      const d = demoState.current;
      if (d) {
        for (let i = 0; i < d.stroke; i++) shown[i] = 2;
        if (d.stroke < n) shown[d.stroke] = d.frac;
      }
    } else if (ph === 'trace' || ph === 'sorry') {
      const c = curRef.current;
      for (let i = 0; i < c; i++) shown[i] = 2;
      const tr = tracers.current[c];
      if (tr) shown[c] = tr.isTap ? -1 : tr.fraction;
      if (flashing.current !== false) shown[c] = flashing.current;
    }
    p.paint(shown, flashing.current !== false ? '#d9534f' : getComputedStyle(card).color);
  }, [templates.length]);
  useLayoutEffect(paint, [paint, rasterTick, tick, cur, phase]);

  const stopDemo = useCallback(() => {
    demoRef.current?.cancel();
    demoRef.current = null;
    demoState.current = null;
  }, []);

  /** The letter paints itself, one stroke after another, then the learner's turn. */
  const startDemo = useCallback(() => {
    stopDemo();
    const ts = templates;
    if (!ts.length) return;
    // a fresh demonstration is a fresh start: the tracing begins again after it
    setCur(0);
    curRef.current = 0;
    tracers.current.forEach((tr) => tr.reset());
    setPhase('demo');
    phaseRef.current = 'demo';
    let i = 0;
    let raf = 0;
    let timer = 0;
    let cancelled = false;
    demoRef.current = {
      cancel: () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        window.clearTimeout(timer);
      },
    };
    const next = () => {
      if (cancelled) return;
      if (i >= ts.length) {
        demoRef.current = null;
        demoState.current = null;
        setPhase('trace');
        phaseRef.current = 'trace';
        paint();
        // Someone watching rather than writing: on to the next letter.
        if (readWatch()) timer = window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true })), 1200);
        return;
      }
      const t = ts[i];
      const dur = t.pts.length === 1 ? 350 : Math.min(1700, Math.max(550, (t.length / size) * 1500));
      const t0 = performance.now();
      const frame = (now: number) => {
        if (cancelled) return;
        const u = Math.min(1, (now - t0) / dur);
        const eased = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        demoState.current = { stroke: i, frac: t.pts.length === 1 ? 2 : eased };
        const pen = demoPenRef.current;
        if (pen && t.pts.length > 1) {
          const [x, y] = pointAt(t, t.length * eased);
          pen.setAttribute('cx', String(x));
          pen.setAttribute('cy', String(y));
          pen.setAttribute('r', String(Math.max(6, size * 0.03)));
        } else if (pen) pen.setAttribute('r', '0');
        paint();
        if (u < 1) raf = requestAnimationFrame(frame);
        else {
          i += 1;
          timer = window.setTimeout(next, 220);
        }
      };
      raf = requestAnimationFrame(frame);
    };
    next();
  }, [templates, size, stopDemo, paint]);

  // On a new card: its name, then the demonstration. The name plays from
  // the page's own gesture (a tap, a key); a clip not yet recorded fails
  // quietly and the demonstration follows at once. On a phone the board is
  // brought into view first.
  const openedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!strokes || !templates.length) return;
    if (openedRef.current === item.id) return;
    openedRef.current = item.id;
    let on = true;
    setCur(0);
    curRef.current = 0;
    tracers.current.forEach((tr) => tr.reset());
    setPhase('name');
    phaseRef.current = 'name';
    if (window.innerWidth < 760) window.setTimeout(() => boardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    const go = async () => {
      if (playable.audio) await play();
      if (on) startDemo();
    };
    void go();
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, templates.length]);
  // A board that changed size under a running demonstration (an iPad
  // turned) starts the demonstration again on the new board.
  const firstTemplates = useRef(true);
  useEffect(() => {
    if (firstTemplates.current) {
      firstTemplates.current = false;
      return;
    }
    if (phaseRef.current === 'demo') startDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);
  useEffect(() => () => stopDemo(), [stopDemo]);

  // ── the finger ──────────────────────────────────────────────────────────
  const pointer = useRef<number | null>(null);
  const toBoard = (e: { clientX: number; clientY: number }): Pt => {
    const r = boardRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * size, ((e.clientY - r.top) / r.height) * size];
  };

  const strokeDone = useCallback(() => {
    click();
    if (curRef.current + 1 < tracers.current.length) {
      curRef.current += 1;
      setCur(curRef.current);
    } else {
      setPhase('done');
      phaseRef.current = 'done';
      chime();
    }
  }, []);

  /** Off the line: what was painted turns red for a moment, then is gone. */
  const offTheLine = useCallback(
    (lastFraction: number) => {
      knock();
      flashing.current = lastFraction;
      setFlash(true);
      setPhase('sorry');
      phaseRef.current = 'sorry';
      paint();
      window.setTimeout(() => {
        flashing.current = false;
        setFlash(false);
        paint();
      }, 450);
      window.setTimeout(() => {
        if (phaseRef.current === 'sorry') {
          setPhase('trace');
          phaseRef.current = 'trace';
        }
      }, 1100);
    },
    [paint],
  );

  // ── the teacher's hand: authoring mode (admin) ──────────────────────────
  const [authoring, setAuthoring] = useState(false);
  const authoringRef = useRef(false);
  authoringRef.current = authoring;
  const [authored, setAuthored] = useState<Pt[][]>([]);
  const [live, setLive] = useState<Pt[]>([]);
  const drawing = useRef<Pt[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const beginAuthoring = () => {
    stopDemo();
    pointer.current = null;
    setAuthored([]);
    setLive([]);
    setNote('');
    setAuthoring(true);
  };
  const endAuthoring = () => {
    setAuthoring(false);
    setAuthored([]);
    setLive([]);
    startDemo();
  };
  const saveAuthored = async () => {
    if (!geom || !authored.length) return;
    setBusy(true);
    setNote('');
    try {
      const strokesNorm = authored.map((raw) => authoredStroke(raw, geom.box, band * 0.8));
      await saveCloudTrace(letter, { strokes: strokesNorm });
      setNote('Saved — every device traces your strokes now.');
      endAuthoring();
    } catch (err) {
      setNote(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };
  const forgetAuthored = async () => {
    setBusy(true);
    setNote('');
    try {
      await deleteCloudTrace(letter);
      setNote("Back to the font's strokes.");
    } catch (err) {
      setNote(`Could not remove: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  /** Would a touch here begin a stroke? Then the page must not scroll with it. */
  const takesTouch = (p: Pt): boolean => {
    if (authoringRef.current) return true;
    const ph = phaseRef.current;
    // during the demonstration a touch ON the letter cuts it short and
    // begins the tracing; one beside the letter scrolls the page
    if (ph === 'demo') {
      const bx = geomRef.current?.box;
      return !!bx && p[0] >= bx.x - band && p[0] <= bx.x + bx.w + band && p[1] >= bx.y - band && p[1] <= bx.y + bx.h + band;
    }
    if (ph !== 'trace' && ph !== 'sorry') return false;
    const tr = tracers.current[curRef.current];
    if (!tr) return false;
    const near = (q: Pt, r: number) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= r;
    if (tr.isTap) return near(tr.t.pts[0], tr.opts.tapRadius);
    return near(tr.t.pts[0], tr.opts.startRadius) || (tr.progress > 0 && near(tr.dot, tr.opts.startRadius));
  };
  // The page scrolls under a finger that lands away from the dot; a touch
  // that begins a stroke, and every move while one is under way, is ours.
  // Native listeners, because a passive touch listener cannot prevent the
  // scroll and `touch-action` cannot tell the dot from the rest.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && takesTouch(toBoard(t))) e.preventDefault();
    };
    const move = (e: TouchEvent) => {
      if (pointer.current !== null) e.preventDefault();
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    prime();
    if (authoring) {
      if (pointer.current !== null) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // a pointer the browser does not know: followed while over the board
      }
      pointer.current = e.pointerId;
      drawing.current = [toBoard(e)];
      setLive(drawing.current.slice());
      return;
    }
    if (phase === 'demo') {
      // the learner is eager: the demonstration gives way
      stopDemo();
      setPhase('trace');
      phaseRef.current = 'trace';
    } else if (phase === 'sorry') {
      setPhase('trace');
      phaseRef.current = 'trace';
    } else if (phase !== 'trace') return;
    if (pointer.current !== null) return; // one finger at a time
    const tr = tracers.current[curRef.current];
    if (!tr) return;
    const r = tr.down(toBoard(e));
    if (r === 'ignore') {
      setNudge((n) => n + 1);
      return;
    }
    if (r === 'done') {
      strokeDone();
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // a pointer the browser does not know (a synthesized event): the
      // finger is still followed while it stays over the board
    }
    pointer.current = e.pointerId;
    paint();
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointer.current !== e.pointerId) return;
    if (authoring) {
      const p = toBoard(e);
      const last = drawing.current[drawing.current.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2) {
        drawing.current.push(p);
        setLive(drawing.current.slice());
      }
      return;
    }
    const tr = tracers.current[curRef.current];
    if (!tr) return;
    const before = tr.fraction;
    const r = tr.move(toBoard(e));
    if (r === 'off') {
      pointer.current = null;
      offTheLine(before);
    } else if (r === 'done') {
      pointer.current = null;
      strokeDone();
    } else if (r === 'ok') paint();
  };
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    if (authoring) {
      const raw = drawing.current;
      drawing.current = [];
      setLive([]);
      if (raw.length) setAuthored((a) => [...a, raw]);
      return;
    }
    const tr = tracers.current[curRef.current];
    if (!tr) return;
    if (tr.up() === 'done') strokeDone();
    else redraw();
  };

  const again = () => {
    stopDemo();
    setCur(0);
    curRef.current = 0;
    tracers.current.forEach((tr) => tr.reset());
    setPhase('trace');
    phaseRef.current = 'trace';
    redraw();
  };

  const toggleWatch = () => {
    const next = !watching;
    setWatching(next);
    try {
      localStorage.setItem(WATCH_KEY, next ? '1' : '0');
    } catch {
      // the preference only lasts the session then
    }
    if (next && phaseRef.current !== 'demo' && phaseRef.current !== 'name') startDemo();
  };

  // Single keys, as everywhere: D shows the letter again. (N and P are the
  // page's.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyD' && !authoringRef.current && templates.length) {
        e.preventDefault();
        startDemo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startDemo, templates.length]);

  // ── what Manāra says ────────────────────────────────────────────────────
  const name = item.name ?? letter;
  const mascot =
    phase === 'done' ? MANARA.done : phase === 'sorry' ? MANARA.sorry : phase === 'name' || phase === 'none' ? MANARA.still : MANARA.ask;
  const bubble = authoring
    ? `Draw ${name} stroke by stroke, as you write it. A short touch is a dot.`
    : phase === 'name'
      ? ''
      : phase === 'demo'
        ? `Watch how ${name} is written.`
        : phase === 'trace'
          ? 'Now you: start at the dot and follow the arrow.'
          : phase === 'sorry'
            ? 'Try again — start at the dot.'
            : phase === 'done'
              ? 'Well done!'
              : 'The tracing for this letter is coming.';

  const sw = Math.max(14, size * 0.07);
  const current = tracers.current[cur];
  const tracing = (phase === 'trace' || phase === 'sorry') && !authoring && !!current;
  const dot = tracing && !current.isTap ? current.dot : null;
  const arrow = tracing && !current.isTap ? aheadOf(current.t, current.progress, Math.max(sw * 1.6, current.t.length * 0.06)) : null;
  // The ring on a dot is the dot's own size (from the glyph), a little
  // more — never the reach of its pixels, which a teacher's stroke drawn a
  // touch off the bowl can stretch to the bowl's edge.
  const ringR = tracing && current.isTap ? dotR * 1.25 : 0;

  return (
    <div ref={cardRef} className={`letter-card trace-card ${fam} ${phase === 'done' ? 'traced' : ''} ${authoring ? 'authoring' : ''}`}>
      <div className="letter-top">
        <span className="letter-no">{displayNo}</span>
        <span className="letter-name" dir="rtl" lang="ar">
          {item.name}
          {taught && <span className="trace-taught"> · teacher's strokes</span>}
        </span>
      </div>

      <div className="trace-stage">
        <div className="trace-mascot">
          <img className={`trace-manara ${playing ? 'listening' : ''}`} src={img(mascot)} alt="" />
          {bubble && (
            <div className="trace-bubble" role="status">
              <Mixed text={bubble} />
            </div>
          )}
        </div>

        <div className="trace-board" ref={boardRef}>
          <canvas ref={canvasRef} className={`trace-canvas ${flash ? 'off' : ''}`} aria-hidden="true" />
          {size > 0 && (
            <svg
              className="trace-overlay"
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              role="img"
              aria-label={authoring ? `Draw the letter ${name}` : `Trace the letter ${name}`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {/* the demonstration's pen */}
              {phase === 'demo' && !authoring && <circle ref={demoPenRef} className="trace-pen" r={0} />}
              {/* the stroke being traced: its guide, its dot, its arrow; or the dot to tap */}
              {tracing && current.isTap && (
                <circle className={`trace-target ${nudge % 2 ? 'nudge-a' : 'nudge-b'}`} cx={current.t.pts[0][0]} cy={current.t.pts[0][1]} r={ringR} />
              )}
              {tracing && !current.isTap && (
                <path className="trace-guide-line" d={pathOf(current.t.pts)} strokeWidth={Math.max(2, sw * 0.18)} />
              )}
              {arrow && (
                <g className="trace-arrow" transform={`translate(${arrow.at[0].toFixed(1)} ${arrow.at[1].toFixed(1)}) rotate(${arrow.angle.toFixed(1)})`}>
                  <path d={`M${-sw * 0.5} ${-sw * 0.38} L${sw * 0.3} 0 L${-sw * 0.5} ${sw * 0.38} Z`} />
                </g>
              )}
              {dot && <circle key={nudge} className="trace-dot" cx={dot[0]} cy={dot[1]} r={sw * 0.42} />}
              {/* the teacher's strokes as he draws them */}
              {authoring &&
                authored.map((raw, i) =>
                  raw.length < 3 ? (
                    <circle key={i} className="trace-author" cx={raw[0][0]} cy={raw[0][1]} r={dotR} />
                  ) : (
                    <path key={i} className="trace-author" d={pathOf(raw)} strokeWidth={sw * 0.4} />
                  ),
                )}
              {authoring &&
                authored.map((raw, i) => (
                  <text key={`n${i}`} className="trace-author-no" x={raw[0][0] + 10} y={raw[0][1] - 8}>
                    {i + 1}
                  </text>
                ))}
              {authoring && live.length > 1 && <path className="trace-author live" d={pathOf(live)} strokeWidth={sw * 0.4} />}
            </svg>
          )}
        </div>
      </div>

      <div className="trace-actions">
        {authoring ? (
          <>
            <button type="button" className="btn" onClick={() => setAuthored((a) => a.slice(0, -1))} disabled={!authored.length || busy}>
              Undo stroke
            </button>
            <button type="button" className="btn" onClick={() => setAuthored([])} disabled={!authored.length || busy}>
              Clear
            </button>
            <button type="button" className="btn primary" onClick={() => void saveAuthored()} disabled={!authored.length || busy}>
              {busy ? 'Saving…' : `Save ${authored.length} stroke${authored.length === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="btn" onClick={endAuthoring} disabled={busy}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => startDemo()} disabled={!templates.length || phase === 'name' || phase === 'demo'} title="D">
              Show me again
            </button>
            <button type="button" className="btn" onClick={() => void play()} disabled={playing || !playable.audio}>
              Say the name
            </button>
            <button type="button" className={`btn ${watching ? 'primary' : ''}`} onClick={toggleWatch} aria-pressed={watching} title="Each letter shows itself, then the next">
              {watching ? 'Stop watching' : 'Watch all'}
            </button>
            {phase === 'done' && (
              <button type="button" className="btn primary" onClick={again}>
                Trace it again
              </button>
            )}
            {admin && geom && (
              <button type="button" className="btn admin-btn" onClick={beginAuthoring} disabled={busy}>
                Teach the strokes
              </button>
            )}
            {admin && taught && (
              <button type="button" className="btn admin-btn" onClick={() => void forgetAuthored()} disabled={busy}>
                Use the font's strokes
              </button>
            )}
          </>
        )}
      </div>
      {note && <p className="account-hint trace-note">{note}</p>}
    </div>
  );
}
