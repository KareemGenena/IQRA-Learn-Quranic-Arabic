/**
 * Plays a recording while reporting which letter is active, from the
 * boundary times. Only one thing plays at a time app-wide.
 */

import { speechBounds } from './audioAnalysis';
import { audibleIndices, autoBoundaries } from './timing';
import type { HighlightPhase } from './timing';
import { loadCalibration, loadCloudSnapshot } from './calibration';
import type { LetterCluster } from './graphemes';
import type { Lesson, Playable } from '../types';

let activeStop: (() => void) | null = null;

export function stopActivePlayback(): void {
  activeStop?.();
  activeStop = null;
}

/**
 * The clip's URL, versioned. Filenames are stable across a re-cut, so the
 * version is what tells the browser's HTTP cache, the CDN and the worker's
 * runtime cache that this is a different file — see AUDIO_VERSION in
 * vite.config.ts. Everything that fetches a clip must go through here.
 */
export function audioUrl(lesson: Lesson, playable: Playable): string {
  return `${import.meta.env.BASE_URL}${lesson.audioPath}${playable.audio}?v=${__AUDIO_VERSION__}`;
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
  return autoBoundaries(clusters, bounds.start, bounds.end, playable.silentClusters, {
    letterNames: playable.letterNames,
    waqf: playable.waqf,
    waqfMadd: playable.waqfMadd,
  });
}

export interface PlaybackHandle {
  stop: () => void;
  /**
   * Pause and resume, for the songs and the spoken lines.
   *
   * Every word in the adult lessons is a couple of seconds long, so "stop and
   * play again" was always enough. A song is a minute long and a teacher
   * wants to hold it mid-card; a child wants to catch up. The element pauses
   * natively — what matters here is not calling `finish`, so the highlight
   * and the card stay exactly where they are.
   */
  pause: () => void;
  resume: () => void;
  /** Jump to a media time, e.g. the first letter of a song card. */
  seek: (time: number) => void;
}

export function playWithHighlights(
  src: string,
  boundaries: number[],
  /** Receives the CLUSTER index to highlight (silent letters are skipped),
   *  and whether the moment is the hum before that letter or the letter. */
  onActiveLetter: (index: number | null, phase: HighlightPhase) => void,
  onDone: () => void,
  rate = 1,
  /** Maps boundary index → cluster index. Identity when nothing is silent. */
  indexMap?: number[],
  /** Per boundary index, the share of the letter's time that is ghunna (see
   *  `ghunnaShares`). Omitted: no letter has a hum phase. */
  ghunnaShares?: number[],
  /** Begin part-way through — a song resumed at the card the teacher chose. */
  startAt = 0,
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
  let paused = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    audio.pause();
    onActiveLetter(null, null);
    if (activeStop === stop) activeStop = null;
    onDone();
  };

  const stop = () => finish();

  const lastBoundary = boundaries[boundaries.length - 1];

  /** What the highlight should show at media time t. */
  const report = (t: number) => {
    if (t < boundaries[0] || t >= lastBoundary) {
      onActiveLetter(null, null);
      return;
    }
    let i = 0;
    while (i < boundaries.length - 2 && t >= boundaries[i + 1]) i++;
    // The hum opens the letter: the first `share` of its span is ghunna.
    const share = ghunnaShares?.[i] ?? 0;
    const hum = share > 0 && t < boundaries[i] + share * (boundaries[i + 1] - boundaries[i]);
    onActiveLetter(indexMap ? indexMap[i] : i, hum ? 'ghunna' : null);
  };

  const tick = () => {
    const t = audio.currentTime;
    // Recordings can have a long silent tail; stop soon after speech ends.
    if (t >= lastBoundary + 0.25) {
      finish();
      return;
    }
    report(t);
    rafId = requestAnimationFrame(tick);
  };

  const pause = () => {
    if (finished || paused) return;
    paused = true;
    cancelAnimationFrame(rafId);
    audio.pause();
  };

  const resume = () => {
    if (finished || !paused) return;
    paused = false;
    void audio
      .play()
      .then(() => {
        rafId = requestAnimationFrame(tick);
      })
      .catch(finish);
  };

  // While paused the frame loop is not running, so the highlight is brought
  // up to date by hand — otherwise the old card would sit there until play.
  const seek = (time: number) => {
    if (finished) return;
    audio.currentTime = Math.max(0, time);
    if (paused) report(audio.currentTime);
  };

  audio.addEventListener('ended', finish);
  audio.addEventListener('error', () => {
    console.error('audio playback error:', audio.error?.code, audio.error?.message);
    finish();
  });
  if (startAt > 0) audio.currentTime = startAt;
  void audio
    .play()
    .then(() => {
      rafId = requestAnimationFrame(tick);
    })
    .catch(finish);

  activeStop = stop;
  return { stop, pause, resume, seek };
}
