import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePlayable } from '../lib/usePlayable';
import { toItems } from '../lib/lessons';
import type { Lesson } from '../types';

/**
 * An alphabet song as a strip of letters that flows.
 *
 * The song is ONE recording, and the engine already reports which step is
 * being sung every frame — the same signal that turns a letter green in every
 * other lesson. All the letters sit on one long strip, right to left; the
 * strip glides so the sung letter is at the center, its neighbors visible on
 * both sides, and the sung letter wears the app's green box. The strip moves
 * when the singer moves — a song is not metronomic — and a 350 ms ease is the
 * whole animation. Sisters sit together: a wider gap and a change of family
 * color mark each group, with no card edge and no click.
 *
 * Not a video: a video would be a second copy of the content, re-rendered on
 * every retake, with no pause on a letter and no use of the calibration.
 *
 * Each letter is its own span. The letters are STANDALONE and do not join, so
 * the never-split-a-word rule — which protects cursive joining — is not
 * touched.
 *
 * Until the song is calibrated by tapping along, the automatic timings mean
 * nothing for a sung rhythm. Calibration is the whole timing for a song.
 */
export function SongCards({ lesson, rate }: { lesson: Lesson; rate: number }) {
  const song = lesson.song;
  const playable = useMemo(() => toItems(lesson)[0]?.forms[0], [lesson]);
  const { activeIndex, playing, paused, boundaries, play, stop, pause, resume, seek } = usePlayable(
    lesson,
    playable,
    rate,
  );

  /** Step indices, group by group — a shape family, or a letter in the sounds song. */
  const groups = useMemo(() => {
    const out: number[][] = [];
    (song?.steps ?? []).forEach((s, i) => {
      (out[s.group] ??= []).push(i);
    });
    return out.filter(Boolean);
  }, [song]);
  const groupOf = useCallback((step: number) => groups.findIndex((g) => g.includes(step)), [groups]);

  // The step at the center when nothing is playing. It follows playback, so
  // pausing or stopping leaves the strip exactly where the song was.
  const [focus, setFocus] = useState(0);
  const shown = activeIndex ?? focus;
  useEffect(() => {
    if (activeIndex !== null) setFocus(activeIndex);
  }, [activeIndex]);

  // Center the shown step: translate the strip by the difference between the
  // view's middle and the step's middle. Measured from the rectangles, with
  // the strip's CURRENT translation taken back out — so it is right whether
  // the previous glide has finished or not, and whatever RTL does to offsets.
  const viewRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const strip = stripRef.current;
    const el = strip?.children[shown] as HTMLElement | undefined;
    if (!view || !strip || !el) return;
    const t = getComputedStyle(strip).transform;
    const current = t && t !== 'none' ? new DOMMatrixReadOnly(t).e : 0;
    const vr = view.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const restingCenter = er.left + er.width / 2 - current;
    setDx(vr.left + vr.width / 2 - restingCenter);
  }, [shown, tick, lesson]);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('resize', bump);
    void document.fonts?.ready.then(bump);
    return () => window.removeEventListener('resize', bump);
  }, []);

  const go = useCallback(
    (g: number) => {
      const target = Math.max(0, Math.min(groups.length - 1, g));
      const first = groups[target]?.[0];
      if (first === undefined) return;
      setFocus(first);
      // Mid-song, jump the audio to the group's first letter; before the song
      // has started the strip simply glides there and Play begins from it.
      if (playing && boundaries[first] !== undefined) seek(boundaries[first]);
    },
    [groups, playing, boundaries, seek],
  );

  const togglePlay = useCallback(() => {
    if (!playing) {
      void play(boundaries[focus] ?? 0);
      return;
    }
    if (paused) resume();
    else pause();
  }, [playing, paused, focus, boundaries, play, pause, resume]);

  // Single keys only, as everywhere: someone may be driving this by voice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyN') go(groupOf(shown) + 1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyP') go(groupOf(shown) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, go, groupOf, shown]);

  useEffect(() => () => stop(), [stop]);

  if (!song || !playable) return <p className="loading">This song has no card yet.</p>;

  const section = lesson.sections?.[0];
  const current = groupOf(shown);
  const starts = new Set(groups.map((g) => g[0]));

  return (
    <main className="song-lesson">
      <section className="section-head">
        <h3>
          {section?.title ?? lesson.title}
          <span className="section-ar" dir="rtl" lang="ar">
            {section?.titleArabic ?? lesson.titleArabic}
          </span>
        </h3>
        <p className="section-hint">{section?.hint}</p>
      </section>

      <div className={`song-view ${song.mode}`} ref={viewRef}>
        <div className="song-strip" ref={stripRef} dir="rtl" lang="ar" style={{ transform: `translateX(${dx}px)` }}>
          {song.steps.map((s, i) => (
            <span
              key={i}
              className={`song-letter fam-${(s.family ?? 0) % 7} ${i === activeIndex ? 'on' : ''} ${starts.has(i) && i > 0 ? 'group-start' : ''}`}
            >
              {s.text}
            </span>
          ))}
        </div>
      </div>

      <nav className="pager" aria-label="Song">
        <button type="button" className="btn nav-btn" onClick={() => go(current - 1)} disabled={current <= 0}>
          Back
        </button>
        <button type="button" className="btn primary play-all" onClick={togglePlay}>
          {!playing ? 'Play' : paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="btn nav-btn"
          onClick={() => go(current + 1)}
          disabled={current >= groups.length - 1}
        >
          Next
        </button>
      </nav>

      <p className="page-status" aria-live="polite">
        {current + 1} of {groups.length}
      </p>
      <p className="kbd-hint">
        Keyboard: <kbd>Space</kbd> play or pause, <kbd>←</kbd> <kbd>→</kbd> move along the letters.
      </p>
    </main>
  );
}
