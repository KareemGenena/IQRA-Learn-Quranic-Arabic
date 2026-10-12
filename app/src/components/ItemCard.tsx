import { useEffect, useId, useRef, useState } from 'react';
import { ArabicWord } from './ArabicWord';
import { PlayIcon } from './PlayIcon';
import { usePlayable } from '../lib/usePlayable';
import { stopPlayable } from '../lib/lessons';
import type { Lesson, LessonItem, Playable, Reading } from '../types';

interface FormProps {
  lesson: Lesson;
  playable: Playable;
  rate: number;
  label: string;
  reading: Reading;
  register?: (key: string, play: () => Promise<void>) => void;
}

/**
 * One form of the word, with both of its readings when two were recorded.
 * The reading the lesson is set to is the big button — what Play, Play all
 * and the N key mean — and the other is a small button beneath, so either is
 * one tap away without touching the switch. The word is drawn for whichever
 * is sounding, and at rest for the reading the lesson is set to: at a stop,
 * with its final vowel greyed.
 */
function Form({ lesson, playable, rate, label, reading, register }: FormProps) {
  const stop = stopPlayable(playable);
  const primary = reading === 'stop' && stop ? stop : playable;
  const other = reading === 'stop' && stop ? playable : stop;
  const main = usePlayable(lesson, primary, rate);
  // Hooks are unconditional: a form with one reading gets a second player of
  // that same reading, never shown and never used.
  const alt = usePlayable(lesson, other ?? primary, rate);
  const sounding = other && alt.playing ? { playable: other, player: alt } : { playable: primary, player: main };

  useEffect(() => {
    // Under the form's own key whichever reading is primary, so the page's
    // walk finds it.
    register?.(playable.key, main.play);
  }, [register, playable.key, main.play]);

  return (
    <>
      <button
        type="button"
        className={`form-btn ${main.playing ? 'playing' : ''}`}
        onClick={() => void main.toggle()}
        aria-label={label}
      >
        <ArabicWord
          text={playable.text}
          clusters={main.clusters}
          activeIndex={sounding.player.activeIndex}
          activePhase={sounding.player.activePhase}
          prefixClusters={playable.prefixClusters}
          silentClusters={playable.silentClusters}
          markCluster={playable.highlightCluster}
          dimFinalMark={sounding.playable.dimFinalMark}
        />
        <PlayIcon playing={main.playing} />
      </button>
      {other ? (
        <button
          type="button"
          className={`alt-btn ${alt.playing ? 'playing' : ''}`}
          onClick={() => void alt.toggle()}
          aria-label={`${label}, ${other.waqf ? 'at a stop' : 'continuing'}`}
        >
          <PlayIcon playing={alt.playing} />
          {other.waqf ? 'At a stop' : 'Continuing'}
        </button>
      ) : (
        // Shown before the take exists too, so the second reading is a visible
        // part of every card and the author can see what is still to record.
        <span className="alt-btn missing" title="This reading has not been recorded yet">
          At a stop · not yet recorded
        </span>
      )}
    </>
  );
}

interface Props {
  lesson: Lesson;
  item: LessonItem;
  rate: number;
  /** Display number on the card — matches the position on screen. */
  displayNo: number;
  register?: (key: string, play: () => Promise<void>) => void;
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
    const close = () => { setShowMeaning(false); setShowImage(false); };
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
            // and the moment in the word read as the same thing.
            // Timing dots read right to left under the word they describe
            // (two under the madd of قَالَ, on the right), so the chip does too.
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
