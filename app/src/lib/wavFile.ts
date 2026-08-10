/**
 * 16-bit PCM WAV, written by hand in the browser.
 *
 * Why not MediaRecorder: it hands back WebM/Opus. `scripts/lib/wav.mjs`
 * accepts 16-bit PCM WAV and nothing else, so an Opus file would stop the
 * pipeline dead — and, worse, Opus is lossy in exactly the high-frequency
 * friction that tells ح from خ apart. The intake is the one irreversible step
 * in the chain, so it stores the untouched samples.
 *
 * This mirrors `writeSegment` in the generator library, header field for
 * header field, so a file recorded here and a file cut there are the same
 * kind of thing.
 */

/** Mono 16-bit PCM WAV from float samples in [-1, 1]. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytes = samples.length * 2;
  const out = new ArrayBuffer(44 + bytes);
  const view = new DataView(out);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, bytes, true);

  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling: a sample past ±1 would wrap to the opposite
    // extreme and put a loud click where the loudest moment was.
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return new Blob([out], { type: 'audio/wav' });
}

/** Joins the captured chunks into one run of samples. */
export function concatChunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
