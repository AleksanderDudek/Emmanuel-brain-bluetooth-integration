/// <reference types="vitest/config" />
/**
 * Second app in this package: the game HolyHolyHoly (web/game), served from
 * <base>/holyholyholy/ as its own installable PWA. It reuses BrainLink's
 * modules (Mendi Bluetooth, fNIRS pipeline, balance tracker) from ../src.
 */
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = `${process.env.BASE_PATH ?? '/'}holyholyholy/`;

export default defineConfig({
  root: 'game',
  base,
  publicDir: 'public',
  build: {
    outDir: '../dist/holyholyholy',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  server: { fs: { allow: ['..'] } },
  plugins: [
    {
      // dev injects CSS via <style>; the build has none, so production drops 'unsafe-inline'
      name: 'strict-csp-in-build',
      apply: 'build',
      transformIndexHtml: html => html.replace("style-src 'self' 'unsafe-inline'", "style-src 'self'"),
    },
    VitePWA({
      // never reload by itself in the middle of a room
      registerType: 'prompt',
      injectRegister: 'auto',
      pwaAssets: { config: true },
      manifest: {
        name: 'HolyHolyHoly',
        short_name: 'HolyHolyHoly',
        description: 'Anioł stróż, który zjada i trawi traumy, zamieniając je w prawdę i moc. Chorał, modlitwa, opcjonalnie opaska Mendi.',
        lang: 'pl',
        theme_color: '#07080f',
        background_color: '#07080f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        categories: ['games', 'lifestyle', 'health'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
