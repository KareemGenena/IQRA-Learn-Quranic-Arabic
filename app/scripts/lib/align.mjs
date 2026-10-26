/**
 * Timing a recording from its own sound — no hand taps, no speech model.
 *
 * Two jobs, both for Level 1 (the author, 2026-10-25):
 *
 *  1. A LETTER CARD's line ("This is the letter baa… With a fat-ha it sounds
 *     like baa, with a damma boo… Now your turn, say baa boo bee nab") is one
 *     take, and its highlight is by PHRASE: the picture while he talks about
 *     the picture, each sound card through its own phrase, nothing during
 *     "Now your turn". `alignTokens` matches the script's words to the
 *     stretches of sound between pauses — the speaker pauses at almost
 *     every comma and before every sound he demonstrates — by a dynamic
 *     programme over (stretch, word): each stretch takes a run of words
 *     whose predicted length best fits its own, a stretch may be noise (a
 *     breath, a click) and take none, and a break where the script has no
 *     punctuation costs a little more. A phrase begins where its first word
 *     is placed.
 *
 *  2. A SONG is sung in a steady rhythm with a breath between lines (the
 *     names) or after every letter's three sounds (the sounds). Its lines
 *     are cut at the longest pauses near an even split (`linePauses`), and
 *     each line is divided among its notes at the deepest dips of its
 *     loudness near where an even beat would put them (`divide`) — every
 *     sung syllable opens on a consonant, and a consonant is a dip.
 *
 * Both work on the 10 ms RMS envelope, with the take's own noise floor as
 * the reference (recording levels vary by 30 dB across the corpus). The
 * results are BAKED timings — below a calibration in priority, so a tap
 * calibration still wins wherever the author makes one.
 */

const WIN = 0.01;

/** RMS per 10 ms window of channel 0, and the floor / peak / threshold the
 *  splitter uses (15th-percentile floor ×3.5, or 3 % of peak). */
export function envelope(wav) {
  const { buf, dataStart, bytesPerFrame, frames, sampleRate } = wav;
  const win = Math.max(1, Math.round(sampleRate * WIN));
  const n = Math.floor(frames / win);
  const rms = new Float64Array(n);
  for (let w = 0; w < n; w++) {
    let s = 0;
    for (let f = w * win; f < (w + 1) * win; f++) {
      const v = buf.readInt16LE(dataStart + f * bytesPerFrame) / 32768;
      s += v * v;
    }
    rms[w] = Math.sqrt(s / win);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const floor = sorted[Math.floor(n * 0.15)] ?? 0;
  const peak = sorted[n - 1] ?? 0;
  return { rms, n, floor, peak, threshold: Math.max(floor * 3.5, peak * 0.03, 0.0008), duration: frames / sampleRate };
}

/** Stretches of sound, in seconds, parted by at least `minGap` of quiet.
 *  Blips shorter than `minRun` are dropped. */
export function speechRuns(env, { minGap = 0.1, minRun = 0.05 } = {}) {
  const { rms, n, threshold } = env;
  let runs = [];
  let st = -1;
  for (let w = 0; w <= n; w++) {
    const loud = w < n && rms[w] >= threshold;
    if (loud && st < 0) st = w;
    else if (!loud && st >= 0) {
      runs.push([st, w]);
      st = -1;
    }
  }
  runs = runs.filter(([a, b]) => b - a >= Math.round(minRun / WIN));
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] < Math.round(minGap / WIN)) last[1] = r[1];
    else merged.push([...r]);
  }
  return merged.map(([a, b]) => [a * WIN, b * WIN]);
}

// ── 1. a spoken script ─────────────────────────────────────────────────────

const ARABIC = /[؀-ۿࢠ-ࣿ]/;

/** Rough syllables of a word as spoken: vowel groups, a silent final e
 *  dropped; an Arabic token is one. */
function syllables(word) {
  if (ARABIC.test(word)) return 1;
  const w = word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!w) return 0;
  let n = (w.match(/[aeiouy]+/g) ?? []).length;
  if (w.length > 3 && /[^aeiou]e$/.test(w) && !/le$/.test(w)) n -= 1;
  return Math.max(1, n);
}

/**
 * Words of a script with what the aligner needs about each: its predicted
 * length in syllable units (a demonstrated sound is drawn out, ×1.7), and
 * how freely a pause may follow it (after a full stop or colon freely,
 * after a comma or before a demonstrated sound almost so, elsewhere
 * reluctantly).
 */
export function tokenize(text, { sounds = [] } = {}) {
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const soundSet = new Set(sounds.map(fold));
  const raw = text.split(/\s+/).filter(Boolean);
  const tokens = raw.map((w) => {
    const bare = w.replace(/^[("“'‘]+/, '').replace(/[)"”'’.,:;!?—–-]+$/, '');
    const strong = /[.:!?]["”')]*$/.test(w);
    const soft = /[,;—–]["”')]*$/.test(w);
    // An Arabic token is demonstrated too ("with a sukoon after نَ"): said
    // apart, with a pause either side, like baa.
    const sound = soundSet.has(fold(bare)) || ARABIC.test(bare);
    return { word: w, bare, units: syllables(bare) * (sound ? 1.7 : 1), sound, after: strong ? 2 : soft ? 1 : 0 };
  });
  // a dash standing alone between words is punctuation, not a word
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].units === 0) tokens[i - 1].after = Math.max(tokens[i - 1].after, 1);
  }
  const kept = tokens.filter((t) => t.units > 0);
  // a pause is natural before and after a demonstrated sound too
  for (let i = 0; i + 1 < kept.length; i++) {
    if (kept[i + 1].sound || kept[i].sound) kept[i].after = Math.max(kept[i].after, 1);
  }
  return kept;
}

/**
 * Places every token in a stretch of sound. Returns each token's start and
 * end time (interpolated by units inside a stretch; null for a word the
 * speaker left out), the fit's cost per word, and the stretches it treated
 * as noise. A word may be LEFT OUT at a cost — the speaker does not always
 * read the sheet to the letter (ء's "sitting up on an alif" is not in its
 * take, and squeezing it in pushed "Now your turn" onto "Say", 2026-10-25)
 * — except the words in `keep`, the ones the caller needs a time for.
 */
export function alignTokens(runs, tokens, { keep = new Set() } = {}) {
  const R = runs.length;
  const W = tokens.length;
  const cum = [0];
  for (const t of tokens) cum.push(cum[cum.length - 1] + t.units);
  const spoken = runs.reduce((s, [a, b]) => s + (b - a), 0);
  let alpha = spoken / (cum[W] || 1); // seconds per unit
  const breakCost = (j) => (j <= 0 || j >= W ? 0 : [2.2, 0.35, 0][tokens[j - 1].after]);
  // Two demonstrated sounds in one stretch: he always pauses between them
  // ("say baa | boo | bee | nab"), so a stretch holding two is a misreading.
  const pairs = [0];
  for (let k = 0; k < W; k++) pairs.push(pairs[k] + (k + 1 < W && tokens[k].sound && tokens[k + 1].sound ? 1 : 0));
  const pairsIn = (i, j) => (j - i >= 2 ? pairs[j - 1] - pairs[i] : 0);

  const skipCost = (k) => (keep.has(k) ? Infinity : 0.9 + 0.3 * tokens[k].units);
  // A sentence end with no pause at all is rare ("nab. Now your turn" read
  // as one stretch was a misreading, 2026-10-25). A long pause where the
  // script runs on is NOT rare for this speaker — he pauses before the word
  // that matters ("With a … fat-ha") — so it costs nothing extra.
  const stops = [0];
  for (let k = 0; k < W; k++) stops.push(stops[k] + (tokens[k].after === 2 ? 1 : 0));
  const stopsInside = (i, j) => (j - i >= 2 ? stops[j - 1] - stops[i] : 0);

  const solve = () => {
    const INF = 1e18;
    const f = Array.from({ length: R + 1 }, () => new Float64Array(W + 1).fill(INF));
    // how a state was reached: from[r][j] the previous word index; skipped
    // marks a word left out (same stretch), otherwise a stretch was spent
    const from = Array.from({ length: R + 1 }, () => new Int32Array(W + 1).fill(-1));
    const skipped = Array.from({ length: R + 1 }, () => new Uint8Array(W + 1));
    f[0][0] = 0;
    const leaveOut = (r) => {
      for (let i = 0; i < W; i++) {
        if (f[r][i] >= INF) continue;
        const c = f[r][i] + skipCost(i);
        if (c < f[r][i + 1]) {
          f[r][i + 1] = c;
          from[r][i + 1] = i;
          skipped[r][i + 1] = 1;
        }
      }
    };
    for (let r = 0; r < R; r++) {
      leaveOut(r);
      const d = runs[r][1] - runs[r][0];
      const noise = 3 + 12 * d; // a stretch with no word: a breath, a click
      for (let i = 0; i <= W; i++) {
        if (f[r][i] >= INF) continue;
        if (f[r][i] + noise < f[r + 1][i]) {
          f[r + 1][i] = f[r][i] + noise;
          from[r + 1][i] = i;
          skipped[r + 1][i] = 0;
        }
        for (let j = i + 1; j <= W; j++) {
          const pred = alpha * (cum[j] - cum[i]);
          if (pred > d * 3 + 1.5) break;
          const z = (d - pred) / (0.12 + 0.25 * Math.max(d, pred));
          const c = f[r][i] + z * z + breakCost(j) + 2.5 * pairsIn(i, j) + 3 * stopsInside(i, j);
          if (c < f[r + 1][j]) {
            f[r + 1][j] = c;
            from[r + 1][j] = i;
            skipped[r + 1][j] = 0;
          }
        }
      }
    }
    leaveOut(R);
    const groups = [];
    const left = [];
    let r = R;
    let j = W;
    while (r > 0 || j > 0) {
      const i = from[r][j];
      if (i < 0) break;
      if (skipped[r][j]) {
        left.unshift(j - 1);
        j = i;
        continue;
      }
      groups.unshift({ run: r - 1, from: i, to: j });
      r -= 1;
      j = i;
    }
    return { cost: f[R][W], groups, left };
  };

  let res = solve();
  // one refinement of the speaking rate from the first alignment
  const words = res.groups.filter((g) => g.to > g.from);
  const u = words.reduce((s, g) => s + cum[g.to] - cum[g.from], 0);
  const d = words.reduce((s, g) => s + runs[g.run][1] - runs[g.run][0], 0);
  if (u > 0) {
    alpha = d / u;
    res = solve();
  }
  const starts = new Array(W).fill(null);
  const ends = new Array(W).fill(null);
  const noise = [];
  for (const g of res.groups) {
    const [a, b] = runs[g.run];
    if (g.to === g.from) {
      noise.push(g.run);
      continue;
    }
    const span = cum[g.to] - cum[g.from];
    for (let k = g.from; k < g.to; k++) {
      starts[k] = a + ((cum[k] - cum[g.from]) / span) * (b - a);
      ends[k] = a + ((cum[k + 1] - cum[g.from]) / span) * (b - a);
    }
  }
  return { starts, ends, cost: res.cost / Math.max(1, W), groups: res.groups, noise, alpha, left: res.left };
}

// ── 2. a song ──────────────────────────────────────────────────────────────

/** Moving average over `k` windows, centred. */
function smooth(rms, k = 3) {
  const out = new Float64Array(rms.length);
  const h = Math.floor(k / 2);
  for (let i = 0; i < rms.length; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(rms.length - 1, i + h); j++) {
      s += rms[j];
      c += 1;
    }
    out[i] = s / c;
  }
  return out;
}

/**
 * Cuts the span [a, b] (seconds) into `weights.length` notes, choosing all
 * the cuts at once: among the candidate places — every breath (where the
 * sound comes back after it) and every clear dip in the loudness (a
 * consonant) — the set that is deepest overall while keeping each note's
 * length near what the weights expect. Choosing one cut at a time near an
 * even beat failed on the names song: alif is sung long, and the search
 * window for ب lay inside it (ب and ت came out 0.12 s apart, 2026-10-25).
 * Returns the n+1 boundaries.
 */
export function divide(env, a, b, weights) {
  const n = weights.length;
  if (n <= 1) return [a, b];
  const sm = smooth(env.rms, 3);
  const wa = Math.round(a / WIN);
  const wb = Math.round(b / WIN);
  let top = 0;
  for (let w = wa; w < wb; w++) top = Math.max(top, sm[w] ?? 0);
  top = top || 1;

  // Candidates: [time, strength]. A sung note begins where the sound
  // JUMPS back up — the vowel after a consonant, or the voice after a
  // breath. A consonant is a low stretch (the j of jiim is 0.2 s at −18 dB),
  // not a point, so looking for the lowest point found too few; the rise at
  // its end is sharp and lands as the note is heard.
  const dB = (w) => 20 * Math.log10(Math.max(sm[w] ?? 0, top * 1e-4) / top);
  const rise = new Float64Array(wb + 1);
  for (let w = wa + 6; w < wb - 3; w++) {
    let low = Infinity;
    for (let k = 1; k <= 6; k++) low = Math.min(low, dB(w - k));
    rise[w] = (dB(w) + dB(w + 1) + dB(w + 2)) / 3 - low;
  }
  const cand = [];
  for (let w = wa + 8; w < wb - 8; w++) {
    // a rise that stays below the speech level is the room inside a breath
    if (rise[w] < 8 || sm[w + 2] < env.threshold) continue;
    let peak = true;
    for (let k = -8; k <= 8 && peak; k++) if (k && rise[w + k] > rise[w]) peak = false;
    // a breath before it makes it certain
    let quiet = 0;
    for (let k = 1; k <= 30 && sm[w - k] < env.threshold; k++) quiet += 1;
    if (peak) cand.push([w * WIN, rise[w] / 6 + (quiet >= 8 ? 1 : 0)]);
  }
  // A legato line (da-du-di) may have no sharp rise between two notes,
  // only a dip: the lowest point within ±50 ms, clearly below the loudest
  // within 120 ms on either side.
  for (let w = wa + 8; w < wb - 8; w++) {
    const v = sm[w];
    let isMin = true;
    for (let k = -5; k <= 5 && isMin; k++) if (k && sm[w + k] < v) isMin = false;
    if (!isMin) continue;
    let left = 0;
    let right = 0;
    for (let k = 1; k <= 12; k++) {
      left = Math.max(left, sm[w - k] ?? 0);
      right = Math.max(right, sm[w + k] ?? 0);
    }
    const shoulder = Math.min(left, right);
    if (v < 0.7 * shoulder) cand.push([w * WIN, Math.log(shoulder / Math.max(v, top * 1e-4))]);
  }
  cand.sort((x, y) => x[0] - y[0]);

  const total = weights.reduce((s, w) => s + w, 0);
  const expect = weights.map((w) => ((b - a) * w) / total);
  // and the even beat itself, worth nothing, so that a line always has a
  // valid split even where the sound gives no sign
  {
    let acc = 0;
    for (let k = 0; k < n - 1; k++) cand.push([a + ((b - a) * (acc += weights[k])) / total, 0]);
    cand.sort((x, y) => x[0] - y[0]);
  }
  const C = cand.length;
  if (C < n - 1) {
    // too few places: fall back to the weights alone
    const out = [a];
    let acc = 0;
    for (let k = 0; k < n - 1; k++) out.push(a + ((b - a) * (acc += weights[k])) / total);
    out.push(b);
    return out;
  }
  // A note is never under 30 % of its expected length — a consonant's
  // burst and its vowel's rise are one note (دَ came out 0.14 s long) — and
  // its length weighs more than how sharp its onset is.
  const noteCost = (len, k) => {
    if (len < Math.max(0.12, 0.3 * expect[k])) return 1e6;
    const z = (len - expect[k]) / expect[k];
    return 5 * z * z;
  };
  // best[k][c]: notes 0..k ended, cut k placed at candidate c
  const INF = 1e18;
  const best = Array.from({ length: n - 1 }, () => new Float64Array(C).fill(INF));
  const prev = Array.from({ length: n - 1 }, () => new Int32Array(C).fill(-1));
  for (let c = 0; c < C; c++) best[0][c] = noteCost(cand[c][0] - a, 0) - cand[c][1];
  for (let k = 1; k < n - 1; k++) {
    for (let c = 0; c < C; c++) {
      for (let p = 0; p < c; p++) {
        if (best[k - 1][p] >= INF) continue;
        const v = best[k - 1][p] + noteCost(cand[c][0] - cand[p][0], k) - cand[c][1];
        if (v < best[k][c]) {
          best[k][c] = v;
          prev[k][c] = p;
        }
      }
    }
  }
  let end = -1;
  let min = INF;
  for (let c = 0; c < C; c++) {
    const v = best[n - 2][c] + noteCost(b - cand[c][0], n - 1);
    if (v < min) {
      min = v;
      end = c;
    }
  }
  const cuts = [];
  for (let k = n - 2, c = end; k >= 0; k--) {
    cuts.unshift(cand[c][0]);
    c = prev[k][c];
  }
  return [a, ...cuts, b];
}

/**
 * The `k` pauses that cut a song into k + 1 lines: chosen in order by a
 * dynamic programme that favours long pauses near an even split. Returns
 * the pauses ({start, end}) and the song's first and last sound.
 */
export function linePauses(env, k, { minGap = 0.12 } = {}) {
  const runs = speechRuns(env, { minGap, minRun: 0.05 });
  const gaps = [];
  for (let i = 0; i + 1 < runs.length; i++) gaps.push({ start: runs[i][1], end: runs[i + 1][0] });
  const s0 = runs[0]?.[0] ?? 0;
  const s1 = runs[runs.length - 1]?.[1] ?? env.duration;
  const G = gaps.length;
  if (G < k) return null;
  const period = (s1 - s0) / (k + 1);
  const score = (g, m) => {
    const mid = (gaps[g].start + gaps[g].end) / 2;
    const off = (mid - (s0 + period * (m + 1))) / period;
    return (gaps[g].end - gaps[g].start) * 4 - off * off * 3;
  };
  const best = Array.from({ length: k + 1 }, () => new Float64Array(G + 1).fill(-Infinity));
  const took = Array.from({ length: k + 1 }, () => new Int8Array(G + 1));
  for (let g = 0; g <= G; g++) best[0][g] = 0;
  for (let m = 1; m <= k; m++) {
    for (let g = 1; g <= G; g++) {
      const take = best[m - 1][g - 1] + score(g - 1, m - 1);
      const skip = best[m][g - 1];
      if (take >= skip) {
        best[m][g] = take;
        took[m][g] = 1;
      } else best[m][g] = skip;
    }
  }
  const chosen = [];
  let m = k;
  let g = G;
  while (m > 0 && g > 0) {
    if (took[m][g]) {
      chosen.unshift(gaps[g - 1]);
      m -= 1;
    }
    g -= 1;
  }
  return chosen.length === k ? { pauses: chosen, start: s0, end: s1 } : null;
}
