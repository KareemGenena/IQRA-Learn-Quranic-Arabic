import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkPalette } from '../components/MarkPalette';
import { ToolPopover } from '../components/ToolPopover';
import { emptyNote, loadNote, newId, saveNote } from '../lib/notesStore';
import type { NoteDoc, Stroke } from '../lib/notesStore';
import type { Lesson, PairWord, LetterWord, SimpleWord } from '../types';

/** Pen writes and the keyboard types — one or the other, as in Samsung Notes. */
type Mode = 'pen' | 'text';

const COLORS = ['#17303f', '#1c5f8f', '#c0392b', '#2e7d32'];
const PEN_WIDTHS = [2, 4, 8];
const TEXT_SIZES = [20, 26, 34, 44];
const PAGE_PAD = 900; // empty room always kept below the last mark
const UNDO_LIMIT = 40;
/** Saves are batched: a lesson of scribbling shouldn't be a write per stroke. */
const SAVE_DELAY = 2500;

/** The lesson's words, always present underneath and never editable. */
function ReferenceSheet({ lesson }: { lesson: Lesson }) {
  const rows: { text: string; note?: string }[] = [];
  if (lesson.kind === 'pairs') {
    for (const w of lesson.words as PairWord[]) {
      rows.push({ text: `${w.withAl.text}   ${w.bare.text}`, note: w.meaning });
    }
  } else if (lesson.kind === 'letters') {
    for (const w of lesson.words as LetterWord[]) {
      const text = w.pair ? w.pair.map((p) => p.text).join('   –   ') : w.text;
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

export function NotesPage({ lesson }: { lesson: Lesson }) {
  const [doc, setDoc] = useState<NoteDoc>(() => emptyNote(lesson.lesson));
  const [mode, setMode] = useState<Mode>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(PEN_WIDTHS[1]);
  const [textSize, setTextSize] = useState(TEXT_SIZES[1]);
  const [saved, setSaved] = useState<'clean' | 'pending' | 'saved'>('clean');
  const [canvasH, setCanvasH] = useState(1600);

  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const undoStack = useRef<{ strokes: Stroke[]; html: string }[]>([]);
  const docRef = useRef(doc);
  const dirty = useRef(false);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  // ── load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    void loadNote(lesson.lesson).then((d) => {
      if (!alive) return;
      setDoc(d);
      docRef.current = d;
      if (editorRef.current) editorRef.current.innerHTML = d.html;
    });
    return () => {
      alive = false;
    };
  }, [lesson.lesson]);

  // ── batched save ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty.current) return;
    setSaved('pending');
    const t = setTimeout(() => {
      void saveNote(docRef.current)
        .then(() => setSaved('saved'))
        .catch((err) => console.error('note save failed:', err));
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [doc]);

  // Let the "Saved" note fade rather than sit there forever.
  useEffect(() => {
    if (saved !== 'saved') return;
    const t = setTimeout(() => setSaved('clean'), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  // Never lose work to a closed tab mid-delay.
  useEffect(() => {
    const flush = () => {
      if (dirty.current) void saveNote(docRef.current);
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

  // ── canvas ──────────────────────────────────────────────────────────────
  /** The canvas covers the whole note, so no scroll maths is needed and the
   *  browser can handle touch scrolling natively. */
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      let lowest = 0;
      for (const s of docRef.current.strokes) {
        for (let i = 1; i < s.pts.length; i += 2) if (s.pts[i] > lowest) lowest = s.pts[i];
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
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of doc.strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.pts[0], s.pts[1]);
      for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]);
      if (s.pts.length === 2) ctx.lineTo(s.pts[0] + 0.1, s.pts[1]);
      ctx.stroke();
    }
  }, [doc.strokes]);

  useLayoutEffect(redraw, [redraw, canvasH]);

  /**
   * A finger scrolls, a stylus draws — the same split Samsung Notes makes.
   * `touch-action: pan-y` on the canvas lets the browser pan natively for
   * touch while pen and mouse still deliver pointer events to us.
   */
  const drawsWith = (e: React.PointerEvent) => e.pointerType !== 'touch';

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

  const [erasing, setErasing] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode !== 'pen' || !drawsWith(e)) return;
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
    if (!drawing.current || !drawsWith(e)) return;
    const p = at(e);
    if (erasing) {
      eraseAt(p.x, p.y);
      return;
    }
    drawing.current.pts.push(p.x, p.y);
    redraw();
  };

  const onPointerUp = () => {
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
    // Put the caret at the end if the editor was never focused.
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
        {/* One control says plainly which of the two you're in. */}
        <button
          type="button"
          className="icon-btn mode-btn"
          title={mode === 'pen' ? 'Writing with the pen — switch to keyboard' : 'Typing — switch to the pen'}
          aria-label={mode === 'pen' ? 'Switch to keyboard' : 'Switch to pen'}
          onClick={() => {
            setMode((m) => (m === 'pen' ? 'text' : 'pen'));
            setErasing(false);
          }}
        >
          {mode === 'pen' ? '✏️' : '⌨️'}
        </button>

        {mode === 'pen' ? (
          <>
            <ToolPopover icon="🎨" label="Pen colour and thickness">
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
                        aria-label={`Pen colour ${c}`}
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
              🩹
            </button>
          </>
        ) : (
          <>
            <ToolPopover icon="🅰" label="Text colour and size">
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
                        onClick={() => styleSelection('foreColor', c)}
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
            <ToolPopover icon="ٱ" label="Quranic marks" wide>
              {() => <MarkPalette onInsert={insertMark} />}
            </ToolPopover>
          </>
        )}

        <button type="button" className="icon-btn" title="Undo" aria-label="Undo" onClick={undo}>
          ↶
        </button>

        <span className={`save-state ${saved}`} aria-live="polite">
          {saved === 'pending' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}
        </span>
      </div>

      <div className={`notes-frame mode-${mode}`}>
        <div className="notes-scroll">
          <div className="notes-content" ref={contentRef} style={{ minHeight: canvasH }}>
            <ReferenceSheet lesson={lesson} />
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
