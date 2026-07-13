import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      workbox: {
        // Precache everything, audio included, so the app works fully offline.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,wav,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'IQRA — Learn Quranic Arabic',
        short_name: 'IQRA',
        description: 'Learn to read and pronounce Quranic Arabic, letter by letter.',
        start_url: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1c5f8f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
