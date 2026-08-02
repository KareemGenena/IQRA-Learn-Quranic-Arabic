import { useMemo } from 'react';
import { ArabicWord } from './ArabicWord';
import { PlayIcon } from './PlayIcon';
import { usePlayable } from '../lib/usePlayable';
import { simplePlayable } from '../lib/lessons';
import type { Lesson, SimpleWord } from '../types';

interface Props {
  lesson: Lesson;
  word: SimpleWord;
  rate: number;
}

export function WordCard({ lesson, word, rate }: Props) {
  const playable = useMemo(() => simplePlayable(word), [word]);
  const { clusters, activeIndex, playing, toggle } = usePlayable(lesson, playable, rate);

  return (
    <button
      type="button"
      className={`word-card ${playing ? 'playing' : ''}`}
      onClick={() => void toggle()}
      aria-label={`Play ${word.id}`}
    >
      <span className="word-num">{word.id}</span>
      <ArabicWord text={word.arabic} clusters={clusters} activeIndex={activeIndex} />
      <PlayIcon playing={playing} />
    </button>
  );
}
