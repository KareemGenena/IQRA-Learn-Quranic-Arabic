import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayable } from '../lib/usePlayable';
import { toItems } from '../lib/lessons';
import type { Lesson } from '../types';

/**
 * An alphabet song as a run of cards.
 *
 * The song is ONE recording, and the engine already reports which step is
 * being sung every frame — the same signal that turns a letter green in every
 * other lesson. This component takes that one number and derives the rest:
 * which card is showing (the group holding the active step), which letter on
 * it stands out (the active step), and for the sounds song which place in the
 * mouth is lit. The cards turn themselves; nothing is scheduled.
 *
 * The letters on a card are STANDALONE and do not join, so each can be its
 * own span with its own colour. The never-split-a-word rule protects cursive
 * joining, and there is none here to protect.
 *
 * Until the song is calibrated by tapping along, the automatic timings —
 * harakat weights — are meaningless for a sung rhythm and the cards will turn
 * at the wrong moments. Calibration is the whole timing for a song.
 */
export function SongCards({ lesson, rate }: { lesson: Lesson; rate: number }) {
  const song = lesson.song;
  const playable = useMemo(() => toItems(lesson)[0]?.forms[0], [lesson]);
  const { activeIndex, playing, paused, boundaries, play, stop, pause, resume, seek } = usePlayable(
    lesson,
    playable,
    rate,
  );

  /** Step indices, card by card. */
  const groups = useMemo(() => {
    const out: number[][] = [];
    (song?.steps ?? []).forEach((s, i) => {
      (out[s.group] ??= []).push(i);
    });
    return out;
  }, [song]);

  // The card shown while nothing is playing. It follows playback, so pausing
  // or stopping leaves the same card on screen.
  const [manual, setManual] = useState(0);
  const sung = activeIndex !== null ? (song?.steps[activeIndex]?.group ?? manual) : manual;
  useEffect(() => {
    if (activeIndex !== null && song) setManual(song.steps[activeIndex].group);
  }, [activeIndex, song]);

  const go = useCallback(
    (g: number) => {
      const target = Math.max(0, Math.min(groups.length - 1, g));
      setManual(target);
      // Mid-song, jump the audio to the card's first letter. The boundaries
      // are known once the song has started; before that, the card simply
      // changes and Play starts from the top.
      const first = groups[target]?.[0];
      if (playing && first !== undefined && boundaries[first] !== undefined) seek(boundaries[first]);
    },
    [groups, playing, boundaries, seek],
  );

  const togglePlay = useCallback(() => {
    if (!playing) {
      const first = groups[manual]?.[0];
      void play(first !== undefined && boundaries[first] !== undefined ? boundaries[first] : 0);
      return;
    }
    if (paused) resume();
    else pause();
  }, [playing, paused, groups, manual, boundaries, play, pause, resume]);

  // Single keys only — the same rule as every lesson: someone may be driving
  // this by voice, and "press space" is one utterance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const code = e.code;
      if (code === 'Space' || code === 'KeyN' && e.shiftKey) {
        e.preventDefault();
        togglePlay();
      } else if (code === 'ArrowRight' || code === 'KeyN') go(sung + 1);
      else if (code === 'ArrowLeft' || code === 'KeyP') go(sung - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, go, sung]);

  useEffect(() => () => stop(), [stop]);

  if (!song || !playable) return <p className="loading">This song has no card yet.</p>;

  const steps = groups[sung] ?? [];
  const zone = song.mode === 'sounds' ? song.steps[activeIndex ?? steps[0]]?.zone : undefined;
  const section = lesson.sections?.[0];

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

      {/* The key remounts the card when it changes, which is what plays the
          fade-in. Fifteen lines of CSS and no more animation than that. */}
      <div className={`song-card ${song.mode}`} key={sung}>
        {zone && (
          <img
            className="makhraj-pic"
            src={`${import.meta.env.BASE_URL}images/kids/makhraj-${zone}.png?v=${__IMAGE_VERSION__}`}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
        )}
        <div className="song-letters" dir="rtl" lang="ar">
          {steps.map((i) => (
            <span key={i} className={`song-letter ${i === activeIndex ? 'on' : ''}`}>
              {song.steps[i].text}
            </span>
          ))}
        </div>
      </div>

      <nav className="pager" aria-label="Song cards">
        <button type="button" className="btn nav-btn" onClick={() => go(sung - 1)} disabled={sung === 0}>
          Back
        </button>
        <button type="button" className="btn primary play-all" onClick={togglePlay}>
          {!playing ? 'Play' : paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="btn nav-btn"
          onClick={() => go(sung + 1)}
          disabled={sung === groups.length - 1}
        >
          Next
        </button>
      </nav>

      <p className="page-status" aria-live="polite">
        card {sung + 1} of {groups.length}
      </p>
      <p className="kbd-hint">
        Keyboard: <kbd>Space</kbd> play or pause, <kbd>←</kbd> <kbd>→</kbd> change card.
      </p>
    </main>
  );
}
