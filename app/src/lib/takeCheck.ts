/**
 * Judging a take the moment it is made, instead of three weeks later.
 *
 * The generators cut a take into words with `splitIntoN` (scripts/lib/wav.mjs)
 * and complain in exactly two situations: it could not produce the number of
 * pieces the row expects, or the pieces came out wildly uneven. Until now the
 * only way to learn either was to run the generator, long after the microphone
 * had been put away.
 *
 * So this is a **port of that function**, not an approximation of it. Anything
 * looser fails takes the real splitter would have accepted — and a gate that
 * cries wolf is worse than no gate, because it teaches you to click past it.
 * The port was checked against the generator on the project's own recordings;
 * see the note at the bottom of this file.
 *
 * The thing that makes this worth doing: a word contains real silences. The
 * closure of a stop in the middle of خَلَقَكُمْ is as quiet as the pause between
 * two words, so raw silence-counting says that one word is two. `splitIntoN`
 * gets it right by *ranking* the gaps rather than thresholding them — it knows
 * how many pieces there should be, so the boundaries are simply the longest
 * count-1 silences and everything quieter belongs inside a word.
 */

const WINDOW_S = 0.01; // 10 ms windows, as in the generator

export interface TakeReport {
  duration: number;
  /** Loudest sample, 0…1. */
  peak: number;
  /** Room tone, as the generator measures it: the 15th-percentile window. */
  noiseFloor: number;
  /** Peak over noise floor, in dB — the practical measure of a usable room. */
  snr: number;
  /**
   * Separate stretches of sound before any forcing — usually *more* than the
   * number of words, because closures inside a word read as silence. Only a
   * shortfall matters.
   */
  naturalRuns: number;
  /** Seconds of each piece the generator would cut. */
  durations: number[];
  /** The generator's own complaint: the pieces are more than 3× apart. */
  suspicious: boolean;
  /** The splitter had to cut inside a continuous run to reach the count. */
  forced: boolean;
  /** Samples at full scale: something was recorded too hot to repair. */
  clipped: boolean;
}

/**
 * The generator's `profile`: RMS per window, the peak, and a threshold that
 * sits above *this take's* own noise floor rather than at a fixed level.
 * Recording levels vary hugely between sessions; a fixed floor that suits a
 * loud take swallows a quiet one whole.
 */
function profile(samples: Float32Array, sampleRate: number) {
  const win = Math.max(1, Math.round(sampleRate * WINDOW_S));
  const n = Math.floor(samples.length / win);
  const rms = new Float64Array(n);
  // Two different peaks, and confusing them moves every boundary. The
  // generator's threshold is a share of the loudest *window's RMS*, not of the
  // loudest sample — an RMS is well below the peak it contains, so using the
  // sample here raised the threshold and trimmed ~0.06s off every take.
  // `peakSample` exists only to report the level and to spot clipping.
  let peakRms = 0;
  let peakSample = 0;
  let hot = 0;
  for (let w = 0; w < n; w++) {
    let sum = 0;
    for (let i = w * win; i < (w + 1) * win; i++) {
      const v = samples[i];
      sum += v * v;
      const a = Math.abs(v);
      if (a > peakSample) peakSample = a;
      if (a >= 0.999) hot++;
    }
    rms[w] = Math.sqrt(sum / win);
    if (rms[w] > peakRms) peakRms = rms[w];
  }
  const sorted = Float64Array.from(rms).sort();
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] || 0;
  return {
    rms,
    win,
    peakRms,
    peakSample,
    noiseFloor,
    // A run of full-scale samples is clipping; one or two are a coincidence.
    clipped: hot > 3,
    threshold: Math.max(noiseFloor * 3.5, peakRms * 0.06, 0.0008),
  };
}

/**
 * Half a second at each end of a take belongs to the hand, not the voice.
 *
 * Found the first time a room tone was recorded: the check reported speech at
 * 0.21–0.32 s and again in the final hundredth of a second, in a room whose
 * actual floor was −86 dBFS. Those were the mouse clicks starting and stopping
 * the recording. Every speaker will make them, every time.
 *
 * Only room tone needs this. A word take's own edge-trim already drops a
 * click, and trimming a word's first half-second could eat the word.
 */
const EDGE_S = 0.5;

export function checkTake(samples: Float32Array, sampleRate: number, count = 1): TakeReport {
  const whole = samples;
  if (count === 0) {
    const edge = Math.round(sampleRate * EDGE_S);
    if (samples.length > edge * 3) samples = samples.subarray(edge, samples.length - edge);
  }
  const { rms, win, peakRms, peakSample, noiseFloor, clipped, threshold } = profile(
    samples,
    sampleRate,
  );
  const n = rms.length;

  // 1. Runs of sound.
  let runs: [number, number][] = [];
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
  //    Measuring "short" against the other pieces once threw away the
  //    quarter-second وَ of وَٱلتَّكَاثُرُ and beheaded the word.
  const tickW = Math.round(0.08 / WINDOW_S);
  const kept = runs.filter(([a, b]) => b - a >= tickW);
  if (kept.length >= 1) runs = kept;

  //    A breath or a chair creak at the very top or tail is longer than a
  //    click but still not a word. Trimmed from the EDGES only, and only when
  //    a real silence separates it from the content.
  if (runs.length > count) {
    const lens = runs.map(([a, b]) => b - a).sort((x, y) => x - y);
    const median = lens[Math.floor(lens.length / 2)];
    const strayW = median * 0.4;
    const partedW = Math.round(0.25 / WINDOW_S);
    while (
      runs.length > count &&
      runs[0][1] - runs[0][0] < strayW &&
      runs[1][0] - runs[0][1] > partedW
    ) {
      runs.shift();
    }
    while (
      runs.length > count &&
      runs[runs.length - 1][1] - runs[runs.length - 1][0] < strayW &&
      runs[runs.length - 1][0] - runs[runs.length - 2][1] > partedW
    ) {
      runs.pop();
    }
  }

  const naturalRuns = runs.length;

  // 2. The count is known, so the boundaries are the count-1 longest silences.
  if (runs.length > count) {
    const cuts = new Set(
      runs
        .slice(0, -1)
        .map((r, i) => ({ i, len: runs[i + 1][0] - r[1] }))
        .sort((a, b) => b.len - a.len)
        .slice(0, count - 1)
        .map((g) => g.i),
    );
    const merged: [number, number][] = [];
    let cur: [number, number] = [...runs[0]];
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

  // 3. Too few: two words were said with no pause between them. Split the
  //    longest run at its quietest interior moment and try again.
  let forced = false;
  while (runs.length < count && runs.length > 0) {
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
    if (quietest < 0) break;
    runs.splice(longest, 1, [a, quietest], [quietest + 1, b]);
    forced = true;
  }

  const padW = Math.round(0.12 / WINDOW_S);
  const durations = runs.map(([a, b]) => {
    const from = Math.max(0, a - padW) * win;
    const to = Math.min(n, b + padW) * win;
    return (to - from) / sampleRate;
  });

  return {
    // The reported duration is the take the author actually made, not the
    // trimmed window the measurements were taken over.
    duration: whole.length / sampleRate,
    peak: peakSample,
    noiseFloor,
    // Peak against room tone. Both are RMS-based so the figure means what a
    // signal-to-noise ratio usually means.
    snr: noiseFloor > 0 ? 20 * Math.log10(peakRms / noiseFloor) : Infinity,
    naturalRuns,
    durations,
    suspicious: durations.length > 1 && Math.max(...durations) > Math.min(...durations) * 3,
    forced,
    clipped,
  };
}

export interface TakeVerdict {
  level: 'good' | 'warn' | 'bad';
  notes: string[];
}

/**
 * What to say to the person holding the microphone.
 *
 * The thresholds are measured, not guessed. Across all 172 recordings the
 * project already has: peaks run −32.7 to −0.3 dBFS (median −16.8), and the
 * signal-to-noise ratio never falls below 39 dB (median 59). Every threshold
 * below therefore sits clear of the whole existing corpus — not one of these
 * warnings can fire on a take that has already proved itself. A warning nobody
 * should act on is a warning everybody learns to ignore.
 */
export function verdict(report: TakeReport, expected: number): TakeVerdict {
  const notes: string[] = [];
  let level: TakeVerdict['level'] = 'good';
  const worse = (l: TakeVerdict['level']) => {
    if (l === 'bad' || (l === 'warn' && level === 'good')) level = l;
  };

  // Room tone is the one slot where silence is the point, so every test reads
  // backwards for it: quiet is right, and speech is the fault.
  if (expected === 0) {
    if (report.naturalRuns > 0) {
      return { level: 'bad', notes: ['Something was said — this one wants the room on its own.'] };
    }
    if (report.duration < 2) {
      return { level: 'warn', notes: ['Shorter than two seconds. A little more is better.'] };
    }
    return { level: 'good', notes: ['Quiet — good.'] };
  }

  if (report.clipped) {
    notes.push('Too loud — the peaks are clipped. Move back a little and record it again.');
    worse('bad');
  } else if (report.peak < 0.012) {
    notes.push('Extremely quiet. Move closer or raise the input level.');
    worse('warn');
  }

  if (report.snr < 30) {
    notes.push(`Only ${report.snr.toFixed(0)} dB above the room. A quieter room would help.`);
    worse('warn');
  }

  // Only a *shortfall* is a fault. More stretches of sound than words is the
  // normal case — the closure inside خَلَقَكُمْ is a genuine silence, and the
  // splitter is built to see through it.
  if (report.naturalRuns === 0) {
    notes.push('No speech found at all.');
    worse('bad');
  } else if (report.forced) {
    notes.push(
      `Only ${report.naturalRuns} clear ${report.naturalRuns === 1 ? 'piece' : 'pieces'} of speech for ${expected}. ` +
        'The splitter had to guess where one ends and the next begins — leave a clearer pause.',
    );
    worse('bad');
  } else if (report.suspicious) {
    notes.push(
      `The pieces came out very uneven (${report.durations.map((d) => d.toFixed(2)).join(' / ')}s). Worth a listen.`,
    );
    worse('warn');
  }

  if (!notes.length) notes.push('Clean.');
  return { level, notes };
}

// ── input level, judged across a batch rather than take by take ───────────

/**
 * The band a take's peak should land in, in dBFS.
 *
 * The floor of the band is where lessons 1–4 mostly sit; the ceiling leaves
 * room for a louder-than-expected word without clipping. Below the band is
 * still perfectly usable — 16-bit at −25 dBFS in a −86 dBFS room loses
 * nothing measurable — it simply plays quieter than the published lessons,
 * which a learner notices when they move between them.
 */
export const LEVEL_BAND = { low: -18, high: -6, aim: -12 };

/** Peak of a take in dBFS, the number the meter and the advice both use. */
export const dbfs = (peak: number): number => 20 * Math.log10(peak || 1e-9);

export interface LevelAdvice {
  level: 'good' | 'warn' | 'bad';
  medianDb: number;
  /** How much louder the input should be, in dB. Zero when it is in band. */
  raiseBy: number;
  message: string;
}

/**
 * Guidance from the takes made so far, not from a single one.
 *
 * Deliberately a batch judgement. One quiet word is a word; thirty quiet words
 * is an input-gain setting, and it is worth being told about that *after the
 * speaker profile* — five takes in — rather than after a whole sheet.
 */
export function levelAdvice(peaks: number[]): LevelAdvice | null {
  if (peaks.length < 2) return null;
  const dbs = peaks.map(dbfs).sort((a, b) => a - b);
  const medianDb = Math.round(dbs[Math.floor(dbs.length / 2)] * 10) / 10;

  if (medianDb > -1) {
    return {
      level: 'bad',
      medianDb,
      raiseBy: 0,
      message: 'Your input is too hot — takes are clipping. Lower it and re-record any clipped take.',
    };
  }
  if (medianDb >= LEVEL_BAND.low) {
    return { level: 'good', medianDb, raiseBy: 0, message: 'Input level is where it should be.' };
  }

  const raiseBy = Math.round(LEVEL_BAND.aim - medianDb);
  if (medianDb < -30) {
    return {
      level: 'bad',
      medianDb,
      raiseBy,
      message:
        `Very quiet — a median peak of ${medianDb} dBFS. Raise the microphone level in Windows ` +
        `sound settings by roughly ${raiseBy} dB (or move closer) before recording the sheet.`,
    };
  }
  return {
    level: 'warn',
    medianDb,
    raiseBy,
    message:
      `Usable, but quiet: a median peak of ${medianDb} dBFS against about −17 for lessons 1–4, ` +
      `so these will play noticeably quieter than the rest. Nothing is lost at this level — the ` +
      `room is clean — but raising the Windows input by roughly ${raiseBy} dB now will save ` +
      `re-recording the sheet later.`,
  };
}

/*
 * Verified against the generator, not merely believed:
 * `scripts/check-take-parity.mjs` runs `splitIntoN` and this port over every
 * recording in Audio/ and compares the piece boundaries. Run it after touching
 * either — they are one algorithm living in two languages, and the moment they
 * disagree this file starts lying.
 */
