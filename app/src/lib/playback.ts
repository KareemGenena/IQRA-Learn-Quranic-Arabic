/**
 * Plays a recording while reporting which letter is active, from the
 * boundary times. Only one thing plays at a time app-wide.
 */

import { speechBounds } from './audioAnalysis';
import { audibleIndices, autoBoundaries } from './timing';
import { loadCalibration, loadCloudSnapshot } from './calibration';
import type { LetterCluster } from './graphemes';
import type { Lesson, Playable } from '../types';

let activeStop: (() => void) | null = null;

export function stopActivePlayback(): void {
  activeStop?.();
  activeStop = null;
}

export function audioUrl(lesson: Lesson, playable: Playable): string {
  return `${import.meta.env.BASE_URL}${lesson.audioPath}${playable.audio}`;
}

/**
 * Boundary times for a playable, best source first:
 * this device's calibration > cloud calibration > baked timings > automatic.
 * Length is always (audible letters + 1); anything of the wrong length is
 * ignored so a stale calibration can't desync the highlighting.
 */
export async function resolveBoundaries(
  lesson: Lesson,
  playable: Playable,
  clusters: LetterCluster[],
): Promise<number[]> {
  const expected = audibleIndices(clusters, playable.silentClusters).length + 1;

  const own = loadCalibration(lesson.lesson)[playable.key];
  if (own?.length === expected) return own;

  const cloud = loadCloudSnapshot(lesson.lesson)[playable.key];
  if (cloud?.length === expected) return cloud;

  if (playable.timings?.length === expected) return playable.timings;

  const bounds = await speechBounds(audioUrl(lesson, playable));
  return autoBoundaries(clusters, bounds.start, bounds.end, playable.silentClusters);
}

export interface PlaybackHandle {
  stop: () => void;
}

export function playWithHighlights(
  src: string,
  boundaries: number[],
  /** Receives the CLUSTER index to highlight (silent letters are skipped). */
  onActiveLetter: (index: number | null) => void,
  onDone: () => void,
  rate = 1,
  /** Maps boundary index → cluster index. Identity when nothing is silent. */
  indexMap?: number[],
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
      let i = 0;
      while (i < boundaries.length - 2 && t >= boundaries[i + 1]) i++;
      onActiveLetter(indexMap ? indexMap[i] : i);
    }
    rafId = requestAnimationFrame(tick);
  };

  audio.addEventListener('ended', finish);
  audio.addEventListener('error', () => {
    console.error('audio playback error:', audio.error?.code, audio.error?.message);
    finish();
  });
  void audio
    .play()
    .then(() => {
      rafId = requestAnimationFrame(tick);
    })
    .catch(finish);

  activeStop = stop;
  return { stop };
}
