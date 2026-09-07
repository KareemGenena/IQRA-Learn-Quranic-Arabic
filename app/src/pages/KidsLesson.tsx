import { SectionedLesson } from './SectionedLesson';
import { LetterCard } from '../components/LetterCard';
import { SongCards } from '../components/SongCards';
import type { Lesson } from '../types';

/**
 * A lesson in the kids skin — reached at #/kids/lesson/N.
 *
 * Same lesson data, same number, same clips and calibrations as #/lesson/N;
 * only the clothes differ. A song is a run of cards; anything else is the
 * ordinary paged lesson with the letter card swapped in, so paging, the
 * remembered place and the single-key walk are not written twice.
 */
export function KidsLesson({ lesson, rate }: { lesson: Lesson; rate: number }) {
  if (lesson.song) return <SongCards lesson={lesson} rate={rate} />;
  return <SectionedLesson lesson={lesson} rate={rate} Card={LetterCard} />;
}
