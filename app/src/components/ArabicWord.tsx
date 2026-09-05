import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { splitClusters, unreadFinalMaddah } from '../lib/graphemes';
import type { LetterCluster } from '../lib/graphemes';
import type { HighlightPhase } from '../lib/timing';

interface Props {
  text: string;
  clusters: LetterCluster[];
  /** Cluster to highlight while it is being pronounced, or null. */
  activeIndex: number | null;
  /** 'ghunna' while the hum that opens the active letter sounds — the
   *  highlight stays on the letter but changes colour. */
  activePhase?: HighlightPhase;
  /** Cluster awaiting a calibration tap — marked with an underline. */
  pendingIndex?: number | null;
  /** Leading clusters forming the ال prefix, painted in the accent colour. */
  prefixClusters?: number;
  /** Clusters written but not pronounced — painted faded. */
  silentClusters?: number[];
  /** A single cluster painted as the letter being taught. */
  markCluster?: number;
  /** Grey the last letter's vowel: it is written, and at the stop it is not said. */
  dimFinalMark?: boolean;
  className?: string;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A copy of the text clipped to one letter range, used to recolour it. */
interface Layer {
  className: string;
  clip: string;
  /** The string this layer draws, when it is not the word itself. */
  text?: string;
}

/** Shared so the default prop is a STABLE reference — a fresh `[]` default
 *  would change identity on every render and re-trigger the layout effect
 *  forever. */
const NO_CLUSTERS: number[] = [];

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

const sameLayers = (a: Layer[], b: Layer[]) =>
  a.length === b.length &&
  a.every((l, i) => l.className === b[i].className && l.clip === b[i].clip && l.text === b[i].text);

/** Short vowels and tanween — what a stop takes off the final letter. */
const FINAL_VOWEL = '\u064B-\u0650';
/** The maddah \u2014 unread on a final long vowel with no next word to reach. */
const MADDAH = '\u0653';

/**
 * Renders an Arabic word as ONE intact text node — never split into spans,
 * which would break the cursive joining — and paints on top of it:
 *
 *  - the active letter's highlight, an absolutely positioned box measured
 *    with the Range API;
 *  - recoloured letter ranges (the ال prefix, silent letters), each drawn as
 *    a full copy of the same string clipped to that range. Because every
 *    layer contains the identical string, the shaping is identical, so the
 *    letters keep joining exactly as they should.
 */
export function ArabicWord({
  text,
  clusters,
  activeIndex,
  activePhase = null,
  pendingIndex = null,
  prefixClusters = 0,
  silentClusters = NO_CLUSTERS,
  markCluster,
  dimFinalMark = false,
  className,
}: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [highlight, setHighlight] = useState<Box | null>(null);
  const [pending, setPending] = useState<Box | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  /** Bumped when the webfont finishes loading or the box resizes, so every
   *  measurement is redone against the real glyphs. */
  const [revision, setRevision] = useState(0);
  /** Stable dependency for the silent list — callers may hand us a new array
   *  with identical contents on every render. */
  const silentKey = silentClusters.join(',');

  /** Screen box of clusters [from, to), relative to the wrapper. */
  const measure = useCallback((from: number, to: number): Box | null => {
    const wrap = wrapRef.current;
    const node = textRef.current?.firstChild;
    if (!wrap || !node || from < 0 || to > clusters.length || from >= to) return null;

    const range = document.createRange();
    try {
      range.setStart(node, clusters[from].start);
      range.setEnd(node, clusters[to - 1].end);
    } catch {
      return null;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    const wrapRect = wrap.getBoundingClientRect();
    return {
      left: rect.left - wrapRect.left,
      top: rect.top - wrapRect.top,
      width: rect.width,
      height: rect.height,
    };
  }, [clusters]);

  // Re-measure once the webfont is ready and whenever the element actually
  // changes size: glyph metrics differ between the fallback and real font.
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && setRevision((r) => r + 1));
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') {
      return () => {
        alive = false;
      };
    }
    // Only react to a real size change — bumping on every notification would
    // feed back into the layer effect and spin.
    let lastW = -1;
    let lastH = -1;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (Math.abs(width - lastW) < 0.5 && Math.abs(height - lastH) < 0.5) return;
      lastW = width;
      lastH = height;
      setRevision((r) => r + 1);
    });
    ro.observe(wrap);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapWidth = wrap.getBoundingClientRect().width;

    // Clip horizontally only: the full height is kept so tall diacritics and
    // low vowels are never sliced off.
    const clipTo = (from: number, to: number): string | null => {
      const box = measure(from, to);
      if (!box) return null;
      const right = Math.max(0, wrapWidth - (box.left + box.width));
      return `inset(0 ${right.toFixed(2)}px 0 ${Math.max(0, box.left).toFixed(2)}px)`;
    };

    const next: Layer[] = [];
    if (prefixClusters > 0) {
      const clip = clipTo(0, prefixClusters);
      if (clip) next.push({ className: 'layer-prefix', clip });
    }
    for (const idx of silentClusters) {
      const clip = clipTo(idx, idx + 1);
      if (clip) next.push({ className: 'layer-silent', clip });
    }
    if (markCluster !== undefined) {
      const clip = clipTo(markCluster, markCluster + 1);
      if (clip) next.push({ className: 'layer-mark', clip });
    }
    // A mark on the last letter greyed, the letter under it not: the final
    // vowel a stop drops (`dimFinalMark`), or a maddah with no next word to
    // reach (derived from the text). A mark cannot be clipped apart from its
    // letter — they share the same horizontal span — so this is two layers
    // over the last cluster: the whole string in the silent colour, and on
    // top of it the same string with that mark removed, in the text colour.
    // Removing a mark does not change the letters' shaping, so the two copies
    // line up exactly and only the mark shows through grey.
    const dimMarks = (dimFinalMark ? FINAL_VOWEL : '') + (unreadFinalMaddah(text) ? MADDAH : '');
    if (dimMarks && clusters.length) {
      const last = clusters[clusters.length - 1];
      const clip = clipTo(clusters.length - 1, clusters.length);
      const stripped = text.slice(0, last.start) + last.text.replace(new RegExp(`[${dimMarks}]`, 'g'), '') + text.slice(last.end);
      if (clip && stripped !== text) {
        next.push({ className: 'layer-silent', clip });
        next.push({ className: 'layer-plain', clip, text: stripped });
      }
    }
    // Only commit a real change: setting an equal-but-new array would
    // re-render, which would run this effect again.
    setLayers((prev) => (sameLayers(prev, next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, prefixClusters, silentKey, markCluster, dimFinalMark, clusters, text, revision]);

  useLayoutEffect(() => {
    const box = activeIndex === null ? null : measure(activeIndex, activeIndex + 1);
    const next = box && {
      left: box.left - 3,
      top: box.top - 2,
      width: box.width + 6,
      height: box.height + 4,
    };
    setHighlight((prev) => (sameBox(prev, next) ? prev : next));
  }, [measure, activeIndex, text, revision]);

  useLayoutEffect(() => {
    const next = pendingIndex === null ? null : measure(pendingIndex, pendingIndex + 1);
    setPending((prev) => (sameBox(prev, next) ? prev : next));
  }, [measure, pendingIndex, text, revision]);

  /**
   * Shrink a long phrase until it fits, rather than letting it run out of the
   * card.
   *
   * Wrapping would be the obvious answer and is the wrong one here: every
   * highlight and every recoloured layer is a horizontal `inset()` taken from
   * one bounding rect, so a phrase broken across two lines would clip the
   * wrong region on both. Staying on one line and scaling the type keeps that
   * geometry exactly as it was. The floor is 0.55 — below that the marks stop
   * being legible, and a phrase that long wants breaking up in the sheet.
   */
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = textRef.current;
    if (!wrap || !el) return;

    const fit = () => {
      wrap.style.removeProperty('--fit');
      const available = wrap.clientWidth;
      const needed = el.scrollWidth;
      if (!available || !needed) return;
      const scale = Math.max(0.55, Math.min(1, available / needed));
      if (scale >= 1) return; // it already fits; nothing was changed
      wrap.style.setProperty('--fit', String(scale));
      // Every layer was measured off the old layout, so take them again.
      setRevision((r) => r + 1);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span ref={wrapRef} className={`arabic-word ${className ?? ''}`}>
      {highlight && (
        <span
          className={`letter-highlight${activePhase ? ` phase-${activePhase}` : ''}`}
          style={{ left: highlight.left, top: highlight.top, width: highlight.width, height: highlight.height }}
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
      {layers.map((layer, i) => (
        <span
          key={`${layer.className}-${i}`}
          className={`arabic-text arabic-layer ${layer.className}`}
          style={{ clipPath: layer.clip }}
          dir="rtl"
          lang="ar"
          aria-hidden="true"
        >
          {layer.text ?? text}
        </span>
      ))}
    </span>
  );
}

/** Convenience for callers that don't already have the clusters. */
export function useClusters(text: string): LetterCluster[] {
  const ref = useRef<{ text: string; clusters: LetterCluster[] }>({ text: '', clusters: [] });
  if (ref.current.text !== text) ref.current = { text, clusters: splitClusters(text) };
  return ref.current.clusters;
}
