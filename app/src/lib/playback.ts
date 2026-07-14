/**
 * Plays a word's audio while reporting which letter is active, based on the
 * boundary times. Only one word plays at a time app-wide.
 */

import { speechBounds } from './audioAnalysis';
import { autoBoundaries } from './timing';
import { loadCalibration } from './calibration';
import type { LetterCluster } from './graphemes';
import type { Lesson, WordEntry } from '../types';

let activeStop: (() => void) | null = null;

export function stopActivePlayback(): void {
  activeStop?.();
  activeStop = null;
}

export function audioUrl(lesson: Lesson, word: WordEntry): string {
  return `${import.meta.env.BASE_URL}${lesson.audioPath}${word.audio}`;
}

/**
 * Boundary times for a word, best source first:
 * user calibration (localStorage) > words.json timings > automatic estimate.
 */
export async function resolveBoundaries(
  lesson: Lesson,
  word: WordEntry,
  clusters: LetterCluster[],
): Promise<number[]> {
  const expected = clusters.length + 1;

  const calibrated = loadCalibration(lesson.lesson)[word.id];
  if (calibrated?.length === expected) return calibrated;

  if (word.timings?.length === expected) return word.timings;

  const bounds = await speechBounds(audioUrl(lesson, word));
  return autoBoundaries(clusters, bounds.start, bounds.end);
}

export interface PlaybackHandle {
  stop: () => void;
}

export function playWithHighlights(
  src: string,
  boundaries: number[],
  onActiveLetter: (index: number | null) => void,
  onDone: () => void,
  rate = 1,
): PlaybackHandle {
  stopActivePlayback();

  // src should be a blob: URL from getAudioSrc — never the raw file URL,
  // which would stream through the service worker (see audioSource.ts).
  const audio = new Audio(src);
  // Boundaries are in media time and audio.currentTime advances in media
  // time whatever the rate, so highlights stay in sync at any speed.
  audio.playbackRate = rate;
  audio.preservesPitch = true;
  let rafId = 0;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    audio.pause();
    onActiveLetter(null);
    if (activeStop === stop) activeStop = null;
    onDone();
  };

  const stop = () => finish();

  const lastBoundary = boundaries[boundaries.length - 1];
  const tick = () => {
    const t = audio.currentTime;
    // Recordings can have a long silent tail; stop soon after speech ends.
    if (t >= lastBoundary + 0.25) {
      finish();
      return;
    }
    if (t < boundaries[0] || t >= lastBoundary) {
      onActiveLetter(null);
    } else {
      let idx = 0;
      while (idx < boundaries.length - 2 && t >= boundaries[idx + 1]) idx++;
      onActiveLetter(idx);
    }
    rafId = requestAnimationFrame(tick);
  };

  audio.addEventListener('ended', finish);
  audio.addEventListener('error', () => {
    console.error('audio playback error:', audio.error?.code, audio.error?.message);
    finish();
  });
  void audio.play().then(() => {
    rafId = requestAnimationFrame(tick);
  }).catch(finish);

  activeStop = stop;
  return { stop };
}
