import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Eigene Konfiguration statt vite.config.ts: Die Tests pruefen reine
// Logikfunktionen und brauchen weder SvelteKit noch das PWA-Plugin.
export default defineConfig({
  resolve: {
    alias: { $lib: resolve('./src/lib'), '$app/environment': resolve('./src/lib/test/app-environment.ts') }
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
