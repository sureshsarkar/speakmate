import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.VITE_PROXY_TARGET || 'http://localhost:5000';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: 'SpeakMate - Random English Speaking Practice',
          short_name: 'SpeakMate',
          description: "Don't learn English alone. Speak English with the world.",
          start_url: '/home',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#FFFFFF',
          theme_color: '#7ED957',
          categories: ['education'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Push + notification click handlers live in public/push-sw.js
          importScripts: ['push-sw.js'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: api, changeOrigin: true },
        '/socket.io': { target: api, ws: true, changeOrigin: true },
      },
    },
    build: { sourcemap: false, chunkSizeWarningLimit: 700 },
  };
});
