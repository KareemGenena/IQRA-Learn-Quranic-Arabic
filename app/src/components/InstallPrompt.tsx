import { useCallback, useEffect, useState } from 'react';

/**
 * Offer, once, to install the app.
 *
 * The first time someone opens the link a small card rises from the bottom —
 * not a modal, nothing behind it is blocked — asking whether to install IQRA
 * as an app (the author, 2026-10-25). "Install" does what this browser
 * allows:
 *
 * - Chrome, Edge and Samsung Internet on Android, and Chrome and Edge on a
 *   computer, hand the page an install prompt (`beforeinstallprompt`); the
 *   card calls it, and once the browser says the app is installed the card
 *   says so and where to find it.
 * - iPhone and iPad have no such prompt in any browser: the only way is
 *   Share → Add to Home Screen, so the card shows those three steps.
 * - Anywhere else, the card says where the browser keeps its own install
 *   or add-to-home-screen command.
 *
 * "Not now" is remembered, and the card does not come back by itself; the
 * contents drawer has "Install as an app" for later (it sends the
 * `iqra:install` event). Nothing shows when the app is already running
 * installed, or on a computer whose browser cannot install it.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The browser's install prompt, kept from the moment it is offered —
 *  which can be before React has mounted anything. */
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedHere = true;
    listeners.forEach((f) => f());
  });
}
let installedHere = false;

const STORE = 'iqra-install';
/** Seconds after the first visit opens before the card rises. */
const DELAY_MS = 2500;

export const OPEN_INSTALL_EVENT = 'iqra:install';

/** Whether this device can install the app at all: a phone or tablet
 *  (any browser — the steps are shown where there is no prompt), or a
 *  computer whose browser offered its install prompt. */
export function canOfferInstall(): boolean {
  return typeof window !== 'undefined' && !runningInstalled() && (isPhoneOrTablet() || deferred !== null);
}

/** Running as an installed app: the card has nothing to offer. */
export function runningInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(navigator.userAgent);
const isPhoneOrTablet = () => isIOS() || isAndroid();
const isIOSSafari = () => isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

const read = (): string | null => {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(STORE, v);
  } catch {
    // a private window: the card simply may come back next time
  }
};

type View = 'hidden' | 'offer' | 'ios' | 'manual' | 'installing' | 'installed';

export function InstallPrompt() {
  const [view, setView] = useState<View>('hidden');
  const [, bump] = useState(0);

  useEffect(() => {
    const onChange = () => {
      bump((n) => n + 1);
      if (installedHere) setView((v) => (v === 'hidden' ? v : 'installed'));
      // Chrome hands over its prompt only after a tap and some time on the
      // page; a card already showing the menu steps goes back to the
      // one-tap offer when it arrives.
      else if (deferred) setView((v) => (v === 'manual' ? 'offer' : v));
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  // The first visit: once, a moment after the page opens.
  useEffect(() => {
    if (runningInstalled() || read()) return;
    const t = window.setTimeout(() => {
      if (runningInstalled() || read()) return;
      // A computer whose browser cannot install has nothing to offer.
      if (!isPhoneOrTablet() && !deferred) return;
      write('offered');
      setView('offer');
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  // "Install as an app" in the contents drawer.
  useEffect(() => {
    const open = () => setView(runningInstalled() ? 'installed' : canOfferInstall() ? 'offer' : 'hidden');
    window.addEventListener(OPEN_INSTALL_EVENT, open);
    return () => window.removeEventListener(OPEN_INSTALL_EVENT, open);
  }, []);

  const close = useCallback(() => {
    if (read() !== 'installed') write('dismissed');
    setView('hidden');
  }, []);

  useEffect(() => {
    if (view === 'hidden') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, close]);

  const install = async () => {
    if (deferred) {
      const prompt = deferred;
      setView('installing');
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        deferred = null;
        if (outcome === 'accepted') {
          write('installed');
          setView('installed');
        } else close();
      } catch {
        setView('manual');
      }
      return;
    }
    setView(isIOS() ? 'ios' : 'manual');
  };

  if (view === 'hidden') return null;

  const icon = <img className="install-icon" src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" />;

  return (
    <aside className="install-card" role="dialog" aria-label="Install IQRA as an app" aria-live="polite">
      <button type="button" className="install-close" onClick={close} aria-label="Close">
        ×
      </button>

      {(view === 'offer' || view === 'installing') && (
        <>
          <div className="install-head">
            {icon}
            <div>
              <strong>Install IQRA 1447 as an app?</strong>
              <p>
                {isPhoneOrTablet()
                  ? 'It opens from your home screen, full screen, like any other app — no app store needed.'
                  : 'It opens in its own window, like any other app — no app store needed.'}
              </p>
            </div>
          </div>
          <div className="install-actions">
            <button type="button" className="btn" onClick={close}>
              Not now
            </button>
            <button type="button" className="btn primary" onClick={() => void install()} disabled={view === 'installing'}>
              {view === 'installing' ? 'Installing…' : 'Install'}
            </button>
          </div>
        </>
      )}

      {view === 'ios' && (
        <>
          <div className="install-head">
            {icon}
            <div>
              <strong>Add IQRA 1447 to your home screen</strong>
              <p>On iPhone and iPad it takes three taps:</p>
            </div>
          </div>
          <ol className="install-steps">
            <li>
              Tap the <b>Share</b> button{' '}
              <svg className="install-share" viewBox="0 0 24 24" aria-label="the Share icon" role="img">
                <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 10H17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>{' '}
              {isIOSSafari()
                ? '— at the bottom of the screen, or behind ··· beside the address (at the top on an iPad).'
                : 'in the address bar, or in the browser\'s ··· menu.'}
            </li>
            <li>
              Scroll down and tap <b>Add to Home Screen</b>.
            </li>
            <li>
              Tap <b>Add</b>.
            </li>
          </ol>
          <p className="install-after">IQRA 1447 is then an app on your home screen. Open it from there from now on.</p>
          <div className="install-actions">
            <button type="button" className="btn primary" onClick={close}>
              Got it
            </button>
          </div>
        </>
      )}

      {view === 'manual' && (
        <>
          <div className="install-head">
            {icon}
            <div>
              <strong>Install IQRA 1447</strong>
              <p>This browser keeps the install command in its own menu:</p>
            </div>
          </div>
          <ol className="install-steps">
            {isAndroid() ? (
              <>
                <li>
                  Open the browser's menu (<b>⋮</b> at the top right, or <b>≡</b> at the bottom).
                </li>
                <li>
                  Tap <b>Install app</b> or <b>Add to Home screen</b>.
                </li>
              </>
            ) : (
              <>
                <li>
                  In the address bar, click the <b>install</b> icon (a screen with a down arrow), or open the browser's menu.
                </li>
                <li>
                  Choose <b>Install IQRA 1447</b>.
                </li>
              </>
            )}
          </ol>
          <div className="install-actions">
            <button type="button" className="btn primary" onClick={close}>
              Got it
            </button>
          </div>
        </>
      )}

      {view === 'installed' && (
        <>
          <div className="install-head">
            {icon}
            <div>
              <strong>{runningInstalled() ? 'IQRA 1447 is installed' : 'Installed'}</strong>
              {isPhoneOrTablet() ? (
                <p>
                  IQRA 1447 is now an app on this device. Open it from your home screen from now on. If you do not see
                  it there, find it in your list of apps, then press and hold it and drag it to the home screen.
                </p>
              ) : (
                <p>
                  IQRA 1447 is now an app on this computer. It opens in its own window — find it in the Start menu, the
                  Dock or your Applications.
                </p>
              )}
            </div>
          </div>
          <div className="install-actions">
            <button type="button" className="btn primary" onClick={close}>
              Done
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
