import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

const SITE_URL = process.env.SITE_URL ?? 'https://blog.coada.dev';

export default defineConfig({
  site: SITE_URL,
  // Hybrid lets the entire site prerender to static HTML except the one
  // /api/subscribe route, which opts into server rendering with
  // `export const prerender = false`.
  output: 'hybrid',
  adapter: vercel(),
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
