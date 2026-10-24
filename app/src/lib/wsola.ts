/**
 * Change the speed of a mono clip without changing its pitch — WSOLA
 * (waveform-similarity overlap-add), the algorithm the browsers' own media
 * pipelines use for `playbackRate`. Frames of 40 ms are taken from the input
 * every `hop × rate` samples and laid down every `hop`; each is slid up to
 * ±8 ms to best continue the frame before it, then cross-faded in with a
 * Hann window (50 % overlap, so the windows sum to one). Pure, so it runs in
 * a Worker (`stretch.worker.ts`) and, where there is none, on the main
 * thread. Cost on a 3 s word at 48 kHz: ~50 ms on a desktop, a few times
 * that on a phone — which is why it is done off the main thread and ahead
 * of the tap.
 */
export function wsola(x: Float32Array, sr: number, rate: number): Float32Array {
  const win = Math.round(sr * 0.04) & ~1;
  const hop = win / 2;
  const hopIn = hop * rate;
  const search = Math.round(sr * 0.008);
  const outLen = Math.max(1, Math.floor(x.length / rate));
  const y = new Float32Array(outLen + win);
  const norm = new Float32Array(outLen + win);
  const hann = new Float32Array(win);
  for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / win);

  let out = 0;
  let prevStart = 0;
  for (let k = 0; out < outLen; k++) {
    const nominal = Math.round(k * hopIn);
    if (nominal + win > x.length) break;
    let start = nominal;
    const target = prevStart + hop; // where the last frame would carry on
    if (k > 0 && target + win <= x.length) {
      const lo = Math.max(-search, -nominal);
      const hi = Math.min(search, x.length - win - nominal);
      let best = -Infinity;
      let bestOff = 0;
      for (let off = lo; off <= hi; off++) {
        const a = nominal + off;
        let s = 0;
        for (let i = 0; i < win; i += 4) s += x[a + i] * x[target + i];
        if (s > best) {
          best = s;
          bestOff = off;
        }
      }
      start = nominal + bestOff;
    }
    for (let i = 0; i < win; i++) {
      y[out + i] += x[start + i] * hann[i];
      norm[out + i] += hann[i];
    }
    prevStart = start;
    out += hop;
  }
  for (let i = 0; i < outLen; i++) if (norm[i] > 1e-3) y[i] /= norm[i];
  return y.subarray(0, outLen).slice() as Float32Array<ArrayBuffer>;
}
