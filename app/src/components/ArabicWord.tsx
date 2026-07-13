import { useLayoutEffect, useRef, useState } from 'react';
import type { LetterCluster } from '../lib/graphemes';

interface Props {
  text: string;
  clusters: LetterCluster[];
  /** Index of the letter to highlight, or null for none. */
  activeIndex: number | null;
  /** Letter awaiting a calibration tap — shown with an underline marker. */
  pendingIndex?: number | null;
  className?: string;
}

interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Renders an Arabic word as ONE intact text node — never split into spans,
 * which would break cursive joining — and highlights the active letter with
 * a positioned overlay behind the text. The overlay's position comes from
 * measuring the letter's on-screen rectangle with the Range API.
 */
export function ArabicWord({ text, clusters, activeIndex, pendingIndex = null, className }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overlay, setOverlay] = useState<OverlayRect | null>(null);
  const [pending, setPending] = useState<OverlayRect | null>(null);

  const measure = (index: number | null): OverlayRect | null => {
    const wrap = wrapRef.current;
    const textEl = textRef.current;
    if (index === null || !wrap || !textEl || !textEl.firstChild) return null;
    const cluster = clusters[index];
    if (!cluster) return null;

    const range = document.createRange();
    const node = textEl.firstChild;
    try {
      range.setStart(node, cluster.start);
      range.setEnd(node, cluster.end);
    } catch {
      return null;
    }
    const rect = range.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    const padX = 3;
    return {
      left: rect.left - wrapRect.left - padX,
      top: rect.top - wrapRect.top - 2,
      width: rect.width + padX * 2,
      height: rect.height + 4,
    };
  };

  useLayoutEffect(() => {
    setOverlay(measure(activeIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, text]);

  useLayoutEffect(() => {
    setPending(measure(pendingIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIndex, text]);

  return (
    <span ref={wrapRef} className={`arabic-word ${className ?? ''}`}>
      {overlay && (
        <span
          className="letter-highlight"
          style={{
            left: overlay.left,
            top: overlay.top,
            width: overlay.width,
            height: overlay.height,
          }}
        />
      )}
      {pending && (
        <span
          className="letter-pending"
          style={{ left: pending.left, width: pending.width, top: pending.top + pending.height }}
        />
      )}
      <span ref={textRef} className="arabic-text" dir="rtl" lang="ar">
        {text}
      </span>
    </span>
  );
}
