import { ItemCard } from '../components/ItemCard';
import { simplePlayable } from '../lib/lessons';
import type { Lesson, LessonItem, Reading, SimpleWord } from '../types';

/**
 * Lesson 1: a plain grid of one-word cards. The same card as every other
 * lesson, so it carries the two readings like the rest — it had a card of
 * its own until 2026-10-11, and so had no switch and no chip. No paging and
 * no keyboard walk: an open gap, not a decision.
 */
export function WordsLesson({ lesson, rate, reading }: { lesson: Lesson; rate: number; reading?: Reading }) {
  const items: LessonItem[] = (lesson.words as SimpleWord[]).map((w) => ({
    id: w.id,
    section: 'words',
    badges: [],
    forms: [simplePlayable(w)],
  }));
  return (
    <main className="pairs-lesson">
      <div className="pair-grid">
        {items.map((item, i) => (
          <ItemCard key={item.id} lesson={lesson} item={item} rate={rate} displayNo={i + 1} reading={reading} />
        ))}
      </div>
    </main>
  );
}

