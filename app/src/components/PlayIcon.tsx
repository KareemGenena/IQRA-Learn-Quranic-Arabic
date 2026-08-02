export function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <span className="play-icon" aria-hidden="true">
      {playing ? (
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
