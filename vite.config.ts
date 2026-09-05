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
        // Bewusst KEIN Laufzeit-Cache fuer Livedaten und Webcams.
        // Ein Service Worker, der API-Antworten zwischenspeichert, liefert sie
        // offline als normalen Erfolg aus - die App haelt sie dann fuer frisch
        // und zeigt "gerade eben" statt "Keine Verbindung". Den Rueckfall auf
        // den letzten bekannten Stand macht die Adapter-Schicht selbst, und
        // zwar mit dem echten Zeitstempel. Der Service Worker haelt nur die
        // App-Huelle vor (Precache oben), damit die App offline startet.
        runtimeCaching: []
      }
    })
  ]
});
