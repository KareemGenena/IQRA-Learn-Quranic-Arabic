import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayable } from '../lib/usePlayable';
import { Transport } from './Transport';
import { toItems } from '../lib/lessons';
import type { Lesson } from '../types';

/**
 * An alphabet song, sung along line by line — karaoke, not a moving strip.
 *
 * The song is ONE recording. The screen shows one LINE of it at a time,
 * large and still: a sung line of seven names in the names song (ا…خ ·
 * د…ص · ض…ق · ك…ى), two letters' sounds in the sounds song. The letter being
 * sung wears the app's green box; nothing else moves. Just before the next
 * line is sung the line on screen gives way to it — a short fade, never a
 * slide. Below, the whole song small, one row per line, the current one
 * marked: the teacher sees where the class is and taps a row to go there.
 *
 * Why (the author, 2026-10-25): the strip that glided under the sung letter
 * made him dizzy — a glide for every single letter, a third of a second
 * each. Letters standing still while the box walks along them is how a
 * child follows a printed line, and a line that turns every few seconds
 * reads like a page.
 *
 * Which line is on screen is a function of the MEDIA TIME, read every frame
 * from the engine's own clock (`now`), the clock the green box runs on: a
 * pause holds it, a seek jumps it. The timing is baked from the recording
 * itself (the song's breaths and its notes' onsets, scripts/lib/align.mjs);
 * a tap calibration still overrides it.
 *
 * Play, Pause and Stop (and Space to play or pause); a tap on a letter starts the song from that
 * letter. Each letter is its own element — they are standalone and do not
 * join, so the never-split-a-word rule is not touched.
 */

/** A line gives way this long before its successor's first note, so the
 *  new line is on screen as it is sung. */
const LEAD_S = 0.3;

export function SongCards({ lesson, rate }: { lesson: Lesson; rate: number }) {
  const song = lesson.song;
  const playable = useMemo(() => toItems(lesson)[0]?.forms[0], [lesson]);
  const { activeIndex, playing, paused, loading, boundaries, play, stop, pause, resume, seek, now } = usePlayable(
    lesson,
    playable,
    rate,
  );
  const steps = useMemo(() => song?.steps ?? [], [song]);

  /** [first step, step after the last] of every line. Without `song.lines`
   *  (an older words.json) a line is a group — a shape family, or a letter. */
  const lines = useMemo(() => {
    let starts = song?.lines?.length ? song.lines : [];
    if (!starts.length) starts = steps.map((s, i) => (i === 0 || s.group !== steps[i - 1].group ? i : -1)).filter((i) => i >= 0);
    return starts.map((a, k) => [a, starts[k + 1] ?? steps.length] as [number, number]);
  }, [song, steps]);
  const lineOf = useCallback((step: number) => Math.max(0, lines.findIndex(([a, b]) => step >= a && step < b)), [lines]);

  const [line, setLine] = useState(0);
  const timed = boundaries.length > 0;

  /** The line on screen while the song plays: the last one whose first note
   *  is less than LEAD_S away. */
  const lineAt = useCallback(
    (t: number) => {
      let k = 0;
      while (k + 1 < lines.length && t >= (boundaries[lines[k + 1][0]] ?? Infinity) - LEAD_S) k++;
      return k;
    },
    [lines, boundaries],
  );

  /** The media time the frame loop last saw — how the end is told from a stop. */
  const lastSeen = useRef(0);
  useEffect(() => {
    if (!playing || paused || !timed) return;
    let raf = 0;
    const frame = () => {
      const t = now();
      if (t !== null) {
        lastSeen.current = t;
        const k = lineAt(t);
        setLine((l) => (l === k ? l : k));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, paused, timed, now, lineAt]);

  // When the song has REACHED ITS END it goes back to the first line, so
  // Play begins again from the start. Only then: playback also stops when
  // the page is hidden, and a teacher who paused on ق and answered a message
  // must find ق's line, not the first, on coming back.
  const wasPlaying = useRef(false);
  useEffect(() => {
    const end = boundaries[boundaries.length - 1];
    if (wasPlaying.current && !playing && end !== undefined && lastSeen.current >= end - 0.25) setLine(0);
    wasPlaying.current = playing;
  }, [playing, boundaries]);

  /** A tap on a letter: the song from that letter. */
  const fromStep = useCallback(
    (i: number) => {
      if (playing && timed) {
        seek(boundaries[i] ?? 0);
        if (paused) setLine(lineOf(i));
        return;
      }
      setLine(lineOf(i));
      void play({ cluster: i });
    },
    [playing, timed, paused, boundaries, seek, play, lineOf],
  );

  /** A tap on a row of the whole song: that line, playing or not. */
  const toLine = useCallback(
    (k: number) => {
      setLine(k);
      if (playing && timed) seek(boundaries[lines[k][0]] ?? 0);
    },
    [playing, timed, boundaries, lines, seek],
  );

  /** Play: from the line on screen, or on from where Pause held it. */
  const start = useCallback(() => {
    if (playing) {
      if (paused) resume();
      return;
    }
    // By cluster: a step is a cluster in both songs, and the hook resolves
    // it against the timing it has just fetched — right on a first play.
    void play({ cluster: lines[line]?.[0] ?? 0 });
  }, [playing, paused, line, lines, play, resume]);

  /** Stop: the song ends, and the next Play starts it from the top. */
  const end = useCallback(() => {
    stop();
    setLine(0);
  }, [stop]);

  const togglePlay = useCallback(() => {
    if (playing && !paused) pause();
    else start();
  }, [playing, paused, pause, start]);

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
  const [from, to] = lines[line] ?? [0, 0];
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k);
  const startsGroup = (i: number) => i > 0 && steps[i].group !== steps[i - 1].group;

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

      <div className={`song-view ${song.mode}`}>
        {/* keyed by line: a new line is a new element, and fades in */}
        <div className="song-line" key={line} dir="rtl" lang="ar">
          {range(from, to).map((i) => (
            <button
              type="button"
              key={i}
              className={`song-letter fam-${(steps[i].family ?? 0) % 7} ${i === activeIndex ? 'on' : ''} ${i > from && startsGroup(i) ? 'group-start' : ''}`}
              onClick={() => fromStep(i)}
              aria-label={`Start from ${steps[i].text}`}
            >
              {steps[i].text}
            </button>
          ))}
        </div>
      </div>

      <nav className="pager" aria-label="Song">
        <Transport
          state={!playing ? 'idle' : paused ? 'paused' : 'playing'}
          waiting={loading}
          onPlay={start}
          onPause={pause}
          onStop={end}
          label="The song"
        />
      </nav>

      {/* the whole song, small: one row per line, the current one marked */}
      <ol className={`song-lines ${song.mode}`} aria-label="The whole song">
        {lines.map(([a, b], k) => (
          <li key={k}>
            <button
              type="button"
              className={`song-row ${k === line ? 'current' : ''}`}
              aria-current={k === line ? 'true' : undefined}
              onClick={() => toLine(k)}
              dir="rtl"
              lang="ar"
            >
              {range(a, b).map((i) => (
                <span key={i} className={`song-mini ${i === activeIndex ? 'on' : ''}`}>
                  {steps[i].text}
                </span>
              ))}
            </button>
          </li>
        ))}
      </ol>

      <p className="kbd-hint">
        The line turns by itself as the song is sung. Tap a letter to start from it, or a row below to go to that
        line; <kbd>Space</kbd> plays or pauses.
      </p>
    </main>
  );
}
