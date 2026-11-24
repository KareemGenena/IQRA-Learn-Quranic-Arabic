/**
 * The screen stays on while a recording plays, and for three minutes after
 * the last one stops (the author, 2026-11-23): a teacher's whole line or a
 * song is long, and a phone that dims halfway through loses the child. Three
 * minutes and no more, so a tablet left on the table still goes to sleep.
 * After that the device's own setting decides again.
 *
 * The Screen Wake Lock API: Chrome, Edge, Samsung Internet, and Safari since
 * 16.4 (in a Home Screen app since iOS 18.4). Where it is missing or refused
 * — battery saver, a hidden page — nothing happens and nothing breaks. The
 * system drops the lock whenever the page is hidden; it is asked for again
 * when the page comes back inside the three minutes.
 */

const AFTER_MS = 3 * 60 * 1000;

let sentinel: WakeLockSentinel | null = null;
let asking = false;
/** Recordings sounding right now (a paused one is not sounding). */
let sounding = 0;
/** Within the window: something is playing, or stopped less than three minutes ago. */
let wanted = false;
let timer = 0;

async function acquire(): Promise<void> {
  if (asking || (sentinel && !sentinel.released)) return;
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  if (document.visibilityState !== 'visible') return;
  asking = true;
  try {
    const s = await navigator.wakeLock.request('screen');
    if (!wanted) {
      void s.release().catch(() => undefined);
      return;
    }
    sentinel = s;
    s.addEventListener('release', () => {
      if (sentinel === s) sentinel = null;
    });
  } catch {
    // refused: low battery, a policy, no visible page — the screen does as it would
  } finally {
    asking = false;
  }
}

function release(): void {
  wanted = false;
  const s = sentinel;
  sentinel = null;
  if (s && !s.released) void s.release().catch(() => undefined);
}

/** A recording began (or resumed) sounding. */
export function soundStarted(): void {
  sounding += 1;
  wanted = true;
  window.clearTimeout(timer);
  void acquire();
}

/** A recording stopped, ended or paused: three minutes from the last one. */
export function soundStopped(): void {
  sounding = Math.max(0, sounding - 1);
  if (sounding > 0) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(release, AFTER_MS);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted) void acquire();
  });
}
