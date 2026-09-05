import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: false, // eigenes manifest.webmanifest in static/
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/200.html',
        runtimeCaching: [
          {
            // Livedaten: erst Netz, bei Ausfall der letzte bekannte Stand.
            urlPattern: /^https:\/\/(mobility|tourism)\.api\.opendatahub\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'odh-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /^https:\/\/static-verkehr\.provinz\.bz\.it\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'verkehrsbericht',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            // Jahresstatistik aendert sich selten - Cache zuerst.
            urlPattern: /^https:\/\/geoservices1\.civis\.bz\.it\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'astat-wfs',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 }
            }
          },
          {
            // Webcam-Bilder nie lange cachen, sonst zeigt die App altes Wetter.
            urlPattern: /\.(?:jpg|jpeg|png)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'webcams',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 30 }
            }
          }
        ]
      }
    })
  ]
});
