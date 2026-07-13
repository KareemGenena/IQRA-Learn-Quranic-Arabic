import { useMemo, useRef, useState } from 'react';
import { ArabicWord } from './ArabicWord';
import { splitClusters } from '../lib/graphemes';
import {
  audioUrl,
  playWithHighlights,
  resolveBoundaries,
  stopActivePlayback,
} from '../lib/playback';
import type { PlaybackHandle } from '../lib/playback';
import type { Lesson, WordEntry } from '../types';

interface Props {
  lesson: Lesson;
  word: WordEntry;
  rate: number;
}

export function WordCard({ lesson, word, rate }: Props) {
  const clusters = useMemo(() => splitClusters(word.arabic), [word.arabic]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const handleRef = useRef<PlaybackHandle | null>(null);

  const onClick = async () => {
    if (playing) {
      handleRef.current?.stop();
      return;
    }
    stopActivePlayback();
    setPlaying(true);
    try {
      const boundaries = await resolveBoundaries(lesson, word, clusters);
      handleRef.current = playWithHighlights(
        audioUrl(lesson, word),
        boundaries,
        setActiveIndex,
        () => {
          setPlaying(false);
          handleRef.current = null;
        },
        rate,
      );
    } catch {
      setPlaying(false);
    }
  };

  return (
    <button
      type="button"
      className={`word-card ${playing ? 'playing' : ''}`}
      onClick={onClick}
      aria-label={`Play word ${word.id}`}
    >
      <span className="word-num">{word.id}</span>
      <ArabicWord text={word.arabic} clusters={clusters} activeIndex={activeIndex} />
      <span className="play-icon" aria-hidden="true">
        {playing ? (
          <svg viewBox="0 0 24 24" width="18" height="18">
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
          </svg>
        )}
      </span>
    </button>
  );
}
