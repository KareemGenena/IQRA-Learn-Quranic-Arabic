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
 */
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  // Installed apps can stay open for days without a navigation, which is when
  // the browser would otherwise check. Ask again whenever it comes forward.
  const checkForUpdate = () => {
    if (document.visibilityState === 'visible') {
      void navigator.serviceWorker.getRegistration().then((r) => r?.update());
    }
  };
  document.addEventListener('visibilitychange', checkForUpdate);
  window.addEventListener('focus', checkForUpdate);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
