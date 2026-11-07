import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  site: process.env.PUBLIC_SITE_URL || 'https://gauravratnawat.com',
  base: process.env.PUBLIC_BASE_PATH || '/decision-ledger-setup',
  srcDir: './src',
  publicDir: './public',
  outDir: fileURLToPath(new URL('../.public-site/', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../.public-site-cache/', import.meta.url)),
  trailingSlash: 'always',
});
