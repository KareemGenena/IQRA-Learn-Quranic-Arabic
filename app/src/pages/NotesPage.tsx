import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MarkPalette } from '../components/MarkPalette';
import { emptyNote, loadNote, newId, saveNote } from '../lib/notesStore';
import type { NoteDoc, Stroke, TextBox } from '../lib/notesStore';
import type { Lesson, PairWord, LetterWord, SimpleWord } from '../types';

type Tool = 'hand' | 'pen' | 'eraser' | 'text';

const PEN_COLORS = ['#17303f', '#1c5f8f', '#c0392b', '#2e7d32'];
const PEN_WIDTHS = [2, 4, 8];
const PAGE_PAD = 1200; // canvas always keeps this much empty room below
const UNDO_LIMIT = 40;

/** The lesson's words, drawn as a fixed sheet under the note. */
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
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [width, setWidth] = useState(PEN_WIDTHS[1]);
  const [showRef, setShowRef] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const undoStack = useRef<{ strokes: Stroke[]; texts: TextBox[] }[]>([]);
  const textRefs = useRef(new Map<string, HTMLTextAreaElement>());

  // ── load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    void loadNote(lesson.lesson).then((d) => alive && setDoc(d));
    return () => {
      alive = false;
    };
  }, [lesson.lesson]);

  // ── save, debounced so a lesson's worth of strokes isn't a write storm ──
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;
    setSaved('saving');
    const t = setTimeout(() => {
      void saveNote(doc)
        .then(() => setSaved('saved'))
        .catch((err) => {
          console.error('note save failed:', err);
          setSaved('idle');
        });
    }, 700);
    return () => clearTimeout(t);
  }, [doc]);

  /**
   * The live document. Undo bookkeeping happens against this ref rather than
   * inside a setDoc updater: React invokes updaters twice in development, so
   * pushing a snapshot from inside one records every step twice and the
   * second undo silently does nothing.
   */
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const commit = useCallback((next: (d: NoteDoc) => NoteDoc, snapshot = true) => {
    const cur = docRef.current;
    if (snapshot) {
      undoStack.current.push({ strokes: cur.strokes, texts: cur.texts });
      if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    }
    const updated = next(cur);
    if (updated === cur) return;
    docRef.current = updated;
    dirty.current = true;
    setDoc(updated);
  }, []);

  /** One undo step per gesture — not per pointer-move, or a single erase
   *  drag would fill the stack with identical states. */
  const pushUndo = useCallback(() => {
    const cur = docRef.current;
    undoStack.current.push({ strokes: cur.strokes, texts: cur.texts });
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    const updated = { ...docRef.current, ...prev };
    docRef.current = updated;
    dirty.current = true;
    setDoc(updated);
  }, []);

  // ── canvas ──────────────────────────────────────────────────────────────
  const contentHeight = Math.max(
    1600,
    ...doc.strokes.map((s) => Math.max(...s.pts.filter((_, i) => i % 2 === 1))),
    ...doc.texts.map((t) => t.y + 200),
  ) + PAGE_PAD;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const scroller = scrollRef.current;
    if (!canvas || !scroller) return;
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
    ctx.translate(0, -scroller.scrollTop);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const top = scroller.scrollTop;
    for (const s of doc.strokes) {
      // Skip strokes entirely above or below the viewport.
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < s.pts.length; i += 2) {
        if (s.pts[i] < minY) minY = s.pts[i];
        if (s.pts[i] > maxY) maxY = s.pts[i];
      }
      if (maxY < top - 50 || minY > top + h + 50) continue;

      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.pts[0], s.pts[1]);
      for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]);
      if (s.pts.length === 2) ctx.lineTo(s.pts[0] + 0.1, s.pts[1]);
      ctx.stroke();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [doc.strokes]);

  useLayoutEffect(redraw, [redraw, showRef]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onScroll = () => redraw();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', redraw);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', redraw);
    };
  }, [redraw]);

  /** Pointer position in note coordinates (independent of scroll). */
  const at = (e: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const scroller = scrollRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top + scroller.scrollTop };
  };

  const eraseAt = (x: number, y: number) => {
    const r = 14;
    commit((d) => {
      // no snapshot here — the gesture already pushed one
      const keep = d.strokes.filter((s) => {
        for (let i = 0; i < s.pts.length; i += 2) {
          if (Math.abs(s.pts[i] - x) < r && Math.abs(s.pts[i + 1] - y) < r) return false;
        }
        return true;
      });
      return keep.length === d.strokes.length ? d : { ...d, strokes: keep };
    }, false);
  };

  /** Text mode: a tap on empty space starts a new box (taps on an existing
   *  box go to the box itself, since the canvas lets them through). */
  const addTextBox = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    const scroller = scrollRef.current!;
    const r = scroller.getBoundingClientRect();
    const id = newId();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top + scroller.scrollTop;
    commit((d) => ({ ...d, texts: [...d.texts, { id, x, y, text: '', size: 30 }] }));
    setEditing(id);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool !== 'pen' && tool !== 'eraser') return;
    const p = at(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is an optimisation — a pointer we can't capture still draws.
    }
    pushUndo();
    if (tool === 'eraser') {
      eraseAt(p.x, p.y);
      drawing.current = { id: 'erasing', color: '', width: 0, pts: [] };
      return;
    }
    drawing.current = { id: newId(), color, width, pts: [p.x, p.y] };
    commit((d) => ({ ...d, strokes: [...d.strokes, drawing.current!] }), false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = at(e);
    if (tool === 'eraser') {
      eraseAt(p.x, p.y);
      return;
    }
    drawing.current.pts.push(p.x, p.y);
    // The in-progress stroke is already in the doc; just repaint.
    redraw();
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = null;
    // The in-progress stroke was mutated in place; re-identify the doc so the
    // debounced save fires.
    const updated = { ...docRef.current };
    docRef.current = updated;
    dirty.current = true;
    setDoc(updated);
  };

  // ── text boxes ──────────────────────────────────────────────────────────
  const setText = (id: string, text: string) =>
    commit((d) => ({ ...d, texts: d.texts.map((t) => (t.id === id ? { ...t, text } : t)) }), false);

  const insertMark = (ch: string) => {
    if (!editing) return;
    const el = textRefs.current.get(editing);
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + ch + el.value.slice(end);
    setText(editing, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const removeEmpty = (id: string) =>
    commit((d) => ({ ...d, texts: d.texts.filter((t) => t.id !== id || t.text.trim()) }), false);

  return (
    <main className="notes-page">
      <div className="notes-toolbar" role="toolbar" aria-label="Note tools">
        <div className="tool-group">
          {(['hand', 'pen', 'eraser', 'text'] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`tool-btn ${tool === t ? 'active' : ''}`}
              aria-pressed={tool === t}
              onClick={() => setTool(t)}
            >
              {t === 'hand' ? '✋ Scroll' : t === 'pen' ? '✏️ Pen' : t === 'eraser' ? '🩹 Erase' : '🇦 Text'}
            </button>
          ))}
        </div>

        {tool === 'pen' && (
          <div className="tool-group">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${c === color ? 'active' : ''}`}
                style={{ background: c }}
                aria-label={`Pen colour ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
            {PEN_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                className={`tool-btn ${w === width ? 'active' : ''}`}
                onClick={() => setWidth(w)}
              >
                {w === 2 ? 'Thin' : w === 4 ? 'Med' : 'Thick'}
              </button>
            ))}
          </div>
        )}

        <div className="tool-group">
          <button type="button" className="tool-btn" onClick={undo}>
            ↶ Undo
          </button>
          <button
            type="button"
            className={`tool-btn ${showRef ? 'active' : ''}`}
            aria-pressed={showRef}
            onClick={() => setShowRef((v) => !v)}
          >
            Lesson words
          </button>
          <span className="save-state">
            {saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved on this device' : ''}
          </span>
        </div>
      </div>

      {tool === 'text' && <MarkPalette onInsert={insertMark} />}

      <div className={`notes-frame tool-${tool}`}>
        <div className="notes-scroll" ref={scrollRef}>
          <div
            className="notes-content"
            style={{ height: contentHeight }}
            onPointerDown={tool === 'text' ? addTextBox : undefined}
          >
          {showRef && <ReferenceSheet lesson={lesson} />}

          {doc.texts.map((t) => (
            <textarea
              key={t.id}
              ref={(el) => {
                if (el) textRefs.current.set(t.id, el);
                else textRefs.current.delete(t.id);
              }}
              className="note-text"
              style={{ left: t.x, top: t.y, fontSize: t.size }}
              value={t.text}
              dir="auto"
              placeholder="Type…"
              autoFocus={editing === t.id}
              onFocus={() => setEditing(t.id)}
              onBlur={() => removeEmpty(t.id)}
              onChange={(e) => setText(t.id, e.target.value)}
            />
          ))}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="notes-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // The pen owns the pointer, so the wheel has to drive scrolling.
          onWheel={(e) => {
            if (scrollRef.current) scrollRef.current.scrollTop += e.deltaY;
          }}
        />
      </div>
    </main>
  );
}
