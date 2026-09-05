import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

// Unterpfad beim Hosting (z. B. GitHub Pages unter /zoa-app). Muss dem Plugin
// ausdruecklich mitgeteilt werden - es bildet index.html sonst auf "/" ab und
// der Service Worker versucht, die falsche Adresse vorzuhalten.
const BASE = process.env.BASE_PATH ?? '';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: false, // eigenes manifest.webmanifest in static/
      kit: {
        base: `${BASE}/`,
        // Die SPA-Rueckfallseite muss im Precache liegen, sonst kann der
        // Service Worker tiefe Routen (/statistik) offline nicht bedienen.
        adapterFallback: '200.html',
        // adapter-static legt 200.html direkt in build/ ab, ausserhalb des
        // Ordners, den das Plugin durchsucht. Ueber `spa` wird der Eintrag
        // trotzdem in den Precache aufgenommen; die Revision aendert sich mit
        // jedem Build, damit die Datei nach einem Deploy neu geholt wird.
        spa: { fallbackRevision: async () => String(Date.now()) }
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${BASE}/200.html`,
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
