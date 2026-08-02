import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArabicWord } from './ArabicWord';
import { PlayIcon } from './PlayIcon';
import { usePlayable } from '../lib/usePlayable';
import { barePlayable, withAlPlayable } from '../lib/lessons';
import type { Lesson, PairWord, Playable } from '../types';

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
      />
      <PlayIcon playing={playing} />
    </button>
  );
}

interface Props {
  lesson: Lesson;
  word: PairWord;
  rate: number;
  /** Display number on the card — matches the position on screen. */
  displayNo: number;
  register?: (key: string, play: () => Promise<void>) => void;
  /** Hide the type badge (used in the quiz, where the learner must decide). */
  hideType?: boolean;
}

/** Broadcast so at most one meaning is open at a time. */
const TIP_EVENT = 'iqra-meaning-open';

export function PairCard({ lesson, word, rate, displayNo, register, hideType }: Props) {
  const [showMeaning, setShowMeaning] = useState(false);
  const tipId = useId();
  const headRef = useRef<HTMLDivElement>(null);
  const bare = useMemo(() => barePlayable(word), [word]);
  const withAl = useMemo(() => withAlPlayable(word), [word]);

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
    <div className={`pair-card ${word.type}`}>
      <div className="pair-head" ref={headRef}>
        <span className="word-num">{displayNo}</span>
        {!hideType && (
          <span className="type-badge">{word.type === 'shamsiyya' ? 'Sun ش' : 'Moon ق'}</span>
        )}
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
          {word.meaning}
        </span>
      </div>

      <div className="pair-forms">
        <Form
          lesson={lesson}
          playable={bare}
          rate={rate}
          label={`Play ${displayNo}`}
          register={register}
        />
        <Form
          lesson={lesson}
          playable={withAl}
          rate={rate}
          label={`Play ${displayNo} with al`}
          register={register}
        />
      </div>
    </div>
  );
}
