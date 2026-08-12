import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/700.css';
import './index.css';
import App from './App';

// A crash that blanks the page is otherwise invisible to the learner and to
// anyone debugging on a device with no console.
window.addEventListener('error', (e) => {
  document.documentElement.dataset.lastError = `${e.message} @ ${e.filename}:${e.lineno}`;
});

/** How often to ask again while the app is left open. */
const UPDATE_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Take a new version as soon as one lands.
 *
 * The service worker is built with skipWaiting and clientsClaim, so a new one
 * activates and takes over straight away — but the page carries on running the
 * JavaScript it loaded with, and nothing ever asked it to reload. An installed
 * PWA has no address bar and rarely gets refreshed, so it could sit on a
 * months-old build while every deploy quietly passed it by.
 *
 * `controllerchange` fires on first install too, which is not an update, so
 * this only reloads when the page already had a controller to replace.
 *
 * Three things have to hold for an update to actually reach a learner, and
 * this app has been bitten by all three:
 *
 *  1. The browser must NOTICE. It only checks on its own terms, and an
 *     installed app can be reopened for weeks without a navigation it counts.
 *     So we ask at launch, whenever the app comes forward, and on a timer for
 *     a session left open all evening.
 *  2. The check must not be answered from the HTTP cache. Hosting serves
 *     everything with `max-age`, so `updateViaCache: 'none'` says: for this
 *     worker and the scripts it imports, always go to the network. (The
 *     registration is ours rather than the one vite-plugin-pwa injects for
 *     exactly this reason.)
 *  3. The new worker must be able to FINISH INSTALLING. That is the one that
 *     was really hurting: the precache was 65 MB of audio, all-or-nothing, so
 *     a single failed fetch threw the whole update away. See vite.config.ts —
 *     the shell is now about a megabyte and the audio is fetched on play.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    })
    .then((registration) => {
      const checkForUpdate = () => {
        if (document.visibilityState !== 'visible') return;
        void registration.update().catch(() => {
          // Offline, or the check was throttled. The next one will do.
        });
      };
      checkForUpdate();
      document.addEventListener('visibilitychange', checkForUpdate);
      window.addEventListener('focus', checkForUpdate);
      window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
    })
    .catch(() => {
      // No worker means no offline and no auto-update, but the app itself is
      // served straight from the network and works exactly as it always did.
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
