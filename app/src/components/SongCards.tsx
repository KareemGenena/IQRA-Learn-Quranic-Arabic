import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePlayable } from '../lib/usePlayable';
import { toItems } from '../lib/lessons';
import type { Lesson } from '../types';

/**
 * An alphabet song as a strip of letters that flows BY ITSELF as the song
 * is sung.
 *
 * The song is ONE recording. All the letters sit on one long strip, right to
 * left, sisters together with a wider gap and a change of family color. The
 * family being sung is centered and bright, every other family dimmed; the
 * sung letter wears the app's green box. When a family's turn comes the
 * strip GLIDES so that the family is centered as its first letter is sung —
 * three letters' width for ب ت ث after ا, one letter's width for ك after ل,
 * in the same time, so the speed of the glide follows the song (the author,
 * 2026-10-24: the strip must move as he sings, with no Next to press). There
 * is a Play/Pause and nothing else to press; a tap on a letter starts the
 * song from its family.
 *
 * The strip's position is a function of the media time, set every frame
 * from the engine's own clock (`now`) — the same clock the green box runs
 * on — so a pause holds it, a seek jumps it, and a calibrated song glides at
 * exactly the right moments. Until the song is calibrated by tapping along,
 * the automatic timings mean nothing for a sung rhythm: calibration is the
 * whole timing for a song.
 *
 * Not a video: a video would be a second copy of the content, re-rendered on
 * every retake, with no pause on a letter and no use of the calibration.
 *
 * Each letter is its own element. The letters are STANDALONE and do not
 * join, so the never-split-a-word rule — which protects cursive joining — is
 * not touched.
 */

/** A glide ends as the family's first letter is sung and takes at most this
 *  long; a family sung faster than that gives up half its time to it. */
const GLIDE_S = 0.6;
const ease = (u: number) => u * u * (3 - 2 * u);

export function SongCards({ lesson, rate }: { lesson: Lesson; rate: number }) {
  const song = lesson.song;
  const playable = useMemo(() => toItems(lesson)[0]?.forms[0], [lesson]);
  const { activeIndex, playing, paused, boundaries, play, stop, pause, resume, seek, now } = usePlayable(
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
  /** When each family begins, in media time — known once the clip has played. */
  const onsets = useMemo(() => groups.map((g) => boundaries[g[0]] ?? 0), [groups, boundaries]);

  // The family at the center when nothing plays. It follows the song, so a
  // pause leaves the strip where the song is; when the song has REACHED ITS
  // END it goes back to the first family, so Play begins again from the
  // start. Only then: playback also stops when the page is hidden (the
  // warm-up's visibilitychange) or a clip fails, and a teacher who paused on
  // ق and answered a message must find ق, not ا, on coming back.
  const [focus, setFocus] = useState(0);
  const sung = activeIndex !== null ? groupOf(activeIndex) : -1;
  useEffect(() => {
    if (sung >= 0) setFocus(sung);
  }, [sung]);
  /** The media time the frame loop last saw — how the end is told from a stop. */
  const lastSeen = useRef(0);
  const wasPlaying = useRef(false);
  useEffect(() => {
    const end = boundaries[boundaries.length - 1];
    if (wasPlaying.current && !playing && end !== undefined && lastSeen.current >= end - 0.25) setFocus(0);
    wasPlaying.current = playing;
  }, [playing, boundaries]);
  /** Until the first play has resolved the clip's timing there are no onsets
   *  to glide by, and a start is given by CLUSTER, which the hook resolves
   *  against the bounds it fetches — `play(onsets[focus])` was 0 for every
   *  family on a fresh page, so a tapped ك started the song at ا. */
  const timed = boundaries.length > 0;

  // Each family's resting center, measured from its first and last letter's
  // rectangles with the strip's CURRENT translation taken back out — so it is
  // right whether a glide has finished or not, and whatever RTL does to
  // offsets (the first version used offsets and sent ب the wrong way).
  const viewRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const centers = useRef<number[]>([]);
  const viewWidth = useRef(0);
  const measure = useCallback(() => {
    const view = viewRef.current;
    const strip = stripRef.current;
    if (!view || !strip) return;
    const t = getComputedStyle(strip).transform;
    const current = t && t !== 'none' ? new DOMMatrixReadOnly(t).e : 0;
    const vr = view.getBoundingClientRect();
    viewWidth.current = vr.width;
    centers.current = groups.map((g) => {
      const a = (strip.children[g[0]] as HTMLElement | undefined)?.getBoundingClientRect();
      const b = (strip.children[g[g.length - 1]] as HTMLElement | undefined)?.getBoundingClientRect();
      if (!a || !b) return 0;
      return (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2 - current - vr.left;
    });
  }, [groups]);
  /** The translation that puts family `g` at the center of the view. */
  const dxOf = useCallback((g: number) => viewWidth.current / 2 - (centers.current[g] ?? 0), []);
  /** Moves the strip: `live` is the per-frame motion, with no CSS easing. */
  const setX = useCallback((dx: number, live: boolean) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.classList.toggle('live', live);
    strip.style.transform = `translateX(${dx}px)`;
  }, []);

  // At rest, and while paused: the focused family at the center, with the
  // CSS glide — so a resize (an iPad turned) during a pause re-centers it.
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    if (playing && !paused) return;
    measure();
    setX(dxOf(focus), false);
  }, [focus, playing, paused, tick, lesson, measure, dxOf, setX]);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('resize', bump);
    void document.fonts?.ready.then(bump);
    return () => window.removeEventListener('resize', bump);
  }, []);

  // Playing: the strip's place is a function of the media time, set every
  // frame. The family whose turn it is sits at the center; in the last part
  // of its time the strip glides to the next, arriving as that family's
  // first letter is sung.
  useEffect(() => {
    if (!playing || paused || !timed) return;
    measure();
    const dxAt = (t: number) => {
      let k = 0;
      while (k + 1 < onsets.length && t >= onsets[k + 1]) k++;
      if (k + 1 < onsets.length) {
        const g = Math.min(GLIDE_S, 0.5 * (onsets[k + 1] - onsets[k]));
        const start = onsets[k + 1] - g;
        if (g > 0 && t >= start) return dxOf(k) + (dxOf(k + 1) - dxOf(k)) * ease((t - start) / g);
      }
      return dxOf(k);
    };
    let raf = 0;
    const frame = () => {
      const t = now();
      if (t !== null) {
        lastSeen.current = t;
        setX(dxAt(t), true);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [playing, paused, timed, onsets, measure, dxOf, setX, now]);

  /** A tap on a letter: the song from that family. */
  const go = useCallback(
    (g: number) => {
      if (g < 0 || g >= groups.length) return;
      if (playing) {
        seek(onsets[g] ?? 0);
        if (paused) setX(dxOf(g), false);
      } else setFocus(g);
    },
    [groups.length, playing, paused, onsets, seek, setX, dxOf],
  );

  const togglePlay = useCallback(() => {
    if (!playing) {
      // By cluster: a step is a cluster in both songs (no silent clusters,
      // the tatweel of هَـ merged), and the hook resolves it against the
      // timing it has just fetched — right on the first play of the page.
      void play({ cluster: groups[focus]?.[0] ?? 0 });
      return;
    }
    if (paused) resume();
    else pause();
  }, [playing, paused, focus, groups, play, pause, resume]);

  // Single keys only, as everywhere: someone may be driving this by voice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  useEffect(() => () => stop(), [stop]);

  if (!song || !playable) return <p className="loading">This song has no card yet.</p>;

  const section = lesson.sections?.[0];
  const bright = playing && sung >= 0 ? sung : focus;
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
        <div className="song-strip" ref={stripRef} dir="rtl" lang="ar">
          {song.steps.map((s, i) => {
            const g = groupOf(i);
            return (
              <button
                type="button"
                key={i}
                className={`song-letter fam-${(s.family ?? 0) % 7} ${i === activeIndex ? 'on' : ''} ${starts.has(i) && i > 0 ? 'group-start' : ''} ${g !== bright ? 'dim' : ''}`}
                onClick={() => go(g)}
                aria-label={`Start from ${s.text}`}
              >
                {s.text}
              </button>
            );
          })}
        </div>
      </div>

      <nav className="pager" aria-label="Song">
        <button type="button" className="btn primary play-all" onClick={togglePlay}>
          {!playing ? 'Play' : paused ? 'Resume' : 'Pause'}
        </button>
      </nav>

      <p className="page-status" aria-live="polite">
        {bright + 1} of {groups.length}
      </p>
      <p className="kbd-hint">
        The letters move by themselves as the song is sung. Tap a letter to start from it; <kbd>Space</kbd>{' '}
        plays or pauses.
      </p>
    </main>
  );
}
