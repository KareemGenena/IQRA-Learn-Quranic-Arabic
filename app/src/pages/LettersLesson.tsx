import { SectionedLesson } from './SectionedLesson';
import { LetterCard } from '../components/LetterCard';
import { PlaceCard } from '../components/PlaceCard';
import { SongCards } from '../components/SongCards';
import type { Lesson, LetterWord } from '../types';

/**
 * A `letters` lesson — the Level 1 lessons, built for the Maktab's youngest
 * class and read by everyone (Design/iqra-kids.md).
 *
 * Chosen by the lesson's kind, never by a route: until 2026-10-11 these were
 * reached at #/kids/lesson/N in a "kids skin", and #/lesson/N drew them as
 * plain word cards. Same number, same clips, same calibrations either way. A
 * song is a strip of letters; the places page is a diagram per card; anything
 * else is the ordinary paged lesson with the letter card swapped in, so
 * paging, the remembered place and the single-key walk are not written twice.
 */
export function LettersLesson({ lesson, rate }: { lesson: Lesson; rate: number }) {
  // Keyed by lesson: going from one song straight to the other must not carry
  // the first song's place along — React would otherwise keep the instance.
  if (lesson.song) return <SongCards key={lesson.lesson} lesson={lesson} rate={rate} />;
  const places = (lesson.words as LetterWord[]).some((w) => w.place);
  return <SectionedLesson key={lesson.lesson} lesson={lesson} rate={rate} Card={places ? PlaceCard : LetterCard} />;
}
