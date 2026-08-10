/**
 * Microphone capture for the intake system.
 *
 * Two decisions here are not stylistic, and undoing either quietly ruins every
 * recording made afterwards:
 *
 * 1. **All of the browser's audio processing is switched off.** getUserMedia
 *    defaults `echoCancellation`, `noiseSuppression` and `autoGainControl` to
 *    on. Auto-gain hunts the level between words, which destroys the one thing
 *    `splitIntoN` depends on — a take whose own noise floor is a stable
 *    reference — and noise suppression is a spectral gate that eats precisely
 *    the fricative energy that distinguishes ح from خ. A recording made with
 *    these on cannot be repaired afterwards.
 *
 * 2. **No downsampling.** The device rate (48 kHz on most machines) is kept and
 *    written into the header. ح and خ carry real energy above 8 kHz, so a
 *    16 kHz intake would throw away the part of the signal the pronunciation
 *    work will need. Downsampling later is always possible; the reverse is not.
 *
 * Capture runs through an AudioWorklet rather than MediaRecorder so what comes
 * back is raw float samples — see `wavFile.ts` for why that matters.
 */

import { concatChunks } from './wavFile';

/** The worklet, inlined: one small processor is not worth a build-time asset. */
const WORKLET_SOURCE = `
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    // ~85 ms at 48 kHz. Posting every 128-frame render quantum would be 375
    // messages a second for nothing; this is still well inside a meter's
    // refresh rate.
    this.buf = new Float32Array(4096);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.buf.length) {
        this.port.postMessage(this.buf.slice(0));
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('capture', Capture);
`;

export interface Capture {
  samples: Float32Array;
  sampleRate: number;
  /**
   * The microphone the browser actually opened.
   *
   * Taken from the live track rather than from the picker, because "Default"
   * resolves to whatever Windows currently prefers and the picker cannot say
   * which that was. Absolute level is a property of the microphone and the
   * room, never of the speaker, so a corpus that cannot say which microphone
   * made a recording cannot compare levels across recordings at all.
   */
  device: string;
}

export interface RecorderHandle {
  /** Peak of the most recent chunk, 0…1 — for the level meter. */
  level: () => number;
  /** Stops capture and returns everything recorded. */
  stop: () => Promise<Capture>;
  /** Stops and throws the audio away (leaving the mic released). */
  cancel: () => void;
}

let workletUrl: string | null = null;

/**
 * Opens the microphone and starts capturing. Rejects if permission is refused
 * — the caller says so plainly rather than leaving a dead Record button.
 */
export async function startRecording(deviceId?: string): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  });

  const ctx = new AudioContext();
  workletUrl ??= URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }));
  await ctx.audioWorklet.addModule(workletUrl);

  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'capture');
  const chunks: Float32Array[] = [];
  let peak = 0;

  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const chunk = e.data;
    chunks.push(chunk);
    let p = 0;
    for (let i = 0; i < chunk.length; i++) {
      const v = Math.abs(chunk[i]);
      if (v > p) p = v;
    }
    peak = p;
  };
  source.connect(node);
  // The worklet emits nothing, but an unconnected node is not guaranteed to be
  // pulled. A zero-gain sink keeps it running without any of it reaching the
  // speakers — which would otherwise be a feedback loop straight into the mic.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(ctx.destination);

  const release = () => {
    node.port.onmessage = null;
    source.disconnect();
    node.disconnect();
    for (const track of stream.getTracks()) track.stop();
    void ctx.close();
  };

  return {
    level: () => peak,
    stop: async () => {
      const sampleRate = ctx.sampleRate;
      // Read the label before the tracks are stopped — it is blank afterwards.
      const device = stream.getAudioTracks()[0]?.label ?? '';
      release();
      return { samples: concatChunks(chunks), sampleRate, device };
    },
    cancel: release,
  };
}

/** The microphones the browser will name, for the device picker. */
export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'audioinput');
}
