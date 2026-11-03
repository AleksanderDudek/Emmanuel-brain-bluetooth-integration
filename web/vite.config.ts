/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/ — set BASE_PATH there; '/' everywhere else.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    sourcemap: true,
    // keep fonts as files: the CSP allows font-src 'self' only, and files cache better
    assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
    // two pages: the app, and the exercise cards' pad for a second screen (src/cards/pad/main.ts)
    rolldownOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), pad: resolve(import.meta.dirname, 'pad.html') } },
  },
  plugins: [
    {
      // The dev server injects CSS through <style> tags; the build extracts it to files,
      // so production can drop 'unsafe-inline' (the code only touches styles via CSSOM).
      name: 'strict-csp-in-build',
      apply: 'build',
      transformIndexHtml: html => html.replace("style-src 'self' 'unsafe-inline'", "style-src 'self'"),
    },
    VitePWA({
      // 'prompt', not 'autoUpdate': a silent reload in the middle of a recording would lose it
      registerType: 'prompt',
      pwaAssets: { config: true },
      manifest: {
        name: 'Emmanuel',
        short_name: 'Emmanuel',
        // one manifest for four languages (pl, en, de, sv): English is the shared one
        description: 'Emmanuel — God with us. Neurofeedback that trains the stillness where prayer begins: focus training, contemplative games and Christian games for the Mendi (fNIRS) and BrainAccess HALO (EEG) headbands. Polish, English, German and Swedish; works offline, nothing leaves the device.',
        lang: 'en',
        theme_color: '#0a0b0d',
        background_color: '#0a0b0d',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        categories: ['health', 'medical', 'utilities'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        // the games are separate apps: dist/holyholyholy (its own PWA) and dist/holyholyholy3d (GDevelop export)
        // pad.html is its own page (the exercise cards' second screen), not the app's fallback
        // (Workbox tests the path with its query: pad.html?lang=pl must be let through too)
        navigateFallbackDenylist: [/\/holyholyholy(3d)?(\/|$)/, /\/pad\.html(\?|$)/],
        // the pad's link carries the board's language (?lang=): the precached page serves it offline
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^lang$/],
        // the exercise cards' images (4K ~9 MB, previews ~1 MB) are cached the first time they are shown,
        // not precached: the app's install stays the same size for those who never open the cards
        globIgnores: ['holyholyholy/**', 'holyholyholy3d/**', 'cards/**'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/cards/full/'),
          handler: 'CacheFirst',
          options: { cacheName: 'cards-full', expiration: { maxEntries: 40 } },
        }, {
          urlPattern: ({ url }) => url.pathname.includes('/cards/thumb/'),
          handler: 'CacheFirst',
          options: { cacheName: 'cards-thumb', expiration: { maxEntries: 40 } },
        }],
        // Off on purpose: Workbox deletes every "-precache-" cache whose name contains this SW's scope, and the
        // game's cache name (…-precache-v2-<scope>holyholyholy/) does, so each app update would wipe the
        // game's offline copy. Precache v2 already prunes its own stale entries.
        cleanupOutdatedCaches: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts', 'game/test/**/*.test.ts', 'game3d/test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    // The arcade and game3d tests play minutes of game time or load the GDevelop core: 2–4 s alone, and
    // over the 5 s default when every file runs at once on a two-core CI runner. A hang still fails.
    testTimeout: 30_000,
  },
});
