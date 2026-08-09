import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkPalette } from '../components/MarkPalette';
import { ToolPopover } from '../components/ToolPopover';
import {
  EraserIcon,
  PenSettingsIcon,
  SwitchModeIcon,
  TextStyleIcon,
  UndoIcon,
} from '../components/NoteIcons';
import { emptyNote, loadNote, newId, saveNote } from '../lib/notesStore';
import { classLayer, fetchClassNote, NOTE_TOO_BIG, saveClassNote } from '../lib/cloudNotes';
import { useClasses } from '../lib/useClasses';
import type { Account } from '../lib/useAccount';
import type { NoteDoc, Stroke } from '../lib/notesStore';
import type { Lesson, PairWord, LetterWord, SimpleWord } from '../types';

/** The stylus writes and the keyboard types — one or the other. */
type Mode = 'pen' | 'text';

const COLORS = ['#17303f', '#1c5f8f', '#c0392b', '#2e7d32'];
const PEN_WIDTHS = [2, 4, 8];
const TEXT_SIZES = [20, 26, 34, 44];
const PAGE_PAD = 900; // empty room always kept below the last mark
const UNDO_LIMIT = 40;
/** One write a few seconds after the last mark, never one per stroke. */
const SAVE_DELAY = 3000;

/** The lesson's words, always present underneath and never editable. */
function ReferenceSheet({ lesson }: { lesson: Lesson }) {
  const rows: { text: string; note?: string }[] = [];
  if (lesson.kind === 'pairs') {
    for (const w of lesson.words as PairWord[]) {
      rows.push({ text: `${w.withAl.text}   ${w.bare.text}`, note: w.meaning });
    }
  } else if (lesson.kind === 'letters') {
    for (const w of lesson.words as LetterWord[]) {
      const text = w.forms ? w.forms.map((f) => f.text).join('   –   ') : w.text;
      rows.push({ text, note: w.meaning ?? w.badges?.join(' · ') });
    }
  } else {
    for (const w of lesson.words as SimpleWord[]) rows.push({ text: w.arabic });
  }

  return (
    <div className="ref-sheet" aria-label="Lesson words">
      <h3>
        {lesson.title}
        <span dir="rtl" lang="ar">
          {lesson.titleArabic}
        </span>
      </h3>
      <ol>
        {rows.map((r, i) => (
          <li key={i}>
            <span className="ref-ar" dir="rtl" lang="ar">
              {r.text}
            </span>
            {r.note && <span className="ref-note">{r.note}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NotesPage({ lesson, account }: { lesson: Lesson; account: Account }) {
  const classes = useClasses(account);
  const active = classes.active;

  /**
   * The sheets are stacked, not swapped.
   *
   * A learner writes on their own transparent layer over the teacher's marks,
   * both visible at once — an arrow drawn over the teacher's circle only means
   * anything if the circle is still there. Both layers sit on the same fixed
   * reference sheet (the lesson's words), which is what makes the coordinates
   * line up between two different people's devices.
   *
   * A teacher has no layer beneath them, so for them these are two sheets they
   * switch between: the class one everybody reads, and a private one.
   */
  const teaches = active?.youAre === 'teacher';
  const [teacherView, setTeacherView] = useState<'class' | 'mine'>('class');
  const [showBase, setShowBase] = useState(true);

  /** Which sheet this person's pen actually writes on. */
  const editing: 'class' | 'mine' = teaches ? teacherView : 'mine';

  const [doc, setDoc] = useState<NoteDoc>(() => emptyNote(lesson.lesson));
  /** The teacher's sheet, shown underneath a learner's own. Read only. */
  const [base, setBase] = useState<{ strokes: Stroke[]; html: string } | null>(null);
  const [noteError, setNoteError] = useState('');
  const [mode, setMode] = useState<Mode>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(PEN_WIDTHS[1]);
  const [textSize, setTextSize] = useState(TEXT_SIZES[1]);
  const [erasing, setErasing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [canvasH, setCanvasH] = useState(1400);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const panning = useRef<number | null>(null);
  /** Movement waiting to be applied on the next frame, and the fling state. */
  const pendingPan = useRef(0);
  const panFrame = useRef(0);
  const panSpeed = useRef(0);
  const lastPanAt = useRef(0);
  const glideFrame = useRef(0);
  const undoStack = useRef<{ strokes: Stroke[]; html: string }[]>([]);
  const docRef = useRef(doc);
  const baseRef = useRef<Stroke[]>([]);
  const dirty = useRef(false);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  // The sizing pass runs from a ResizeObserver, outside React's render, so it
  // reads the layer beneath through a ref rather than a captured value.
  useEffect(() => {
    baseRef.current = base?.strokes ?? [];
  }, [base]);

  // Depended on as plain strings, not as the object: the class list is rebuilt
  // on every load and a new object each time would restart the sheet underneath
  // whoever is writing on it.
  const activeId = active?.id ?? '';

  const layer = editing === 'class' && activeId ? classLayer(activeId) : 'mine';

  useEffect(() => {
    let alive = true;
    setNoteError('');

    const show = (d: NoteDoc) => {
      if (!alive) return;
      setDoc(d);
      docRef.current = d;
      dirty.current = false;
      if (editorRef.current) editorRef.current.innerHTML = d.html;
    };

    // The local copy first, so the sheet is on screen instantly and still
    // works with no network; the cloud copy replaces it when it arrives.
    void loadNote(lesson.lesson, layer).then((local) => {
      show(local);
      if (editing !== 'class' || !activeId) return;
      void fetchClassNote(activeId, lesson.lesson)
        .then((remote) => {
          if (!alive || !remote) return;
          // Never overwrite unsaved work of the teacher's own with an older
          // copy of it coming back from the server.
          if (dirty.current || remote.updatedAt < local.updatedAt) return;
          show(remote);
          void saveNote({ ...remote, layer });
        })
        .catch(() => {
          if (alive) setNoteError('Could not fetch the class notes. Showing the last copy on this device.');
        });
    });

    // The sheet underneath, for a learner. Cached like their own, so the
    // teacher's marks are still there with no network.
    if (teaches || !activeId) {
      setBase(null);
    } else {
      const beneath = classLayer(activeId);
      void loadNote(lesson.lesson, beneath).then((cached) => {
        if (!alive) return;
        if (cached.strokes.length || cached.html) setBase({ strokes: cached.strokes, html: cached.html });
        void fetchClassNote(activeId, lesson.lesson)
          .then((remote) => {
            if (!alive || !remote) return;
            setBase({ strokes: remote.strokes, html: remote.html });
            void saveNote({ ...remote, layer: beneath });
          })
          .catch(() => {
            if (alive) setNoteError("Showing the last copy of your teacher's notes saved on this device.");
          });
      });
    }

    return () => {
      alive = false;
      // Switching sheet or class must not swallow work written in the last
      // couple of seconds, before the batched save has fired. This closure
      // still holds the layer that work belongs to, so it lands in the right
      // place rather than on whatever is opening next.
      if (dirty.current) void saveNote({ ...docRef.current, layer });
    };
  }, [lesson.lesson, layer, editing, activeId, teaches]);

  // ── batched save ────────────────────────────────────────────────────────
  // Deliberately quiet: no running commentary while writing, just a brief
  // confirmation after the single write that actually happens.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      const current = { ...docRef.current, layer };
      // Always to this device first: a failed upload must never be able to
      // lose work that has already been written down.
      void saveNote(current)
        .then(async () => {
          if (editing === 'class' && activeId) await saveClassNote(activeId, current);
          dirty.current = false;
          setJustSaved(true);
          setNoteError('');
        })
        .catch((err) => {
          console.error('note save failed:', err);
          setNoteError(
            err instanceof Error && err.message === NOTE_TOO_BIG
              ? 'This sheet is too large to share with the class. Rub out some of it, or start a new lesson sheet.'
              : 'Saved on this device, but not to the class yet. It will go up next time you write.',
          );
        });
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [doc, layer, editing, activeId]);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1600);
    return () => clearTimeout(t);
  }, [justSaved]);

  // Read through a ref so the listener is registered once and still always
  // knows which sheet is open. Closing over `layer` with empty deps would pin
  // it to whichever sheet happened to be showing when the page loaded.
  const layerRef = useRef(layer);
  useEffect(() => {
    layerRef.current = layer;
  }, [layer]);

  useEffect(() => {
    const flush = () => {
      if (dirty.current) void saveNote({ ...docRef.current, layer: layerRef.current });
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const pushUndo = useCallback(() => {
    const cur = docRef.current;
    undoStack.current.push({ strokes: cur.strokes, html: cur.html });
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
  }, []);

  const apply = useCallback((next: (d: NoteDoc) => NoteDoc) => {
    const cur = docRef.current;
    const updated = next(cur);
    if (updated === cur) return;
    docRef.current = updated;
    dirty.current = true;
    setDoc(updated);
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    const updated = { ...docRef.current, ...prev };
    docRef.current = updated;
    dirty.current = true;
    setDoc(updated);
    if (editorRef.current) editorRef.current.innerHTML = prev.html;
  }, []);

  // ── canvas sizing: it spans the whole note, so there is no scroll maths ──
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      let lowest = 0;
      // Both layers count. Measuring only your own would cut the canvas short
      // of a teacher's mark further down the page, and it would simply vanish.
      for (const strokes of [docRef.current.strokes, baseRef.current]) {
        for (const s of strokes) {
          for (let i = 1; i < s.pts.length; i += 2) if (s.pts[i] > lowest) lowest = s.pts[i];
        }
      }
      const needed = Math.max(el.scrollHeight, lowest + PAGE_PAD, 1200);
      setCanvasH((h) => (Math.abs(h - needed) > 40 ? needed : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    /**
     * How sharp this canvas can afford to be.
     *
     * The canvas spans the whole note, so its backing store grows with the
     * note — and a phone reporting devicePixelRatio 3 turns a 3000px note into
     * roughly ten million device pixels, forty megabytes the compositor has to
     * move on every scroll. That is why scrolling felt heavy, and it is also
     * where iOS quietly gives up and paints the canvas blank.
     *
     * So the ratio is capped at 2, and capped further once the note is long
     * enough to blow the pixel budget. A long note ends up very slightly
     * softer; it stays scrollable, which matters more.
     */
    const MAX_PIXELS = 4_000_000;
    const wanted = Math.min(window.devicePixelRatio || 1, 2);
    const affordable = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
    const scale = Math.max(0.75, Math.min(wanted, affordable));

    if (canvas.width !== Math.floor(w * scale) || canvas.height !== Math.floor(h * scale)) {
      canvas.width = Math.floor(w * scale);
      canvas.height = Math.floor(h * scale);
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const paint = (strokes: Stroke[]) => {
      for (const s of strokes) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(s.pts[0], s.pts[1]);
        for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]);
        if (s.pts.length === 2) ctx.lineTo(s.pts[0] + 0.1, s.pts[1]);
        ctx.stroke();
      }
    };

    // The teacher's marks go down first so the learner's sit on top of them.
    // One canvas rather than two: they only ever stack in this order, and a
    // second full-height canvas would double the memory that made scrolling
    // heavy in the first place.
    if (base && showBase) paint(base.strokes);
    paint(doc.strokes);
  }, [doc.strokes, base, showBase]);

  useLayoutEffect(redraw, [redraw, canvasH]);

  // The canvas's CSS size follows the layout, but its backing store only
  // changes when something redraws it. Turning a phone sideways therefore left
  // the whole sheet stretched across the wrong shape until the next stroke.
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(redraw);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [redraw]);

  const at = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const eraseAt = (x: number, y: number) => {
    const r = 16;
    apply((d) => {
      const keep = d.strokes.filter((s) => {
        for (let i = 0; i < s.pts.length; i += 2) {
          if (Math.abs(s.pts[i] - x) < r && Math.abs(s.pts[i + 1] - y) < r) return false;
        }
        return true;
      });
      return keep.length === d.strokes.length ? d : { ...d, strokes: keep };
    });
  };

  const stopGlide = useCallback(() => {
    if (glideFrame.current) cancelAnimationFrame(glideFrame.current);
    glideFrame.current = 0;
  }, []);

  /**
   * Carry on after the finger lifts.
   *
   * Scrolling here is done in JavaScript rather than by the browser, and the
   * browser's own momentum comes with it. Without this a flick stops dead the
   * instant you let go, which reads as the page being heavy even when every
   * frame is on time.
   */
  const startGlide = useCallback(() => {
    let speed = panSpeed.current; // pixels per millisecond
    panSpeed.current = 0;
    if (Math.abs(speed) < 0.05) return;

    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      const scroller = scrollRef.current;
      if (!scroller) return;
      scroller.scrollTop -= speed * dt;
      // Roughly halves the speed every tenth of a second, which is close to
      // what the platform scrollers feel like.
      speed *= Math.pow(0.94, dt);
      if (Math.abs(speed) > 0.02) glideFrame.current = requestAnimationFrame(step);
      else glideFrame.current = 0;
    };
    glideFrame.current = requestAnimationFrame(step);
  }, []);

  // Nothing should keep animating a page that has gone away.
  useEffect(
    () => () => {
      stopGlide();
      if (panFrame.current) cancelAnimationFrame(panFrame.current);
    },
    [stopGlide],
  );

  /**
   * A stylus draws, a finger scrolls.
   *
   * CSS `touch-action` can't make that split: the browser applies it to pen
   * input too, so `pan-y` let the stylus pan the page mid-stroke. The canvas
   * therefore takes `touch-action: none` — no input pans it — and a finger
   * drag is turned into scrolling here instead.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    // Scrolling comes first, and applies to every sheet. A read-only sheet
    // still has to be readable — bailing out before this left a learner
    // unable to scroll their teacher's notes at all.
    if (e.pointerType === 'touch') {
      stopGlide();
      panning.current = e.clientY;
      lastPanAt.current = e.timeStamp;
      panSpeed.current = 0;
      return;
    }
    // A learner may read their teacher's sheet and never change it. Blocked
    // here as well as in the rules: the rules stop it reaching anyone else,
    // this stops the false impression of having written something.
    if (mode !== 'pen') return;
    const p = at(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is only an optimisation
    }
    pushUndo();
    if (erasing) {
      drawing.current = { id: 'erase', color: '', width: 0, pts: [] };
      eraseAt(p.x, p.y);
      return;
    }
    drawing.current = { id: newId(), color, width, pts: [p.x, p.y] };
    apply((d) => ({ ...d, strokes: [...d.strokes, drawing.current!] }));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panning.current !== null && e.pointerType === 'touch') {
      const dy = e.clientY - panning.current;
      panning.current = e.clientY;

      // Remember how fast the finger is going, so letting go can carry on.
      const dt = e.timeStamp - lastPanAt.current;
      if (dt > 0) panSpeed.current = dy / dt;
      lastPanAt.current = e.timeStamp;

      // Collect the movement and apply it once a frame. A pointermove can
      // fire far more often than the screen redraws, and every scrollTop
      // write forces the browser to move a full-note-height canvas.
      pendingPan.current += dy;
      if (!panFrame.current) {
        panFrame.current = requestAnimationFrame(() => {
          panFrame.current = 0;
          const scroller = scrollRef.current;
          if (!scroller) return;
          scroller.scrollTop -= pendingPan.current;
          pendingPan.current = 0;
        });
      }
      return;
    }
    if (!drawing.current || e.pointerType === 'touch') return;
    const p = at(e);
    if (erasing) {
      eraseAt(p.x, p.y);
      return;
    }
    drawing.current.pts.push(p.x, p.y);
    redraw();
  };

  const onPointerUp = () => {
    if (panning.current !== null) {
      panning.current = null;
      startGlide();
    }
    if (!drawing.current) return;
    drawing.current = null;
    const updated = { ...docRef.current };
    docRef.current = updated;
    dirty.current = true;
    setDoc(updated);
  };

  // ── typing ──────────────────────────────────────────────────────────────
  const onInput = () => {
    const html = editorRef.current?.innerHTML ?? '';
    apply((d) => (d.html === html ? d : { ...d, html }));
  };

  const styleSelection = (cmd: string, value: string) => {
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, value);
    onInput();
  };

  const insertMark = (ch: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (!el.contains(document.getSelection()?.anchorNode ?? null)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    document.execCommand('insertText', false, ch);
    onInput();
  };

  return (
    <main className="notes-page">
      <div className="notes-toolbar" role="toolbar" aria-label="Note tools">
        <button
          type="button"
          className="icon-btn mode-btn"
          title={mode === 'pen' ? 'Switch to the keyboard' : 'Switch to the stylus'}
          aria-label={mode === 'pen' ? 'Switch to the keyboard' : 'Switch to the stylus'}
          onClick={() => {
            setMode((m) => (m === 'pen' ? 'text' : 'pen'));
            setErasing(false);
          }}
        >
          <SwitchModeIcon mode={mode} />
        </button>

        {mode === 'pen' ? (
          <>
            <ToolPopover icon={<PenSettingsIcon color={color} />} label="Stylus colour and thickness">
              {() => (
                <>
                  <div className="popover-row">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`swatch ${c === color ? 'active' : ''}`}
                        style={{ background: c }}
                        title={c}
                        aria-label={`Stylus colour ${c}`}
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                  <div className="popover-row">
                    {PEN_WIDTHS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`width-btn ${w === width ? 'active' : ''}`}
                        aria-label={`Thickness ${w}`}
                        onClick={() => setWidth(w)}
                      >
                        <span style={{ height: w, background: color }} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </ToolPopover>
            <button
              type="button"
              className={`icon-btn ${erasing ? 'active' : ''}`}
              title="Eraser"
              aria-label="Eraser"
              aria-pressed={erasing}
              onClick={() => setErasing((v) => !v)}
            >
              <EraserIcon />
            </button>
          </>
        ) : (
          <>
            <ToolPopover icon={<TextStyleIcon color={color} />} label="Text colour and size">
              {() => (
                <>
                  <div className="popover-row">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="swatch"
                        style={{ background: c }}
                        title={c}
                        aria-label={`Text colour ${c}`}
                        onClick={() => {
                          setColor(c);
                          styleSelection('foreColor', c);
                        }}
                      />
                    ))}
                  </div>
                  <div className="popover-row">
                    {TEXT_SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`width-btn text-size ${s === textSize ? 'active' : ''}`}
                        aria-label={`Text size ${s}`}
                        onClick={() => {
                          setTextSize(s);
                          styleSelection('fontSize', String(TEXT_SIZES.indexOf(s) + 3));
                        }}
                      >
                        A
                      </button>
                    ))}
                  </div>
                </>
              )}
            </ToolPopover>
            <ToolPopover icon={<span className="marks-icon">ٱ</span>} label="Quranic marks" wide>
              {() => <MarkPalette onInsert={insertMark} />}
            </ToolPopover>
          </>
        )}

        <button type="button" className="icon-btn" title="Undo" aria-label="Undo" onClick={undo}>
          <UndoIcon />
        </button>

        <span className={`save-state ${justSaved ? 'shown' : ''}`} aria-live="polite">
          {justSaved ? 'Saved' : ''}
        </span>
      </div>

      {/* Which class, and whose sheet. Always on screen, never behind a menu:
          writing a lesson's notes into the wrong class is the one mistake this
          feature makes easy, and the only guard against it is saying so. */}
      <div className="sheet-bar">
        {/* Only a teacher has two sheets to choose between. A learner has one,
            with the teacher's underneath it, so a tab strip would only invite
            them to look for a sheet that isn't there. */}
        {teaches && (
          <div className="sheet-tabs" role="group" aria-label="Which notes">
            <button
              type="button"
              className={`sheet-tab ${editing === 'class' ? 'active' : ''}`}
              aria-pressed={editing === 'class'}
              onClick={() => setTeacherView('class')}
            >
              Class notes
            </button>
            <button
              type="button"
              className={`sheet-tab ${editing === 'mine' ? 'active' : ''}`}
              aria-pressed={editing === 'mine'}
              onClick={() => setTeacherView('mine')}
            >
              My notes
            </button>
          </div>
        )}

        {active && (
          <div className="sheet-where">
            {classes.options && classes.options.length > 1 ? (
              <label className="class-picker">
                <span className="join-code-label">Class</span>
                <select value={active.id} onChange={(e) => classes.setActive(e.target.value)}>
                  {classes.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.youAre === 'student' ? ` — ${o.teacherName || 'your teacher'}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="class-now">
                <span className="join-code-label">Class</span> <strong>{active.name}</strong>
              </span>
            )}

            <span className="sheet-role can-edit">
              {teaches
                ? editing === 'class'
                  ? 'You are writing these for the class'
                  : 'Private to this device'
                : 'You are writing on top of your teacher’s notes'}
            </span>

            {/* Turning the layer beneath off is the only way to read your own
                marks clearly once a sheet gets busy. */}
            {!teaches && base && (
              <label className="base-toggle">
                <input type="checkbox" checked={showBase} onChange={(e) => setShowBase(e.target.checked)} />
                Show teacher’s marks
              </label>
            )}
          </div>
        )}

        {!active && (
          <span className="sheet-role">
            Private to this device — nobody else sees these.{' '}
            {account.signedIn ? (
              <a href="#/classes">Join a class</a>
            ) : (
              <a href="#/account">Sign in</a>
            )}{' '}
            to see your teacher’s notes underneath.
          </span>
        )}
      </div>

      {noteError && <p className="gate-error">{noteError}</p>}

      <div className={`notes-frame mode-${mode}`}>
        <div className="notes-scroll" ref={scrollRef}>
          <div className="notes-content" ref={contentRef} style={{ minHeight: canvasH }}>
            <ReferenceSheet lesson={lesson} />
            {/* The teacher's typed notes, above the learner's own and in the
                same flow. Two overlapping editable text layers would render on
                top of each other and be unreadable, so typing stacks in reading
                order while the drawing stacks in depth. */}
            {!teaches && base?.html && showBase && (
              <div
                className="note-editor from-teacher"
                style={{ fontSize: textSize }}
                dir="auto"
                aria-label="Your teacher's typed notes"
                dangerouslySetInnerHTML={{ __html: base.html }}
              />
            )}
            <div
              ref={editorRef}
              className="note-editor"
              contentEditable
              suppressContentEditableWarning
              dir="auto"
              style={{ fontSize: textSize }}
              onInput={onInput}
              data-placeholder="Tap here and type…"
            />
            <canvas
              ref={canvasRef}
              className="notes-canvas"
              style={{ height: canvasH }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
