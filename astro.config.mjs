import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

const SITE_URL = process.env.SITE_URL ?? 'https://blog.coada.dev';

export default defineConfig({
  site: SITE_URL,
  // Astro 5+ defaults to static output. The /api/subscribe route opts into
  // server rendering with `export const prerender = false`.
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
