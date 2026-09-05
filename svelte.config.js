import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Rein statischer Export: laeuft auf GitHub Pages, Cloudflare Pages, Vercel Free.
    // fallback = SPA-Fallback, damit tiefe Routen auch ohne Server-Rewrites funktionieren.
    adapter: adapter({ pages: 'build', assets: 'build', fallback: '200.html', precompress: false }),
    paths: { base: process.env.BASE_PATH ?? '' },
    alias: { $lib: 'src/lib' }
  }
};
