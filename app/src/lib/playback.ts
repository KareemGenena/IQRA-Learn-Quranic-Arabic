/**
 * Plays a recording while reporting which letter is active, from the
 * boundary times. Only one thing plays at a time app-wide.
 */

import { speechBounds } from './audioAnalysis';
import { audibleIndices, autoBoundaries } from './timing';
import type { HighlightPhase } from './timing';
import { loadCalibration, loadCloudSnapshot } from './calibration';
import { splitClusters } from './graphemes';
import type { LetterCluster } from './graphemes';
import { getAudioSrc } from './audioSource';
import type { Lesson, Playable } from '../types';

let activeStop: (() => void) | null = null;

/**
 * ONE audio element for every clip, kept warm.
 *
 * The first clip of a session used to come out late and short, and the
 * second click put it right. A fresh element has to open the device's
 * output, and until it is open the element's clock runs ahead of the sound
 * actually leaving the speaker: the highlight led the voice, and the tick —
 * which ends a clip a quarter second after its last boundary BY THAT CLOCK —
 * cut the tail off, or for a short clip nearly all of it. So (1) the element
 * is reused, which keeps the output open from one clip to the next; (2) it is
 * opened on the page's first tap or key with a sliver of silence, before any
 * Play; and (3) the clock is read back by the output latency the device
 * reports, for the highlight and the cut-off alike. The player must never go
 * back to `new Audio()` per clip (2026-10-12).
 */
let element: HTMLAudioElement | null = null;

function player(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = 'auto';
  }
  return element;
}

/** A WAV of silence as a data: URL — the sliver that opens the output. */
function silentWav(seconds: number): string {
  const rate = 8000;
  const n = Math.round(rate * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

const SILENCE = silentWav(0.05);
let warmed = false;

/** Open the output. Needs a user gesture (autoplay policy), so it is called
 *  from the page's first pointerdown or keydown. */
export function warmAudio(): void {
  if (warmed) return;
  warmed = true;
  const a = player();
  a.playbackRate = 1;
  a.src = SILENCE;
  void a.play().catch(() => {
    warmed = false; // not a gesture after all — the next one will do it
  });
}

/** Warm the output on the first gesture anywhere on the page. */
export function installAudioWarmup(): () => void {
  const on = () => warmAudio();
  window.addEventListener('pointerdown', on, { once: true, capture: true });
  window.addEventListener('keydown', on, { once: true, capture: true });
  return () => {
    window.removeEventListener('pointerdown', on, true);
    window.removeEventListener('keydown', on, true);
  };
}

let latencyCtx: AudioContext | null = null;

/** How far the element's clock leads the speaker, as the device reports it
 *  (Chrome's `outputLatency`; `baseLatency` elsewhere; 0 when unknown). */
export function outputLatency(): number {
  try {
    latencyCtx ??= new AudioContext();
    const l = latencyCtx.outputLatency ?? latencyCtx.baseLatency ?? 0;
    return Number.isFinite(l) && l > 0 && l < 1 ? l : 0;
  } catch {
    return 0;
  }
}

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

/**
 * Fetch a playable's clip and settle its timing ahead of the tap, so the
 * first play of a card is immediate. Both are cached by their own modules;
 * a failure here is silent — the tap will try again and report.
 */
export function warmPlayable(lesson: Lesson, playable: Playable): Promise<void> {
  const clusters = splitClusters(playable.text);
  return Promise.all([resolveBoundaries(lesson, playable, clusters), getAudioSrc(audioUrl(lesson, playable))]).then(
    () => undefined,
    () => undefined,
  );
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
  const audio = player();
  audio.src = src;
  const latency = outputLatency();
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
    // The element is shared: this clip's listeners must not outlive it.
    audio.removeEventListener('ended', onEnded);
    audio.removeEventListener('error', onError);
    audio.removeEventListener('playing', onPlaying);
    audio.removeEventListener('loadedmetadata', onMeta);
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
    // What the ear hears now, not what the element has already sent.
    const t = audio.currentTime - latency;
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
    // `playing` restarts the loop once sound is moving again.
    void audio.play().catch(finish);
  };

  // While paused the frame loop is not running, so the highlight is brought
  // up to date by hand — otherwise the old card would sit there until play.
  const seek = (time: number) => {
    if (finished) return;
    audio.currentTime = Math.max(0, time);
    if (paused) report(audio.currentTime);
  };

  const onEnded = () => finish();
  const onError = () => {
    console.error('audio playback error:', audio.error?.code, audio.error?.message);
    finish();
  };
  // The loop starts when sound actually starts — the `playing` event, not
  // the play() promise, which resolves as soon as playback is permitted.
  const onPlaying = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  };
  // A new src is loaded afresh; the start offset waits for its metadata.
  const onMeta = () => {
    if (startAt > 0) audio.currentTime = startAt;
  };
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('error', onError);
  audio.addEventListener('playing', onPlaying);
  audio.addEventListener('loadedmetadata', onMeta);
  void audio.play().catch(finish);

  activeStop = stop;
  return { stop, pause, resume, seek };
}
