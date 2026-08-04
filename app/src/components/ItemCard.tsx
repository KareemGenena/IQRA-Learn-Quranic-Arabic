import { useEffect, useId, useRef, useState } from 'react';
import { ArabicWord } from './ArabicWord';
import { PlayIcon } from './PlayIcon';
import { usePlayable } from '../lib/usePlayable';
import type { Lesson, LessonItem, Playable } from '../types';

interface FormProps {
  lesson: Lesson;
  playable: Playable;
  rate: number;
  label: string;
  register?: (key: string, play: () => Promise<void>) => void;
}

function Form({ lesson, playable, rate, label, register }: FormProps) {
  const { clusters, activeIndex, playing, play, toggle } = usePlayable(lesson, playable, rate);

  useEffect(() => {
    register?.(playable.key, play);
  }, [register, playable.key, play]);

  return (
    <button
      type="button"
      className={`form-btn ${playing ? 'playing' : ''}`}
      onClick={() => void toggle()}
      aria-label={label}
    >
      <ArabicWord
        text={playable.text}
        clusters={clusters}
        activeIndex={activeIndex}
        prefixClusters={playable.prefixClusters}
        silentClusters={playable.silentClusters}
        markCluster={playable.highlightCluster}
      />
      <PlayIcon playing={playing} />
    </button>
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
}

/** Broadcast so at most one meaning is open at a time. */
const TIP_EVENT = 'iqra-meaning-open';

export function ItemCard({ lesson, item, rate, displayNo, register, hideBadges }: Props) {
  const [showMeaning, setShowMeaning] = useState(false);
  const tipId = useId();
  const headRef = useRef<HTMLDivElement>(null);

  // While a meaning is open, dismiss it on a tap outside, on Escape, or when
  // another card's meaning opens. No auto-timeout: content shown on hover or
  // focus must stay until the reader dismisses it (WCAG 1.4.13), and a timer
  // would snatch it away from anyone reading slowly.
  useEffect(() => {
    if (!showMeaning) return;
    const close = () => setShowMeaning(false);
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
  }, [showMeaning, tipId]);

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
            <span key={b} className="type-badge">
              {b}
            </span>
          ))}
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
            </span>
          </>
        )}
      </div>

      <div className="pair-forms">
        {item.forms.map((form, i) => (
          <Form
            key={form.key}
            lesson={lesson}
            playable={form}
            rate={rate}
            label={i === 0 ? `Play ${displayNo}` : `Play ${displayNo} with al`}
            register={register}
          />
        ))}
      </div>
    </div>
  );
}
