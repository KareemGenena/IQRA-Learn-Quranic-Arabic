import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The runtime cache holding audio clips a learner has actually played.
 *
 * Bump this when clips are RE-CUT. Clip filenames are stable (`audio/lesson05/
 * 12.wav`), so a device that already holds an old cut has no way to know a new
 * one exists — a fresh cache name is the lever that makes every device fetch
 * again. It costs those learners one re-download of the words they have played,
 * which is the same moment their calibrations need re-checking anyway.
 */
const AUDIO_CACHE = 'iqra-audio-v1';

/**
 * A human-readable stamp of when this bundle was built, shown at the foot of
 * the home page. The point is to be able to answer "did the update reach this
 * phone?" by looking at the phone, rather than by guessing from the content.
 */
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
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
        globIgnores: ['**/audio/**'],
        cleanupOutdatedCaches: true,
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
