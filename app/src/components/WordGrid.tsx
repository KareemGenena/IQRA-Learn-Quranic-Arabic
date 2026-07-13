import { WordCard } from './WordCard';
import type { Lesson } from '../types';

export function WordGrid({ lesson, rate }: { lesson: Lesson; rate: number }) {
  return (
    <div className="word-grid" dir="rtl">
      {lesson.words.map((word) => (
        <WordCard key={word.id} lesson={lesson} word={word} rate={rate} />
      ))}
    </div>
  );
}
