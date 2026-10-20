import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArabicWord } from './ArabicWord';
import { PlayIcon } from './PlayIcon';
import { usePlayable } from '../lib/usePlayable';
import { stopPlayable } from '../lib/lessons';
import { warmPlayable } from '../lib/playback';
import type { Lesson, LessonItem, Playable, Reading } from '../types';

interface FormProps {
  lesson: Lesson;
  playable: Playable;
  rate: number;
  label: string;
  reading: Reading;
  register?: (key: string, play: () => Promise<void>, playOther?: () => Promise<void>) => void;
}

/**
 * One form of the word, with its two readings where two were recorded.
 *
 * ONE play button — the word itself. Beneath it a small pair of tabs, "read
 * on" and "at a stop", says which reading that button plays; the page's
 * switch sets every card, and a tab sets this card alone until the page is
 * switched again. Tapping the other tab plays that reading at once, so either
 * is one tap away without a second play button (the author read two play
 * buttons under one word as a duplication, 2026-10-20). A reading with no
 * take yet shows as a tab that cannot be chosen, and says why on hover.
 *
 * Two players, one per reading, bound once: the card's highlight follows
 * whichever is sounding. The word is drawn the same for both readings — no
 * greying of the final vowel at a stop (the author's call, 2026-10-20).
 *
 * The clips of both readings are fetched when the card appears, so the first
 * tap plays at once instead of after a download; while a tap waits on one
 * anyway, the button shows it and a second tap is ignored rather than
 * cancelling the first.
 */
function Form({ lesson, playable, rate, label, reading, register }: FormProps) {
  const stop = useMemo(() => stopPlayable(playable), [playable]);
  const [override, setOverride] = useState<Reading | null>(null);
  // The page's switch resets every card's own choice.
  useEffect(() => setOverride(null), [reading]);
  const effective: Reading = override ?? reading;
  const atStop = effective === 'stop' && !!stop;

  const cont = usePlayable(lesson, playable, rate);
  // Hooks are unconditional: a form without a stop take gets a second player
  // of the continuing reading, never used.
  const stp = usePlayable(lesson, stop ?? playable, rate);
  const current = atStop ? stp : cont;
  const live = stop && stp.playing ? stp : cont.playing ? cont : current;

  // Fetch both readings as the card appears — the clip and its timing — so
  // the first tap does not wait on the network.
  useEffect(() => {
    const t = window.setTimeout(() => {
      void warmPlayable(lesson, playable);
      if (stop) void warmPlayable(lesson, stop);
    }, 120);
    return () => window.clearTimeout(t);
  }, [lesson, playable, stop]);

  const choose = useCallback(
    (r: Reading) => {
      if (r === 'stop' && !stop) return Promise.resolve();
      setOverride(r);
      return r === 'stop' ? stp.play() : cont.play();
    },
    [stop, stp.play, cont.play],
  );
  const playOther = useCallback(() => choose(atStop ? 'continuing' : 'stop'), [choose, atStop]);

  useEffect(() => {
    // Under the form's own key whichever reading is current, so the page's
    // walk finds it; the other reading for the W key.
    register?.(playable.key, current.play, stop ? playOther : undefined);
  }, [register, playable.key, current.play, stop, playOther]);

  const busy = cont.loading || stp.loading;
  return (
    <>
      <button
        type="button"
        className={`form-btn ${live.playing ? 'playing' : ''} ${busy ? 'loading' : ''}`}
        onClick={() => {
          if (busy) return;
          void current.toggle();
        }}
        aria-label={label}
        aria-busy={busy}
      >
        <ArabicWord
          text={playable.text}
          clusters={cont.clusters}
          activeIndex={live.activeIndex}
          activePhase={live.activePhase}
          prefixClusters={playable.prefixClusters}
          silentClusters={playable.silentClusters}
          markCluster={playable.highlightCluster}
          dimFinalMark={playable.dimFinalMark}
        />
        <PlayIcon playing={live.playing} loading={busy} />
      </button>
      <div className="reading-tabs" role="group" aria-label="Which reading this word plays">
        <button
          type="button"
          className={`reading-tab ${effective === 'continuing' ? 'active' : ''} ${cont.playing ? 'playing' : ''}`}
          aria-pressed={effective === 'continuing'}
          title="With its last vowel, as when the reading carries on"
          onClick={() => void choose('continuing')}
        >
          read on
        </button>
        <button
          type="button"
          className={`reading-tab ${atStop ? 'active' : ''} ${stop && stp.playing ? 'playing' : ''}`}
          aria-pressed={atStop}
          disabled={!stop}
          title={stop ? 'As read when you pause on it' : 'Not recorded at a stop yet'}
          onClick={() => void choose('stop')}
        >
          at a stop{!stop && <span className="reading-tab-note"> · not yet recorded</span>}
        </button>
      </div>
    </>
  );
}

interface Props {
  lesson: Lesson;
  item: LessonItem;
  rate: number;
  /** Display number on the card — matches the position on screen. */
  displayNo: number;
  register?: (key: string, play: () => Promise<void>, playOther?: () => Promise<void>) => void;
  /** Hide the badges (used in the quiz, where the learner must decide). */
  hideBadges?: boolean;
  /** Which reading the big button plays, where a form has two. */
  reading?: Reading;
}

/** Broadcast so at most one meaning is open at a time. */
const TIP_EVENT = 'iqra-meaning-open';

export function ItemCard({ lesson, item, rate, displayNo, register, hideBadges, reading = 'continuing' }: Props) {
  const [showMeaning, setShowMeaning] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const tipId = useId();
  const headRef = useRef<HTMLDivElement>(null);

  // While a meaning is open, dismiss it on a tap outside, on Escape, or when
  // another card's meaning opens. No auto-timeout: content shown on hover or
  // focus must stay until the reader dismisses it (WCAG 1.4.13), and a timer
  // would snatch it away from anyone reading slowly.
  useEffect(() => {
    if (!showMeaning && !showImage) return;
    const close = () => {
      setShowMeaning(false);
      setShowImage(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!headRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== tipId) close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener(TIP_EVENT, onOther);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener(TIP_EVENT, onOther);
    };
  }, [showMeaning, showImage, tipId]);

  const toggleMeaning = () => {
    setShowMeaning((open) => {
      if (!open) window.dispatchEvent(new CustomEvent(TIP_EVENT, { detail: tipId }));
      return !open;
    });
  };

  return (
    <div className={`pair-card ${item.section}`}>
      <div className="pair-head" ref={headRef}>
        <span className="word-num">{displayNo}</span>
        {!hideBadges &&
          item.badges.map((b) => (
            // A ghunna badge wears the ghunna highlight's color, so the chip
            // and the moment in the word read as the same thing. Timing dots
            // read right to left under the word they describe (two under the
            // madd of قَالَ, on the right), so the chip does too.
            <span
              key={b}
              className={`type-badge${/ghunna|ikhfa/i.test(b) ? ' badge-ghunna' : ''}${/●/.test(b) ? ' badge-dots' : ''}`}
              dir={/●/.test(b) ? 'rtl' : undefined}
            >
              {b}
            </span>
          ))}
        {item.image && (
          <>
            <button
              type="button"
              className="info-btn"
              aria-label={`Waveform for ${displayNo}`}
              title="See the waveform"
              aria-expanded={showImage}
              onClick={() => setShowImage((v) => !v)}
            >
              {/* a tiny waveform, so it reads as "a picture of the sound" */}
              <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
                <path
                  d="M2 10h2M6 6v8M10 3v14M14 6.5v7M18 10h-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span className={`image-pop ${showImage ? 'open' : ''}`} role="tooltip">
              <img src={item.image} alt={`Waveform of drill ${displayNo}`} />
              <span className="image-cap">
                The two letters look plainly different — ه spreads, ح is denser.
              </span>
            </span>
          </>
        )}
        {item.meaning && (
          <>
            <button
              type="button"
              className="info-btn"
              aria-label={`Meaning of word ${displayNo}`}
              aria-expanded={showMeaning}
              aria-describedby={showMeaning ? tipId : undefined}
              onClick={toggleMeaning}
            >
              i
            </button>
            <span id={tipId} role="tooltip" className={`meaning-tip ${showMeaning ? 'open' : ''}`}>
              {item.meaning}
              {/* Only a quotation is somebody's translation; a location or a
                  note is the author's own and carries no credit line. */}
              {lesson.meaningSource && /[“"]/.test(item.meaning) && (
                <span className="meaning-source">Translation: {lesson.meaningSource}</span>
              )}
            </span>
          </>
        )}
      </div>

      <div className="pair-forms">
        {item.forms.map((form, i) => {
          const caption = item.formLabels?.[i] ?? lesson.formLabels?.[i];
          return (
            <div key={form.key} className="form-slot">
              {caption && <span className="form-caption">{caption}</span>}
              <Form
                lesson={lesson}
                playable={form}
                rate={rate}
                label={caption ? `Play ${displayNo} ${caption}` : i === 0 ? `Play ${displayNo}` : `Play ${displayNo} with al`}
                reading={reading}
                register={register}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
