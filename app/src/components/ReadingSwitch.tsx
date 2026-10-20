import type { Reading } from '../types';

/**
 * The page's reading switch — which AUDIO every word plays.
 *
 * "Read on": the word as it is read when the reading carries on into the next
 * word, with its final vowel. "At a stop": as it is read when you pause on it
 * — the final vowel dropped, a ة heard as ه, a madd before the stop held.
 * Labelled as audio and explained in one line, because the bare pair of words
 * read as a mystery to the author (2026-10-20). The single key S flips it.
 */
export function ReadingSwitch({ reading, setReading }: { reading: Reading; setReading: (r: Reading) => void }) {
  return (
    <div className="reading-switch">
      <span className="reading-label" id="reading-label">
        Hear each word
      </span>
      <div className="rate-group reading-group" role="group" aria-labelledby="reading-label">
        {(['continuing', 'stop'] as const).map((r) => (
          <button
            key={r}
            type="button"
            className={`rate-btn ${r === reading ? 'active' : ''}`}
            aria-pressed={r === reading}
            title={
              r === 'stop'
                ? 'As read when you pause on the word: the last vowel dropped, a madd before it held'
                : 'As read when the reading carries on: the word with its last vowel'
            }
            onClick={() => setReading(r)}
          >
            {r === 'stop' ? 'at a stop' : 'read on'}
          </button>
        ))}
      </div>
      <span className="reading-tip">
        {reading === 'stop'
          ? 'Each word as read when you pause on it — the last vowel dropped. Press S to switch.'
          : 'Each word with its last vowel, as when the reading carries on. Press S to switch.'}
      </span>
    </div>
  );
}
