/**
 * Finds where speech starts and ends in a recording (silence trimming),
 * so automatic timings skip the quiet lead-in/tail of each file.
 * Runs once per file in the browser; results are cached in memory.
 */

import { getAudioBlob } from './audioSource';

export interface SpeechBounds {
  start: number;
  end: number;
  duration: number;
}

let ctx: AudioContext | null = null;
const cache = new Map<string, SpeechBounds>();
const pending = new Map<string, Promise<SpeechBounds>>();

const WINDOW_S = 0.01; // 10 ms RMS windows

async function analyze(url: string): Promise<SpeechBounds> {
  ctx ??= new AudioContext();
  const raw = await (await getAudioBlob(url)).arrayBuffer();
  const audio = await ctx.decodeAudioData(raw);
  const data = audio.getChannelData(0);

  const win = Math.max(1, Math.round(audio.sampleRate * WINDOW_S));
  const n = Math.floor(data.length / win);
  const rms = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i * win; j < (i + 1) * win; j++) sum += data[j] * data[j];
    const r = Math.sqrt(sum / win);
    rms[i] = r;
    if (r > peak) peak = r;
  }

  // Anything below ~6% of the loudest moment (with an absolute floor for
  // near-silent rooms) counts as silence.
  const threshold = Math.max(0.008, peak * 0.06);
  let first = 0;
  while (first < n && rms[first] < threshold) first++;
  let last = n - 1;
  while (last > first && rms[last] < threshold) last--;

  return {
    // small margins so the first/last letter isn't clipped
    start: Math.max(0, first * win / audio.sampleRate - 0.03),
    end: Math.min(audio.duration, (last + 1) * win / audio.sampleRate + 0.05),
    duration: audio.duration,
  };
}

export function speechBounds(url: string): Promise<SpeechBounds> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(url);
  if (!p) {
    p = analyze(url).then((res) => {
      cache.set(url, res);
      pending.delete(url);
      return res;
    });
    // A transient failure must not stay cached, or the word stays broken
    // until the page reloads.
    p.catch(() => pending.delete(url));
    pending.set(url, p);
  }
  return p;
}
