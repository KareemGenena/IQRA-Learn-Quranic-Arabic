import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The version of the audio clips. Bump it when clips are RE-CUT.
 *
 * Clip filenames are stable (`audio/lesson06/word16.wav`), so a device that
 * already holds an old cut has no way to know a new one exists. This one
 * constant is the lever, and it pulls THREE caches at once:
 *
 *  - it is appended to every clip URL as `?v=` (`audioUrl` in playback.ts),
 *    which is what defeats the browser's HTTP cache and the CDN — Hosting
 *    serves `/audio/**` with `max-age=86400`, so without it a re-cut clip is
 *    invisible for a day, and a hard refresh does not help because the fetch
 *    is made by the app, not by the page load;
 *  - it names the worker's runtime cache, so an old cut kept there is not
 *    served either;
 *  - `sw-cleanup.js` (emitted below) deletes the caches of earlier versions
 *    on activate, so they do not sit on every device for ever.
 *
 * Learned the hard way: v2 renamed only the runtime cache. The worker missed
 * its new cache, fetched — and the browser's HTTP cache handed it the old clip,
 * which the worker then stored under the new name for thirty days. It costs
 * learners one re-download of the words they have played, which is the same
 * moment their calibrations need re-checking anyway.
 *
 * v3: lesson 6 كهيعص retake, 2026-09-05.
 */
const AUDIO_VERSION = 'v3';
const AUDIO_CACHE = `iqra-audio-${AUDIO_VERSION}`;

/**
 * The same idea for pictures, and for the same reason.
 *
 * IQRA Kids gives every letter a picture, so the image library grows with the
 * curriculum exactly as the clip library does — and a redrawn picture keeps its
 * filename, so a device holding the old one has no way to learn of the new one.
 * Bump this when a picture is redrawn.
 *
 * v1: the seaside letter mnemonics, 2026-09-06.
 */
const IMAGE_VERSION = 'v1';
const IMAGE_CACHE = `iqra-images-${IMAGE_VERSION}`;

/** Deletes the audio and image caches of earlier versions when a new worker
 *  takes over. `cleanupOutdatedCaches` covers the precache only. */
const SW_CLEANUP = `self.addEventListener('activate', (event) => {
  const keep = [${JSON.stringify(AUDIO_CACHE)}, ${JSON.stringify(IMAGE_CACHE)}];
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => (n.startsWith('iqra-audio-') || n.startsWith('iqra-images-')) && !keep.includes(n))
          .map((n) => caches.delete(n)),
      ),
    ),
  );
});
`;

/**
 * A human-readable stamp of when this bundle was built, shown at the foot of
 * the home page. The point is to be able to answer "did the update reach this
 * phone?" by looking at the phone, rather than by guessing from the content.
 */
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __AUDIO_VERSION__: JSON.stringify(AUDIO_VERSION), __IMAGE_VERSION__: JSON.stringify(IMAGE_VERSION) },
  plugins: [
    react(),
    {
      // The cleanup script the worker imports, written from the same constant
      // so the cache name can never drift between the two.
      name: 'iqra-sw-cleanup',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'sw-cleanup.js', source: SW_CLEANUP });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      // The registration lives in main.tsx instead, so it can ask for
      // `updateViaCache: 'none'` and drive its own update checks.
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      workbox: {
        /**
         * Precache the SHELL ONLY — the code, the font, the icons and the
         * lesson text. Roughly a megabyte, and it is what makes an update land.
         *
         * The audio used to be in here too, "so the app works fully offline".
         * That is what broke updates: a Workbox precache install is
         * all-or-nothing, so all 337 clips (65 MB) had to arrive before a new
         * version could activate. One failed fetch on a phone — or the learner
         * closing the app mid-download — discarded the whole thing and left
         * them on the old build. That is why new lessons only appeared after
         * several refreshes, and it would have got worse with every lesson.
         *
         * Audio is fetched from the network on play and cached below. Dropping
         * it from the manifest also makes the new worker DELETE the 65 MB the
         * old one is holding on every learner's device.
         */
        // `otf` is the Uthmanic Hafs face, which the whole app is written in
        // and which was never actually precached before — the old pattern
        // listed woff2 only. `woff` is left out on purpose: it is the fallback
        // for browsers with no woff2, and they can fetch it when they need it.
        globPatterns: ['**/*.{js,css,html,svg,png,otf,woff2,json}'],
        // Pictures are left out for the same reason clips are: the precache
        // install is all-or-nothing, and IQRA Kids adds one picture per letter
        // — a library that grows with the curriculum. The shell must not.
        globIgnores: ['**/audio/**', '**/images/**'],
        cleanupOutdatedCaches: true,
        // `cleanupOutdatedCaches` covers the precache only; the audio caches of
        // earlier AUDIO_VERSIONs are removed by this script.
        importScripts: ['sw-cleanup.js'],
        runtimeCaching: [
          {
            // Played once, kept for next time. Capped by count and by age, so
            // it cannot grow with the corpus — a learner holds the clips they
            // have worked through, never the whole library.
            urlPattern: ({ url }) => url.pathname.includes('/audio/') && url.pathname.endsWith('.wav'),
            handler: 'CacheFirst',
            options: {
              cacheName: AUDIO_CACHE,
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                purgeOnQuotaError: true,
              },
              /**
               * The status is not enough on this host. Hosting rewrites `**`
               * to index.html, so a clip that is not there answers 200 with an
               * HTML page rather than 404 — and CacheFirst would then keep
               * that page as the recording for a month. Only something the
               * server calls audio is worth storing. Anything else falls
               * through to the network every time, which is the safe failure.
               */
              cacheableResponse: { statuses: [200], headers: { 'Content-Type': 'audio/wav' } },
            },
          },
          // Letter pictures, waveforms, diagrams — seen once, kept for next
          // time. Split by type because the clips' lesson applies here too:
          // Hosting rewrites a missing path to index.html and answers 200 with
          // HTML, and CacheFirst would keep that as the picture. Workbox can
          // only match an exact header value, so there is one rule per type
          // rather than a "starts with image/" test.
          ...['image/png', 'image/svg+xml'].map((type) => ({
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.includes('/images/') &&
              url.pathname.endsWith(type === 'image/png' ? '.png' : '.svg'),
            handler: 'CacheFirst' as const,
            options: {
              cacheName: IMAGE_CACHE,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 60,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [200], headers: { 'Content-Type': type } },
            },
          })),
        ],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'IQRA — Learn Quranic Arabic',
        short_name: 'IQRA',
        description: 'Learn to read and pronounce Quranic Arabic, letter by letter.',
        start_url: '.',
        display: 'standalone',
        background_color: '#ffffff',
        // The brand green of the New Logo mark. The in-app accent palette in
        // index.css is still the old blue — the author has seen that contrast
        // and chose it; match the bar to the brand, not to the buttons.
        theme_color: '#14513A',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
