/// <reference types="vitest/config" />
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
        name: 'BrainLink',
        short_name: 'BrainLink',
        description: 'Neurofeedback z opaską fNIRS Mendi lub EEG BrainAccess HALO: trening skupienia, równowaga półkul, gry, sygnał na żywo, sesje zapisane lokalnie.',
        lang: 'pl',
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
        navigateFallbackDenylist: [/\/holyholyholy(3d)?(\/|$)/],
        globIgnores: ['holyholyholy/**', 'holyholyholy3d/**'],
        // Off on purpose: Workbox deletes every "-precache-" cache whose name contains this SW's scope, and the
        // game's cache name (…-precache-v2-<scope>holyholyholy/) does, so each BrainLink update would wipe the
        // game's offline copy. Precache v2 already prunes its own stale entries.
        cleanupOutdatedCaches: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts', 'game/test/**/*.test.ts', 'game3d/test/**/*.test.ts'],
  },
});
