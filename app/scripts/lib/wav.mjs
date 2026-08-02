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

  const threshold = Math.max(0.008, peak * floor);
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
