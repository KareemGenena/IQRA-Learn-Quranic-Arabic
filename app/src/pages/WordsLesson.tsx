import { WordCard } from '../components/WordCard';
import type { Lesson, SimpleWord } from '../types';

export function WordsLesson({ lesson, rate }: { lesson: Lesson; rate: number }) {
  return (
    <div className="word-grid" dir="rtl">
      {(lesson.words as SimpleWord[]).map((word) => (
        <WordCard key={word.id} lesson={lesson} word={word} rate={rate} />
      ))}
    </div>
  );
}
