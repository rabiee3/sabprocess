import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Brand tokens (src/styles/index.css): brand-500 and surface.
const THEME_COLOR = '#ffc53d'
const BACKGROUND_COLOR = '#ffffff'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // No service worker in emulator builds (e2e against the emulators). `disable` keeps
  // virtual:pwa-register resolvable as a no-op, so the app code needs no branch. Dev never gets one
  // either (devOptions.enabled: false). Vitest cannot load the plugin's virtual module, so tests drop the
  // plugin and alias the module to the plugin's own no-op register (below).
  const isTest = mode === 'test' || !!process.env.VITEST
  const pwaDisabled = mode === 'emulator' || env.VITE_USE_EMULATOR === 'true' || process.env.VITE_USE_EMULATOR === 'true'

  return {
    base: '/hscode/',
    plugins: [
      react(),
      tailwindcss(),
      !isTest &&
      VitePWA({
        disable: pwaDisabled,
        registerType: 'prompt',
        injectRegister: false,
        scope: '/hscode/',
        base: '/hscode/',
        // public/ already holds favicon.svg and icons/*.png; globPatterns precaches them.
        includeManifestIcons: false,
        manifest: {
          name: 'HSCode',
          short_name: 'HSCode',
          start_url: '/hscode/',
          scope: '/hscode/',
          display: 'standalone',
          theme_color: THEME_COLOR,
          background_color: BACKGROUND_COLOR,
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: '/hscode/index.html',
          navigateFallbackAllowlist: [/^\/hscode\//],
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Only OSM tiles are cached at runtime. Firestore, Google auth, reCAPTCHA and Analytics have no
          // route, so the service worker never touches them (check-build asserts it).
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-tiles',
                expiration: { maxEntries: 400, maxAgeSeconds: 2592000 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: { outDir: '../hscode', emptyOutDir: true },
    test: {
      alias: { 'virtual:pwa-register': 'vite-plugin-pwa/dist/client/dev/register.js' },
      // Every test run (unit and rules) targets the emulators / demo-hscode, never production.
      env: { VITE_USE_EMULATOR: 'true' },
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            globals: true,
            environment: 'jsdom',
            setupFiles: ['src/test-setup.ts'],
            include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
          },
        },
        {
          extends: true,
          test: {
            name: 'rules',
            globals: true,
            environment: 'node',
            include: ['tests/rules/**/*.rules.test.ts'],
            fileParallelism: false,
            testTimeout: 20000,
            hookTimeout: 30000,
          },
        },
      ],
    },
  }
})
