/** Minimal 16-bit PCM WAV reading, speech-segment detection, and writing. */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

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
    /** Named, so an edge decision in `splitIntoN` can say which take. */
    path,
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
  const { rms, win, threshold, peak } = profile(wav, floor);
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
  //    A click is short in ABSOLUTE terms — a few hundredths of a second.
  //    Anything longer is speech, however quiet: the وَ of وَٱلتَّكَاثُرُ lasts a
  //    quarter of a second behind a stop closure, and the م of مُخۡلِصِينَ about
  //    a fifth. Measuring "short" against the other pieces, as this once did,
  //    threw those away and beheaded the word.
  const tickW = Math.round(0.08 / 0.01);
  //    The runs before the tick filter are kept: the release of a final stop
  //    consonant is shorter than a tick, and (C) below puts it back.
  const raw = runs;
  const kept = runs.filter(([a, b]) => b - a >= tickW);
  if (kept.length >= 1) runs = kept;

  const partedW = Math.round(0.25 / 0.01);
  const maxRms = ([a, b]) => {
    let m = 0;
    for (let w = a; w < b; w++) if (rms[w] > m) m = rms[w];
    return m;
  };
  const t = (w) => ((w * win) / wav.sampleRate).toFixed(2);
  const name = wav.path ? basename(wav.path) : 'take';
  // Every edge decision is reported, the way a sheet correction is, so the
  // author can listen to exactly the takes that moved.
  const say = (what) => console.log(`    edge · ${name}: ${what}`);

  //    (A) The record click. Pressing record leaves a thump in the first
  //    tenths of nearly every take (341 of lesson 7's 352), up to as loud as
  //    the voice itself. The stray rule below judges an edge run against the
  //    median kept run — and a stop reading's closures break the word into
  //    short runs, so the median collapses and the thump passes as a word,
  //    kept together with a second of silence: the clip's sound started a
  //    second after its highlight (22 stop clips, 5 published lesson-3
  //    clips; 2026-10-20). A thump is known by WHERE it is, not how loud it
  //    is: it starts inside the first 0.30 s, spans at most 0.50 s (its
  //    pieces chained when parted by ≤ 0.25 s), and is parted from the voice
  //    by more than a quarter second — and dropping it must still leave
  //    `count` runs. No take in the corpus has a real word there; the intake
  //    page tells the speaker to wait a beat after the click.
  if (runs.length > count && runs[0][0] < Math.round(0.3 / 0.01)) {
    let g = 0;
    while (g + 1 < runs.length && runs[g + 1][0] - runs[g][1] <= partedW) g++;
    if (
      g + 1 < runs.length &&
      runs.length - (g + 1) >= count &&
      runs[g][1] - runs[0][0] <= Math.round(0.5 / 0.01) &&
      runs[g + 1][0] - runs[g][1] > partedW
    ) {
      say(
        `record click ${t(runs[0][0])}–${t(runs[g][1])} s dropped (${(maxRms([runs[0][0], runs[g][1]]) / peak).toFixed(2)} of peak); the voice begins at ${t(runs[g + 1][0])} s`,
      );
      runs = runs.slice(g + 1);
    }
  }

  //    A breath or a chair creak at the very top or tail of a take is longer
  //    than a click but still not a word. Trim those from the EDGES only,
  //    and only when a real silence separates them from the content — which
  //    is what keeps this from eating the وَ of وَٱلتَّكَاثُرُ, since that sits in
  //    the middle of the take with the rest of its word right behind it.
  if (runs.length > count) {
    const lens = runs.map(([a, b]) => b - a).sort((x, y) => x - y);
    const median = lens[Math.floor(lens.length / 2)];
    const strayW = median * 0.4;
    while (
      runs.length > count &&
      runs[0][1] - runs[0][0] < strayW &&
      runs[1][0] - runs[0][1] > partedW
    ) {
      say(`stray head ${t(runs[0][0])}–${t(runs[0][1])} s dropped (${(maxRms(runs[0]) / peak).toFixed(2)} of peak)`);
      runs.shift();
    }
    //    (B) A tail is a stray only when it is QUIET. A loud final syllable
    //    parted by a stop's closure — the نَٰكَ of ثَبَّتۡنَٰكَ, 0.72 of peak,
    //    0.33 s after the ثَبَّتۡ — was popped as a stray because it was
    //    shorter than 0.4 of the one other run, and a third of the word went
    //    (2026-10-20). The loudest noise this rule ever trimmed at a tail was
    //    0.38 of peak, a breath; the gate sits at 0.5. The head is not gated:
    //    the record thump reaches the full peak, and (A) owns it.
    while (
      runs.length > count &&
      runs[runs.length - 1][1] - runs[runs.length - 1][0] < strayW &&
      runs[runs.length - 1][0] - runs[runs.length - 2][1] > partedW &&
      maxRms(runs[runs.length - 1]) < 0.5 * peak
    ) {
      const last = runs[runs.length - 1];
      say(`stray tail ${t(last[0])}–${t(last[1])} s dropped (${(maxRms(last) / peak).toFixed(2)} of peak)`);
      runs.pop();
    }
  }

  // 2. The count is known, so the real word boundaries are simply the
  //    count-1 longest silences. Everything quieter than those belongs
  //    inside a word — including the closure of a stop, which is a genuine
  //    silence in the middle of a syllable. Judging gaps by size alone can't
  //    tell that closure apart from the pause between words; ranking them
  //    can.
  if (runs.length > count) {
    const gaps = runs
      .slice(0, -1)
      .map((r, i) => ({ i, len: runs[i + 1][0] - r[1] }))
      .sort((a, b) => b.len - a.len)
      .slice(0, count - 1)
      .map((g) => g.i);
    const cuts = new Set(gaps);
    const merged = [];
    let cur = [...runs[0]];
    for (let i = 0; i < runs.length - 1; i++) {
      if (cuts.has(i)) {
        merged.push(cur);
        cur = [...runs[i + 1]];
      } else {
        cur[1] = runs[i + 1][1];
      }
    }
    merged.push(cur);
    runs = merged;
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

  //    (C) The release of a final stop consonant. A stop reading ends in a
  //    sākin ك ت ق ط ب: a closure of 0.15–0.21 s, then a burst of 50–70 ms —
  //    shorter than a tick, and further past the last run than the pad
  //    reaches — so the ك of سِرَاعࣰا ذَٰلِكَ and the ت of طَيِّبَٰتِ were cut
  //    off (2026-10-20), as lesson 5's سِيٓءَتۡ had been. A sub-tick burst
  //    within a quarter second after a piece is put back when it is loud
  //    enough (0.15 of peak) and NOISY — a release crosses zero many times
  //    a millisecond, a thump or a lip noise hardly at all — and does not
  //    touch the take's last tenth of a second, where the stop-recording
  //    click lives and no pad could follow it.
  const zcrPerMs = ([a, b]) => {
    const { buf, dataStart, bytesPerFrame, sampleRate } = wav;
    let crossings = 0;
    let prev = 0;
    for (let f = a * win; f < b * win; f++) {
      const v = buf.readInt16LE(dataStart + f * bytesPerFrame);
      if (v !== 0) {
        if (prev !== 0 && (v > 0) !== (prev > 0)) crossings++;
        prev = v;
      }
    }
    return crossings / (((b - a) * win) / (sampleRate / 1000));
  };
  const endGuard = n - Math.round(0.1 / 0.01);
  runs = runs.map(([a, b], i) => {
    const limit = i + 1 < runs.length ? runs[i + 1][0] : n;
    let end = b;
    for (const r of raw) {
      if (r[0] < end) continue;
      if (r[0] - end > partedW) break;
      if (r[1] > limit || r[1] > endGuard || r[1] - r[0] >= tickW) continue;
      const level = maxRms(r) / peak;
      if (level < 0.15) continue;
      const zcr = zcrPerMs(r);
      if (zcr < 0.4) continue;
      say(`release ${t(r[0])}–${t(r[1])} s kept after the piece ending ${t(end)} s (${level.toFixed(2)} of peak, ${zcr.toFixed(1)} crossings/ms)`);
      end = r[1];
    }
    return [a, end];
  });

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
