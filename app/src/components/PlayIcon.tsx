/** The play / pause glyph on a word, and a dotted ring while the clip is on
 *  its way — so a tap that waits on a download looks like one. */
export function PlayIcon({ playing, loading = false }: { playing: boolean; loading?: boolean }) {
  return (
    <span className={`play-icon${loading ? ' loading' : ''}`} aria-hidden="true">
      {loading && !playing ? (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        </svg>
      ) : playing ? (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
