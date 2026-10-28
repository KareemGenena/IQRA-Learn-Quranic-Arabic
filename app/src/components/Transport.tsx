/**
 * Play, Pause and Stop for a long recording — a letter card's whole line, a
 * song, a take in the audio intake — each doing what its name says (the
 * author, 2026-10-27): Play starts, or carries on from where Pause held it;
 * Pause holds the place; Stop ends it, and the next Play starts from the
 * beginning. One button that turned into "Stop" read as a pause, and the
 * next Play started the line over. A short word keeps its one tap.
 */
export type TransportState = 'idle' | 'playing' | 'paused';

export function Transport({
  state,
  onPlay,
  onPause,
  onStop,
  waiting = false,
  small = false,
  label = 'Playback',
}: {
  state: TransportState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  /** The clip is still on its way: nothing to pause yet. */
  waiting?: boolean;
  small?: boolean;
  label?: string;
}) {
  return (
    <div className={`transport ${small ? 'small' : ''}`} role="group" aria-label={label}>
      <button type="button" className="btn primary transport-btn" onClick={onPlay} disabled={state === 'playing'}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
        </svg>
        <span>Play</span>
      </button>
      <button type="button" className="btn transport-btn" onClick={onPause} disabled={state !== 'playing' || waiting}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
        </svg>
        <span>Pause</span>
      </button>
      <button type="button" className="btn transport-btn" onClick={onStop} disabled={state === 'idle'}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
        </svg>
        <span>Stop</span>
      </button>
    </div>
  );
}
