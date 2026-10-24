/**
 * The time-stretch, off the main thread. One message in — the clip's
 * samples, its rate and the speed — one message out, the stretched samples,
 * both transferred rather than copied. See `wsola.ts` and `playback.ts`.
 */
import { wsola } from './wsola';

interface Request {
  id: number;
  data: Float32Array;
  sampleRate: number;
  rate: number;
}

// The DOM lib types `self` as a Window; a worker's postMessage takes a
// transfer list where the window's takes an origin.
const scope = self as unknown as {
  postMessage(message: unknown, transfer: Transferable[]): void;
  addEventListener(type: 'message', handler: (e: MessageEvent<Request>) => void): void;
};

scope.addEventListener('message', (e) => {
  const { id, data, sampleRate, rate } = e.data;
  const out = wsola(data, sampleRate, rate);
  scope.postMessage({ id, out }, [out.buffer]);
});
