import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/700.css';
import './index.css';
import App from './App';

/** Dev only, and loaded only when asked for — it never joins the shell. */
const ProofPage = import.meta.env.DEV ? lazy(() => import('./pages/ProofPage').then((m) => ({ default: m.ProofPage }))) : null;

// A crash that blanks the page is otherwise invisible to the learner and to
// anyone debugging on a device with no console.
window.addEventListener('error', (e) => {
  document.documentElement.dataset.lastError = `${e.message} @ ${e.filename}:${e.lineno}`;
});

/** How often to ask again while the app is left open. */
const UPDATE_INTERVAL_MS = 15 * 60 * 1000;

/** How long to give the new worker after a newer build is known to exist. */
const WORKER_GRACE_MS = 12 * 1000;

/**
 * Ask the server which build it is serving — a tiny `version.json` written
 * at build time, left out of the precache and served `no-cache` — and compare
 * it with the build this page was loaded with. The worker's own update check
 * is what should notice a new build, but a phone sat on the 27 September
 * build through several refreshes on 4 October: whatever a browser decides
 * about a worker's update check, a fetch with `no-store` reaches the server.
 * If the server is ahead, the worker is asked to update; if the page is
 * still the old one after a grace period, it reloads itself — once per build,
 * so a server that is ahead of a worker that cannot update never loops.
 */
async function pollVersion(registration: ServiceWorkerRegistration): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (!build || build === __BUILD_ID__) return;
    const key = 'iqra-reloaded-for';
    if (sessionStorage.getItem(key) === build) return;
    sessionStorage.setItem(key, build);
    await registration.update().catch(() => undefined);
    window.setTimeout(() => window.location.reload(), WORKER_GRACE_MS);
  } catch {
    // Offline. The next check will do.
  }
}

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
        void pollVersion(registration);
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

/**
 * The proof sheet, dev only: `#/proof/N?from=A&to=B` draws cards A–B of
 * lesson N large, one per row, for `scripts/snap-proof.mjs` to photograph.
 * It never reaches a build — a draft lesson's text is already public in its
 * words.json, but the page has no place in the app.
 */
const proof = import.meta.env.DEV ? /^#\/proof\/(\d+)(?:\?from=(\d+)&to=(\d+)(?:&px=(\d+))?(?:&card=(\d+))?)?/.exec(window.location.hash) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {proof && ProofPage ? (
      <Suspense fallback={null}>
        <ProofPage lessonId={Number(proof[1])} from={Number(proof[2] ?? 1)} to={Number(proof[3] ?? 9999)} px={proof[4] ? Number(proof[4]) : undefined} card={proof[5] ? Number(proof[5]) : undefined} />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
