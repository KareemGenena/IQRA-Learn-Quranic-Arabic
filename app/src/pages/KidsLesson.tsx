import { SectionedLesson } from './SectionedLesson';
import { LetterCard } from '../components/LetterCard';
import { PlaceCard } from '../components/PlaceCard';
import { SongCards } from '../components/SongCards';
import type { Lesson, LetterWord } from '../types';

/**
 * A lesson in the kids skin — reached at #/kids/lesson/N.
 *
 * Same lesson data, same number, same clips and calibrations as #/lesson/N;
 * only the clothes differ. A song is a strip of letters; the places page is a
 * diagram per card; anything else is the ordinary paged lesson with the
 * letter card swapped in, so paging, the remembered place and the single-key
 * walk are not written twice.
 */
export function KidsLesson({ lesson, rate }: { lesson: Lesson; rate: number }) {
  // Keyed by lesson: going from one song straight to the other must not carry
  // the first song's place along — React would otherwise keep the instance.
  if (lesson.song) return <SongCards key={lesson.lesson} lesson={lesson} rate={rate} />;
  const places = (lesson.words as LetterWord[]).some((w) => w.place);
  return <SectionedLesson key={lesson.lesson} lesson={lesson} rate={rate} Card={places ? PlaceCard : LetterCard} />;
}
