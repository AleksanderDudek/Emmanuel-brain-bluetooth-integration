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
        name: 'BrainLink fNIRS',
        short_name: 'BrainLink',
        description: 'Neurofeedback z opaską fNIRS Mendi: hemodynamika na żywo, trening równowagi półkul, sesje zapisane lokalnie.',
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
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
