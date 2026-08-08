/** Minimal 16-bit PCM WAV reading, speech-segment detection, and writing. */

import { readFileSync, writeFileSync } from 'fs';

export function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`not a WAV file: ${path}`);
  }
  let channels, sampleRate, bitsPerSample, dataStart, dataLen;
  for (let p = 12; p + 8 <= buf.length; ) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(p + 10);
      sampleRate = buf.readUInt32LE(p + 12);
      bitsPerSample = buf.readUInt16LE(p + 22);
    } else if (id === 'data') {
      dataStart = p + 8;
      dataLen = Math.min(size, buf.length - dataStart);
      break;
    }
    p += 8 + size + (size % 2); // chunks are word-aligned
  }
  if (dataStart === undefined) throw new Error(`no data chunk: ${path}`);
  if (bitsPerSample !== 16) throw new Error(`only 16-bit WAV supported (got ${bitsPerSample}): ${path}`);

  const bytesPerFrame = (bitsPerSample / 8) * channels;
  return {
    buf,
    channels,
    sampleRate,
    bitsPerSample,
    bytesPerFrame,
    dataStart,
    frames: Math.floor(dataLen / bytesPerFrame),
  };
}

/**
 * Frame ranges of speech, split on silences of at least `gap` seconds.
 * Returns { segments, dropped } — dropped are sub-`min` blips (breaths,
 * clicks) that are reported rather than silently discarded.
 */
export function findSegments(wav, { gap = 0.6, pad = 0.15, floor = 0.06, min = 0.35 } = {}) {
  const { buf, dataStart, bytesPerFrame, sampleRate, frames } = wav;
  const winFrames = Math.max(1, Math.round(sampleRate * 0.01)); // 10 ms
  const windows = Math.floor(frames / winFrames);

  const rms = new Float64Array(windows);
  let peak = 0;
  for (let w = 0; w < windows; w++) {
    let sum = 0;
    for (let f = w * winFrames; f < (w + 1) * winFrames; f++) {
      const v = buf.readInt16LE(dataStart + f * bytesPerFrame) / 32768;
      sum += v * v;
    }
    const r = Math.sqrt(sum / winFrames);
    rms[w] = r;
    if (r > peak) peak = r;
  }

  // The threshold has to adapt to how hot the take was recorded: a fixed
  // floor that suits a loud session swallows a quiet one whole. Take the
  // room tone from a low percentile of the windows and sit safely above it,
  // but never below a share of the peak.
  const sorted = Float64Array.from(rms).sort();
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] || 0;
  const threshold = Math.max(noiseFloor * 3.5, peak * floor, 0.0008);
  const gapWindows = Math.round(gap / 0.01);
  const regions = [];
  let startW = null;
  let quiet = 0;
  for (let w = 0; w < windows; w++) {
    if (rms[w] >= threshold) {
      if (startW === null) startW = w;
      quiet = 0;
    } else if (startW !== null && ++quiet >= gapWindows) {
      regions.push([startW, w - quiet + 1]);
      startW = null;
      quiet = 0;
    }
  }
  if (startW !== null) regions.push([startW, windows]);

  const minWindows = Math.round(min / 0.01);
  const padWindows = Math.round(pad / 0.01);
  const toFrames = ([a, b]) => [
    Math.max(0, a - padWindows) * winFrames,
    Math.min(windows, b + padWindows) * winFrames,
  ];

  return {
    segments: regions.filter(([a, b]) => b - a >= minWindows).map(toFrames),
    dropped: regions.filter(([a, b]) => b - a < minWindows).map(toFrames),
  };
}

/** RMS per 10 ms window, plus the peak and an adaptive silence threshold. */
function profile(wav, floor = 0.06) {
  const { buf, dataStart, bytesPerFrame, sampleRate, frames } = wav;
  const win = Math.max(1, Math.round(sampleRate * 0.01));
  const n = Math.floor(frames / win);
  const rms = new Float64Array(n);
  let peak = 0;
  for (let w = 0; w < n; w++) {
    let sum = 0;
    for (let f = w * win; f < (w + 1) * win; f++) {
      const v = buf.readInt16LE(dataStart + f * bytesPerFrame) / 32768;
      sum += v * v;
    }
    rms[w] = Math.sqrt(sum / win);
    if (rms[w] > peak) peak = rms[w];
  }
  const sorted = Float64Array.from(rms).sort();
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] || 0;
  return { rms, peak, win, threshold: Math.max(noiseFloor * 3.5, peak * floor, 0.0008) };
}

/**
 * Split a take into EXACTLY `count` pieces by cutting at the `count - 1`
 * longest internal silences.
 *
 * This beats a fixed silence threshold when the pauses are uneven — a take
 * where the speaker left 0.3s in one place and 0.8s in another has no single
 * gap length that yields the right number of words. Knowing how many words
 * the take should contain turns an unreliable guess into a ranking problem.
 */
export function splitIntoN(wav, count, { pad = 0.12, floor = 0.06, minRun = 0.15 } = {}) {
  const { rms, win, threshold } = profile(wav, floor);
  const n = rms.length;

  // 1. Runs of sound, discarding brief clicks and breaths. A stray 0.3s blip
  //    at the top of a take would otherwise both look like a word and steal a
  //    cut, leaving two real words fused together.
  let runs = [];
  let start = -1;
  for (let w = 0; w <= n; w++) {
    const loud = w < n && rms[w] >= threshold;
    if (loud && start === -1) start = w;
    else if (!loud && start !== -1) {
      runs.push([start, w]);
      start = -1;
    }
  }
  //    Momentary dips inside a word — between an opening consonant and the
  //    vowel that follows it — are not real gaps, so glue anything separated
  //    by less than a breath back together first. Without this the quiet م of
  //    مُخۡلِصِينَ looks like a click of its own and the word loses its head.
  const joinW = Math.round(0.12 / 0.01);
  const joined = [];
  for (const r of runs) {
    const last = joined[joined.length - 1];
    if (last && r[0] - last[1] < joinW) last[1] = r[1];
    else joined.push([...r]);
  }
  runs = joined;

  //    Only now decide what is a click: a whole sound that is short compared
  //    with the others AND stands on its own. Judging the pieces before
  //    gluing them would let a burst of taps pose as a word.
  if (runs.length > 1) {
    const lens = runs.map(([a, b]) => b - a).sort((x, y) => x - y);
    const median = lens[Math.floor(lens.length / 2)];
    const minRunW = Math.max(Math.round(minRun / 0.01), median * 0.35);
    const kept = runs.filter(([a, b]) => b - a >= minRunW);
    if (kept.length >= 1) runs = kept;
  }

  // 2. Too many pieces: fuse the pair separated by the shortest silence,
  //    repeatedly, until the count is right.
  while (runs.length > count) {
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i < runs.length - 1; i++) {
      const g = runs[i + 1][0] - runs[i][1];
      if (g < bestGap) {
        bestGap = g;
        best = i;
      }
    }
    runs.splice(best, 2, [runs[best][0], runs[best + 1][1]]);
  }

  // 3. Too few: two words were said with no real pause between them. Split
  //    the longest run at its quietest interior moment and try again.
  while (runs.length < count) {
    let longest = 0;
    for (let i = 1; i < runs.length; i++) {
      if (runs[i][1] - runs[i][0] > runs[longest][1] - runs[longest][0]) longest = i;
    }
    const [a, b] = runs[longest];
    const margin = Math.max(1, Math.round((b - a) * 0.2)); // never cut at the edges
    let quietest = -1;
    let quietestRms = Infinity;
    for (let w = a + margin; w < b - margin; w++) {
      if (rms[w] < quietestRms) {
        quietestRms = rms[w];
        quietest = w;
      }
    }
    if (quietest < 0) break; // nothing splittable — report what we have
    runs.splice(longest, 1, [a, quietest], [quietest + 1, b]);
  }

  const padW = Math.round(pad / 0.01);
  const segments = runs.map(([a, b]) => [
    Math.max(0, a - padW) * win,
    Math.min(n, b + padW) * win,
  ]);
  const durations = segments.map(([a, b]) => (b - a) / wav.sampleRate);
  return {
    segments,
    durations,
    /** True when the pieces are suspiciously uneven — worth a listen. */
    suspicious: durations.length > 1 && Math.max(...durations) > Math.min(...durations) * 3,
  };
}

/**
 * Writes frames [from, to) of `wav` as a new WAV file.
 * `mono` averages the channels — these are single-voice recordings, so it
 * halves the file with no audible difference, which matters a lot when the
 * whole lesson is precached for offline use.
 */
export function writeSegment(wav, from, to, outPath, { mono = false } = {}) {
  const { buf, channels, sampleRate, bitsPerSample, bytesPerFrame, dataStart } = wav;
  const outChannels = mono ? 1 : channels;
  const outFrameBytes = (bitsPerSample / 8) * outChannels;
  const frames = to - from;
  const bytes = frames * outFrameBytes;

  const out = Buffer.alloc(44 + bytes);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + bytes, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(outChannels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * outFrameBytes, 28);
  out.writeUInt16LE(outFrameBytes, 32);
  out.writeUInt16LE(bitsPerSample, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(bytes, 40);

  if (outChannels === channels) {
    buf.copy(out, 44, dataStart + from * bytesPerFrame, dataStart + to * bytesPerFrame);
  } else {
    for (let f = 0; f < frames; f++) {
      const src = dataStart + (from + f) * bytesPerFrame;
      let sum = 0;
      for (let c = 0; c < channels; c++) sum += buf.readInt16LE(src + c * 2);
      out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sum / channels))), 44 + f * 2);
    }
  }
  writeFileSync(outPath, out);
}
