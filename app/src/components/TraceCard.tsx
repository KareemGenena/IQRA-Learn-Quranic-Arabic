import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePlayable } from '../lib/usePlayable';
import { StrokeTracer, authoredStroke, makeTemplate, pointAt, tapRadius, tolerances } from '../lib/tracing';
import type { Box, Pt } from '../lib/tracing';
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
 * the gray glyph — the font's own shape, the strokes derived from it or
 * drawn by the teacher — and Manāra asks the learner to trace it: start at
 * the dot, follow the line. The finger's path is checked against the
 * stroke as it moves (src/lib/tracing.ts): leaving the line is the one
 * mistake — a soft knock, "Try again", the stroke starts over; being slow,
 * stopping or lifting is not — what was traced stays and the dot waits
 * where the finger left. Each stroke done clicks; the whole letter done
 * chimes and Manāra is pleased.
 *
 * The letter is painted, never drawn beside: the colored glyph is clipped
 * by a mask of the strokes traced so far, drawn with a brush wider than the
 * glyph's thickest part — so whatever the stroke's exact line, the color
 * fills the gray letter and nothing else (the author, 2026-10-25: "the
 * tracing has to cover the whole gray area").
 *
 * The admin can TEACH the strokes: draw the letter on the board, stroke by
 * stroke, and save — every device then traces that hand instead of the
 * font-derived default (src/lib/tracingStore.ts). The teacher's writing
 * order is the source; the font's is the stand-in.
 *
 * The board is an SVG the size of its box, the viewBox in CSS pixels, so a
 * tolerance is a real width under a real finger. The gray letter is SVG
 * text in the Mushaf face; its ink box is measured on a canvas with the same
 * font (`measureText`'s actual bounding box), and the strokes — stored in
 * the frame of that box — are laid onto it. The font is never modified.
 */

// The family the app's @font-face DECLARES (index.css), not the file's
// internal name: a web font matches by its declared name only.
const FONT = "'Uthmanic Hafs', 'Noto Naskh Arabic', serif";
/** The share of the board the letter's ink box fills. */
const FILL = 0.68;
const MANARA = { still: 'manara.png', ask: 'manara-beam.png', sorry: 'manara-dim.png', done: 'manara-well-done.png' } as const;

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
  const boardRef = useRef<HTMLDivElement>(null);
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
  const band = tolerances(size, 0).band;
  const templates = useMemo(
    () => (geom && strokes ? strokes.map((s) => makeTemplate(s as Pt[], geom.box, band)) : []),
    [geom, strokes, band],
  );
  /** A little wider than the glyph's thickest stroke (measured by the
   *  deriver, `trace.brush`): what the mask paints with, so the base of د
   *  and the bowl of ل fill as fully as a thin ر. */
  const brush = geom ? Math.max(26, Math.max(geom.box.w, geom.box.h) * (item.trace?.brush ?? 0.18) * 1.15) : 26;

  // ── the tracers: one per stroke, re-made when the board changes size,
  //    keeping each stroke's share of progress ─────────────────────────────
  const tracers = useRef<StrokeTracer[]>([]);
  const [cur, setCur] = useState(0);
  const [tick, setTick] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  useLayoutEffect(() => {
    const old = tracers.current;
    const taps = templates.filter((t) => t.pts.length === 1).map((t) => t.pts[0]);
    tracers.current = templates.map((t, i) => {
      const opts = tolerances(size, t.length);
      if (t.pts.length === 1) opts.tapRadius = tapRadius(opts.startRadius, t.pts[0], taps.filter((p) => p !== t.pts[0]));
      const tr = new StrokeTracer(t, opts);
      const was = old[i];
      if (was && was.t.pts.length === t.pts.length) tr.setFraction(was.fraction);
      return tr;
    });
    redraw();
  }, [templates, size, redraw]);

  // ── the phases: name → demo → trace → done ──────────────────────────────
  const [phase, setPhase] = useState<Phase>(strokes ? 'name' : 'none');
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const [nudge, setNudge] = useState(0);
  const demoRef = useRef<{ cancel: () => void } | null>(null);
  const demoPathRef = useRef<SVGPathElement>(null);
  const demoPenRef = useRef<SVGCircleElement>(null);
  const [demoStroke, setDemoStroke] = useState(-1);
  const progressRef = useRef<SVGPathElement>(null);
  const [flash, setFlash] = useState(false);
  const flashing = useRef(false);

  const stopDemo = useCallback(() => {
    demoRef.current?.cancel();
    demoRef.current = null;
    setDemoStroke(-1);
  }, []);

  /** The letter paints itself, one stroke after another, then the learner's turn. */
  const startDemo = useCallback(() => {
    stopDemo();
    const ts = templates;
    if (!ts.length) return;
    // a fresh demonstration is a fresh start: the tracing begins again after it
    setCur(0);
    tracers.current.forEach((tr) => tr.reset());
    setPhase('demo');
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
        setDemoStroke(-1);
        setPhase('trace');
        return;
      }
      const t = ts[i];
      setDemoStroke(i);
      const dur = t.pts.length === 1 ? 350 : Math.min(1700, Math.max(550, (t.length / size) * 1500));
      const t0 = performance.now();
      const frame = (now: number) => {
        if (cancelled) return;
        const u = Math.min(1, (now - t0) / dur);
        const s = t.length * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
        const path = demoPathRef.current;
        const pen = demoPenRef.current;
        if (path) path.setAttribute('stroke-dasharray', `${s} ${t.length + 1}`);
        if (pen) {
          const [x, y] = pointAt(t, s);
          pen.setAttribute('cx', String(x));
          pen.setAttribute('cy', String(y));
        }
        if (u < 1) raf = requestAnimationFrame(frame);
        else {
          i += 1;
          timer = window.setTimeout(next, 220);
        }
      };
      raf = requestAnimationFrame(frame);
    };
    next();
  }, [templates, size, stopDemo]);

  // On a new card: its name, then the demonstration. The name plays from
  // the page's own gesture (a tap, a key); a clip not yet recorded fails
  // quietly and the demonstration follows at once.
  const openedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!strokes || !templates.length) return;
    if (openedRef.current === item.id) return;
    openedRef.current = item.id;
    let on = true;
    setCur(0);
    tracers.current.forEach((tr) => tr.reset());
    setPhase('name');
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
  const toBoard = (e: ReactPointerEvent<SVGSVGElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * size, ((e.clientY - r.top) / r.height) * size];
  };
  const drawProgress = useCallback(() => {
    if (flashing.current) return;
    const tr = tracers.current[cur];
    const el = progressRef.current;
    if (tr && el) el.setAttribute('stroke-dasharray', `${tr.progress} ${tr.t.length + 1}`);
  }, [cur]);
  useLayoutEffect(drawProgress, [drawProgress, tick]);

  const strokeDone = useCallback(() => {
    click();
    if (cur + 1 < tracers.current.length) setCur(cur + 1);
    else {
      setPhase('done');
      chime();
    }
  }, [cur]);

  /** Off the line: the painted part turns red for a moment, then is gone. */
  const offTheLine = useCallback(
    (lastProgress: number) => {
      knock();
      flashing.current = true;
      const tr = tracers.current[cur];
      const el = progressRef.current;
      if (tr && el) el.setAttribute('stroke-dasharray', `${lastProgress} ${tr.t.length + 1}`);
      setFlash(true);
      setPhase('sorry');
      window.setTimeout(() => {
        flashing.current = false;
        setFlash(false);
        drawProgress();
      }, 450);
      window.setTimeout(() => setPhase((p) => (p === 'sorry' ? 'trace' : p)), 1100);
    },
    [cur, drawProgress],
  );

  // ── the teacher's hand: authoring mode (admin) ──────────────────────────
  const [authoring, setAuthoring] = useState(false);
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
    } else if (phase === 'sorry') setPhase('trace');
    else if (phase !== 'trace') return;
    if (pointer.current !== null) return; // one finger at a time
    const tr = tracers.current[cur];
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
    drawProgress();
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
    const tr = tracers.current[cur];
    if (!tr) return;
    const before = tr.progress;
    const r = tr.move(toBoard(e));
    if (r === 'off') {
      pointer.current = null;
      offTheLine(before);
    } else if (r === 'done') {
      pointer.current = null;
      strokeDone();
    } else if (r === 'ok') drawProgress();
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
    const tr = tracers.current[cur];
    if (!tr) return;
    if (tr.up() === 'done') strokeDone();
    else redraw();
  };

  const again = () => {
    stopDemo();
    setCur(0);
    tracers.current.forEach((tr) => tr.reset());
    setPhase('trace');
    redraw();
  };

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
          ? 'Now you: start at the dot and follow the line.'
          : phase === 'sorry'
            ? 'Try again — start at the dot.'
            : phase === 'done'
              ? 'Well done!'
              : 'The tracing for this letter is coming.';

  const sw = Math.max(14, size * 0.07);
  const current = tracers.current[cur];
  const dot = current && !current.isTap && phase !== 'done' ? current.dot : null;
  const maskId = `trace-mask-${lesson.lesson}-${item.id}`;
  const painting = phase !== 'name' && phase !== 'none' && !authoring;

  return (
    <div className={`letter-card trace-card ${fam} ${phase === 'done' ? 'traced' : ''} ${authoring ? 'authoring' : ''}`}>
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
          {size > 0 && (
            <svg
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
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
                  <rect width={size} height={size} fill="#000" />
                  {painting &&
                    templates.map((t, i) =>
                      i < cur || phase === 'done' ? (
                        t.pts.length === 1 ? (
                          <circle key={i} cx={t.pts[0][0]} cy={t.pts[0][1]} r={brush * 0.6} fill="#fff" />
                        ) : (
                          <path key={i} d={pathOf(t.pts)} stroke="#fff" strokeWidth={brush} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        )
                      ) : null,
                    )}
                  {painting && phase === 'demo' && demoStroke >= 0 && templates[demoStroke] && (
                    templates[demoStroke].pts.length === 1 ? (
                      <circle cx={templates[demoStroke].pts[0][0]} cy={templates[demoStroke].pts[0][1]} r={brush * 0.6} fill="#fff" />
                    ) : (
                      <path ref={demoPathRef} d={pathOf(templates[demoStroke].pts)} stroke="#fff" strokeWidth={brush} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={`0 ${templates[demoStroke].length + 1}`} />
                    )
                  )}
                  {painting && current && !current.isTap && phase !== 'done' && phase !== 'demo' && (
                    <path ref={progressRef} d={pathOf(current.t.pts)} stroke="#fff" strokeWidth={brush} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={`${current.progress} ${current.t.length + 1}`} />
                  )}
                </mask>
              </defs>
              {geom && (
                <>
                  <text className="trace-guide" x={geom.textX} y={geom.baseline} fontSize={geom.fontSize} textAnchor="middle" style={{ fontFamily: FONT, direction: 'rtl' }} lang="ar">
                    {letter}
                  </text>
                  {painting && (
                    <text className={`trace-paint ${flash ? 'off' : ''}`} x={geom.textX} y={geom.baseline} fontSize={geom.fontSize} textAnchor="middle" style={{ fontFamily: FONT, direction: 'rtl' }} lang="ar" mask={`url(#${maskId})`}>
                      {letter}
                    </text>
                  )}
                </>
              )}
              {/* the demonstration's pen */}
              {phase === 'demo' && !authoring && demoStroke >= 0 && templates[demoStroke]?.pts.length > 1 && (
                <circle ref={demoPenRef} className="trace-pen" r={sw * 0.45} />
              )}
              {/* the stroke being traced: its guide, its dot */}
              {!authoring && current && phase !== 'done' && phase !== 'demo' && phase !== 'name' && (
                <>
                  {current.isTap ? (
                    <circle className={`trace-target ${nudge % 2 ? 'nudge-a' : 'nudge-b'}`} cx={current.t.pts[0][0]} cy={current.t.pts[0][1]} r={sw * 0.6} />
                  ) : (
                    <path className="trace-guide-line" d={pathOf(current.t.pts)} strokeWidth={Math.max(2, sw * 0.18)} />
                  )}
                  {dot && <circle key={nudge} className="trace-dot" cx={dot[0]} cy={dot[1]} r={sw * 0.42} />}
                </>
              )}
              {/* the teacher's strokes as he draws them */}
              {authoring &&
                authored.map((raw, i) =>
                  raw.length < 3 ? (
                    <circle key={i} className="trace-author" cx={raw[0][0]} cy={raw[0][1]} r={sw * 0.5} />
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
            <button type="button" className="btn" onClick={() => startDemo()} disabled={!templates.length || phase === 'name' || phase === 'demo'}>
              Show me again
            </button>
            <button type="button" className="btn" onClick={() => void play()} disabled={playing || !playable.audio}>
              Say the name
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
