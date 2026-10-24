/**
 * Plays a recording while reporting which letter is active, from the
 * boundary times. Only one thing plays at a time app-wide.
 *
 * THE CLOCK IS THE SOUND CARD'S (2026-10-24). A clip is decoded once into an
 * AudioBuffer and started through the Web Audio API, which schedules it to
 * the sample, and the highlight reads WHERE THE SOUND IS NOW — the smaller
 * of two clocks: `AudioContext.getOutputTimestamp()` (the frame the output
 * device is putting out at this instant; output-side in Chrome, render-side
 * in WebKit) and `currentTime − outputLatency` (the render clock corrected
 * by the latency the device reports; the one that counts on iOS and on a
 * Bluetooth route). The media element it replaces opened the device's
 * output on its own schedule (tens to hundreds of milliseconds, different
 * every time, worst on phones) and its `currentTime` ran ahead of the
 * speaker by that much; the two earlier fixes (one warm element, the loop
 * started on `playing`) narrowed the gap and could not close it. Speeds
 * other than 1× are a time-stretch of the decoded clip (WSOLA, pitch
 * unchanged, in a Worker), computed once and cached. The media element
 * remains only as a fallback for a browser with no AudioContext or a clip
 * that will not decode, and — on iOS — as the thing that keeps Web Audio
 * audible with the silent switch on: a playing media element puts the
 * page's audio session in the "playback" category, which ignores the
 * switch, and Web Audio alone does not.
 *
 * Reviewed before shipping by three agents (iOS/WebKit, clock math, state
 * machine; workflow wf_5429010c-017) — their findings are the min of the
 * two clocks, the keep-alive source, the bounded extrapolation, the end on
 * the heard clock, the render-position pause stamp, the Worker, and the
 * generation counter in usePlayable.
 */

import { speechBounds } from './audioAnalysis';
import { audibleIndices, autoBoundaries } from './timing';
import type { HighlightPhase } from './timing';
import { loadCalibration, loadCloudSnapshot } from './calibration';
import { splitClusters } from './graphemes';
import type { LetterCluster } from './graphemes';
import { getAudioBlob, getAudioSrc } from './audioSource';
import { wsola } from './wsola';
import type { Lesson, Playable } from '../types';

let activeStop: (() => void) | null = null;

// ── The context ────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let noContext = false;

function context(): AudioContext | null {
  if (noContext) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext({ latencyHint: 'interactive' });
    } catch {
      noContext = true;
      return null;
    }
  }
  return ctx;
}

/**
 * Ask the context to run. A context made outside a user gesture starts
 * suspended, and iOS leaves it 'interrupted' after a call or Siri — so this
 * is called from the first gesture (installAudioWarmup) and again,
 * synchronously, at the start of every play.
 */
export function wakeAudio(): void {
  const c = context();
  if (c && c.state !== 'running') void c.resume().catch(() => {});
}

/**
 * Keep the output stream open. Chrome parks the sink after 30 s of silence
 * and restarts it on the next sound — a quarter second in which no frame is
 * rendered, so the first word after a pause came out late and the highlight
 * ran ahead of it. An inaudible constant (never exactly zero) keeps the
 * graph "sounding" from the first gesture on; this is the same thing the
 * warm media element did for the old player.
 */
let keepAlive: ConstantSourceNode | null = null;

function keepSinkAwake(c: AudioContext): void {
  if (keepAlive) return;
  try {
    const n = c.createConstantSource();
    n.offset.value = 1e-7;
    n.connect(c.destination);
    n.start();
    keepAlive = n;
  } catch {
    /* no ConstantSourceNode — the bounded clock below covers the restart */
  }
}

// ── The media element: fallback, and iOS's audio-session key ───────────────

let element: HTMLAudioElement | null = null;

function player(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = 'auto';
  }
  return element;
}

/** A WAV of silence as a data: URL. */
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
const IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let warmed = false;

/**
 * Open the output on a user gesture: the context resumed and kept awake,
 * and the element played once with a sliver of silence — an element that
 * has played inside a gesture may be played again without one, which is
 * what lets it be used as the iOS session key later, and what lets the
 * fallback start at all. Called from the first gesture on the page and
 * from every play, so a refused first attempt is retried on the next tap.
 */
export function warmAudio(): void {
  wakeAudio();
  const c = context();
  if (c) keepSinkAwake(c);
  if (warmed) return;
  warmed = true;
  const a = player();
  a.playbackRate = 1;
  a.loop = false;
  a.src = SILENCE;
  void a.play().catch(() => {
    warmed = false; // not a gesture after all — the next one will do it
  });
}

/** Warm the output on the first gesture anywhere on the page; wake the
 *  context again when the page comes back into view, and stop whatever is
 *  playing when it goes out of view — iOS interrupts Web Audio in the
 *  background but not the media element, which would otherwise keep looping
 *  its silence in the "playback" category for as long as the page is hidden. */
export function installAudioWarmup(): () => void {
  const on = () => warmAudio();
  const onVisible = () => {
    if (document.hidden) stopActivePlayback();
    else wakeAudio();
  };
  window.addEventListener('pointerdown', on, { once: true, capture: true });
  window.addEventListener('keydown', on, { once: true, capture: true });
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('pointerdown', on, true);
    window.removeEventListener('keydown', on, true);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/** iOS only: a silent media element looping while a clip sounds keeps the
 *  audio session in the playback category, so the silent switch does not
 *  mute Web Audio. 50 ms is far below the length at which iOS would show a
 *  Now Playing card. Elsewhere this does nothing. */
function holdSession(on: boolean): void {
  if (!IOS) return;
  const a = player();
  if (on) {
    if (a.paused || a.ended || a.src !== SILENCE) {
      a.loop = true;
      a.src = SILENCE;
      void a.play().catch(() => {});
    }
  } else {
    a.loop = false;
    a.pause();
  }
}

export function stopActivePlayback(): void {
  activeStop?.();
  activeStop = null;
}

// ── Clips: decoded once, stretched per speed, both cached ──────────────────

const decoded = new Map<string, Promise<AudioBuffer>>();
const DECODED_MAX = 48; // ~0.5 MB a clip at 48 kHz; a page's worth, both readings

function decodeClip(url: string): Promise<AudioBuffer> | null {
  const c = context();
  if (!c) return null;
  let p = decoded.get(url);
  if (p) {
    // Most recently used goes to the back of the Map.
    decoded.delete(url);
    decoded.set(url, p);
    return p;
  }
  p = getAudioBlob(url)
    .then((b) => b.arrayBuffer())
    .then((ab) => c.decodeAudioData(ab));
  p.catch(() => decoded.delete(url));
  decoded.set(url, p);
  while (decoded.size > DECODED_MAX) {
    const oldest = decoded.keys().next().value;
    if (oldest === undefined) break;
    decoded.delete(oldest);
  }
  return p;
}

// The stretch runs in a Worker; where the Worker cannot be made (an older
// Safari without module workers) or dies, the rest of the session stretches
// on the main thread.
let worker: Worker | null | undefined;
let stretchId = 0;
const pendingStretch = new Map<number, { resolve: (out: Float32Array) => void; reject: (e: unknown) => void }>();

function stretchWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL('./stretch.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; out: Float32Array }>) => {
      const p = pendingStretch.get(e.data.id);
      pendingStretch.delete(e.data.id);
      p?.resolve(e.data.out);
    };
    w.onerror = (e) => {
      console.warn('stretch worker failed; stretching on the main thread', e);
      w.terminate();
      worker = null;
      for (const p of pendingStretch.values()) p.reject(e);
      pendingStretch.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

async function stretchData(x: Float32Array, sr: number, rate: number): Promise<Float32Array> {
  const w = stretchWorker();
  if (w) {
    try {
      return await new Promise<Float32Array>((resolve, reject) => {
        const id = ++stretchId;
        pendingStretch.set(id, { resolve, reject });
        const copy = x.slice(); // the AudioBuffer's own samples must not be detached
        w.postMessage({ id, data: copy, sampleRate: sr, rate }, [copy.buffer]);
      });
    } catch {
      /* the worker died — fall through */
    }
  }
  return wsola(x, sr, rate);
}

/**
 * Every clip sounds at the same level. Recording levels vary by 30 dB
 * across the corpus (peaks −32.7 … −0.3 dBFS), and the author found one
 * lesson barely audible (lesson 4, 2026-10-24). The files stay as recorded;
 * the player lifts each clip so that its 99.9th-percentile sample sits at
 * 0.9 of full scale — the percentile so that a lone click cannot hold a
 * whole clip down — within +24 dB. Computed once per decoded buffer.
 */
const gains = new WeakMap<AudioBuffer, number>();

function gainFor(buffer: AudioBuffer): number {
  const hit = gains.get(buffer);
  if (hit !== undefined) return hit;
  const x = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
  }
  let g = 1;
  if (peak > 0) {
    const bins = new Uint32Array(1024);
    for (let i = 0; i < x.length; i++) bins[Math.min(1023, Math.floor((Math.abs(x[i]) / peak) * 1023))]++;
    const allow = Math.max(1, Math.floor(x.length * 0.001));
    let above = 0;
    let b = 1023;
    for (; b > 0; b--) {
      above += bins[b];
      if (above >= allow) break;
    }
    const level = (b / 1023) * peak;
    g = Math.min(32, Math.max(0.5, 0.9 / Math.max(level, 1e-4)));
  }
  gains.set(buffer, g);
  return g;
}

const stretchedCache = new Map<string, Promise<AudioBuffer>>();
const STRETCHED_MAX = 24;

function stretched(c: AudioContext, url: string, buffer: AudioBuffer, rate: number): Promise<AudioBuffer> {
  const k = `${url}@${rate}`;
  const hit = stretchedCache.get(k);
  if (hit) return hit;
  const p = stretchData(buffer.getChannelData(0), buffer.sampleRate, rate).then((y) => {
    const b = c.createBuffer(1, y.length, buffer.sampleRate);
    b.copyToChannel(y as Float32Array<ArrayBuffer>, 0);
    return b;
  });
  p.catch(() => stretchedCache.delete(k));
  stretchedCache.set(k, p);
  while (stretchedCache.size > STRETCHED_MAX) {
    const oldest = stretchedCache.keys().next().value;
    if (oldest === undefined) break;
    stretchedCache.delete(oldest);
  }
  return p;
}

/** What the player needs for one clip at one speed: the buffer, or — when
 *  there is no context or the clip will not decode — a blob: URL for the
 *  media element. */
export interface Clip {
  buffer?: AudioBuffer;
  src?: string;
}

/**
 * Fetch, decode and (at a speed other than 1×) stretch a clip, ahead of the
 * tap. Everything is cached, so the second call for the same clip is
 * immediate and the player's own call never waits.
 */
export async function prepareClip(url: string, rate = 1): Promise<Clip> {
  const d = decodeClip(url);
  const c = context();
  if (d && c) {
    try {
      const buffer = await d;
      return { buffer: rate === 1 ? buffer : await stretched(c, url, buffer, rate) };
    } catch (err) {
      console.warn('clip did not decode; falling back to the media element', url, err);
    }
  }
  return { src: await getAudioSrc(url) };
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
 * Fetch, decode and (off 1×) stretch a playable's clip and settle its
 * timing ahead of the tap, so the first play of a card is immediate. Both
 * are cached by their own modules; a failure here is silent — the tap will
 * try again and report.
 */
export function warmPlayable(lesson: Lesson, playable: Playable, rate = 1): Promise<void> {
  const clusters = splitClusters(playable.text);
  const url = audioUrl(lesson, playable);
  return Promise.all([resolveBoundaries(lesson, playable, clusters), prepareClip(url, rate)]).then(
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
   * wants to hold it mid-card; a child wants to catch up. What matters here
   * is not calling `finish`, so the highlight and the card stay exactly
   * where they are.
   */
  pause: () => void;
  resume: () => void;
  /** Jump to a media time, e.g. the first letter of a song card. */
  seek: (time: number) => void;
  /** The media time being heard right now — the clock the highlight runs
   *  on, for the calibration page to stamp its taps against. */
  now: () => number;
}

/** One way of sounding a clip; the two engines share the highlight logic. */
interface Engine {
  start: (from: number) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  now: () => number;
  teardown: () => void;
}

/** How far the context's render clock runs ahead of the speaker, as the
 *  device reports it; 0 if unknown. */
function latencyOf(c: AudioContext): number {
  const l = c.outputLatency ?? c.baseLatency ?? 0;
  return Number.isFinite(l) && l > 0 && l < 1 ? l : 0;
}

/** A small lead so the source starts exactly at the scheduled time rather
 *  than "as soon as the render thread sees it" — the start time is then
 *  known to the sample. 30 ms is below anything the ear can notice. */
const START_LEAD = 0.03;
/** How far the heard clock may run on from the last output callback. While
 *  Chrome restarts a parked sink no callback comes for a quarter second;
 *  extrapolating through that lit the first letter before the voice. */
const MAX_EXTRAPOLATION = 0.1;

function bufferEngine(
  c: AudioContext,
  buffer: AudioBuffer,
  rate: number,
  report: (mediaTime: number) => void,
  lastBoundary: number,
  finish: () => void,
): Engine {
  let source: AudioBufferSourceNode | null = null;
  let gainNode: GainNode | null = null;
  let startedAt = 0; // context time the current source began
  let offset = 0; // media time it began from
  let pausedAt = 0;
  let raf = 0;
  let ended = false; // the render thread has finished the source
  let endedAt = 0;

  /**
   * Seconds of sound that have LEFT THE SPEAKER since the source began: the
   * smaller of the output timestamp (output-side in Chrome, render-side in
   * WebKit) and the render clock less the reported latency. No
   * extrapolation while the context is not running — a frozen stamp must
   * read as frozen.
   */
  const heard = (): number => {
    const byClock = c.currentTime - latencyOf(c);
    if (c.state !== 'running') return byClock - startedAt;
    let byStamp = Infinity;
    const ts = typeof c.getOutputTimestamp === 'function' ? c.getOutputTimestamp() : undefined;
    if (ts && typeof ts.contextTime === 'number' && typeof ts.performanceTime === 'number' && ts.contextTime > 0) {
      const since = Math.min(MAX_EXTRAPOLATION, Math.max(0, (performance.now() - ts.performanceTime) / 1000));
      byStamp = ts.contextTime + since;
    }
    return Math.min(byClock, byStamp) - startedAt;
  };
  /** Nothing before `offset` is in this source: until the sound arrives the
   *  position IS the offset, not a time before it. */
  const mediaNow = () => offset + Math.max(0, heard()) * rate;

  const tick = () => {
    const t = mediaNow();
    // Recordings can have a long silent tail; stop soon after speech ends.
    // The source's own `ended` fires on the render clock, ahead of the
    // speaker, so the end waits until that much sound has been heard.
    const sourceDone =
      ended && (heard() >= buffer.duration - offset / rate - 0.005 || performance.now() - endedAt > 1500);
    if (t >= lastBoundary + 0.25 || sourceDone) {
      finish();
      return;
    }
    report(t);
    raf = requestAnimationFrame(tick);
  };

  const stopSource = () => {
    cancelAnimationFrame(raf);
    const s = source;
    source = null;
    if (!s) return;
    s.onended = null;
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
    s.disconnect();
    gainNode?.disconnect();
    gainNode = null;
  };

  const start = (from: number) => {
    const s = c.createBufferSource();
    s.buffer = buffer;
    const g = c.createGain();
    g.gain.value = gainFor(buffer);
    s.connect(g);
    g.connect(c.destination);
    gainNode = g;
    source = s;
    ended = false;
    offset = Math.max(0, from);
    startedAt = c.currentTime + START_LEAD;
    s.onended = () => {
      if (source === s) {
        ended = true;
        endedAt = performance.now();
      }
    };
    s.start(startedAt, Math.min(offset / rate, buffer.duration));
    raf = requestAnimationFrame(tick);
  };

  return {
    start,
    pause: () => {
      if (!source) return;
      // The frames already rendered play out after stop(): the listener
      // hears up to the RENDER position, so that is where resume continues.
      pausedAt = Math.max(0, offset + Math.max(0, c.currentTime - startedAt) * rate);
      stopSource();
    },
    resume: () => {
      if (source) return;
      start(pausedAt);
    },
    seek: (time) => {
      if (source) {
        stopSource();
        start(time);
      } else {
        pausedAt = Math.max(0, time);
        report(pausedAt);
      }
    },
    now: () => (source ? mediaNow() : pausedAt),
    teardown: stopSource,
  };
}

function elementEngine(
  src: string,
  rate: number,
  report: (mediaTime: number) => void,
  lastBoundary: number,
  finish: () => void,
): Engine {
  const audio = player();
  let raf = 0;
  let startAt = 0;

  const tick = () => {
    // The element's clock already reports the position being heard.
    const t = audio.currentTime;
    if (t >= lastBoundary + 0.25) {
      finish();
      return;
    }
    report(t);
    raf = requestAnimationFrame(tick);
  };
  const onEnded = () => finish();
  const onError = () => {
    console.error('audio playback error:', audio.error?.code, audio.error?.message);
    finish();
  };
  // The loop starts when sound actually starts — the `playing` event, not
  // the play() promise, which resolves as soon as playback is permitted.
  const onPlaying = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };
  const onMeta = () => {
    if (startAt > 0) audio.currentTime = startAt;
  };

  return {
    start: (from) => {
      startAt = from;
      audio.loop = false;
      audio.src = src;
      audio.playbackRate = rate;
      audio.preservesPitch = true;
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      audio.addEventListener('playing', onPlaying);
      audio.addEventListener('loadedmetadata', onMeta);
      void audio.play().catch(finish);
    },
    pause: () => {
      cancelAnimationFrame(raf);
      audio.pause();
    },
    resume: () => void audio.play().catch(finish),
    seek: (time) => {
      audio.currentTime = Math.max(0, time);
      if (audio.paused) report(audio.currentTime);
    },
    now: () => audio.currentTime,
    teardown: () => {
      cancelAnimationFrame(raf);
      audio.pause();
      // The element is shared: this clip's listeners must not outlive it.
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('loadedmetadata', onMeta);
    },
  };
}

export function playWithHighlights(
  /** The clip's versioned URL (`audioUrl`); `prepareClip` has usually
   *  already fetched and decoded it, so the start is immediate. */
  url: string,
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
  warmAudio();

  let engine: Engine | null = null;
  let finished = false;
  let paused = false;
  const lastBoundary = boundaries[boundaries.length - 1];

  const finish = () => {
    if (finished) return;
    finished = true;
    engine?.teardown();
    engine = null;
    holdSession(false);
    onActiveLetter(null, null);
    if (activeStop === stop) activeStop = null;
    onDone();
  };
  const stop = () => finish();

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

  prepareClip(url, rate).then(
    (clip) => {
      if (finished) return;
      const c = clip.buffer ? context() : null;
      if (clip.buffer && c) {
        holdSession(true);
        engine = bufferEngine(c, clip.buffer, rate, report, lastBoundary, finish);
      } else if (clip.src) {
        engine = elementEngine(clip.src, rate, report, lastBoundary, finish);
      } else {
        finish();
        return;
      }
      // A pause that arrived before the clip was ready is honoured: the
      // engine opens at the start position, paused, instead of sounding.
      if (paused) engine.seek(startAt);
      else engine.start(startAt);
    },
    (err) => {
      console.error('playback failed:', url, err);
      finish();
    },
  );

  activeStop = stop;
  return {
    stop,
    pause: () => {
      if (finished || paused) return;
      paused = true;
      engine?.pause();
    },
    resume: () => {
      if (finished || !paused) return;
      paused = false;
      engine?.resume();
    },
    seek: (time) => {
      if (finished) return;
      engine?.seek(time);
    },
    now: () => engine?.now() ?? startAt,
  };
}
