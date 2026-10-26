import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { APP_CHUNKS_CACHE } from './src/pwa/cacheNames.ts'

// Brand tokens (src/styles/index.css): brand-500 and surface.
const THEME_COLOR = '#ffc53d'
const BACKGROUND_COLOR = '#ffffff'

/**
 * The app shell (spec §7): the entry chunk and everything it imports statically, with their CSS and
 * assets, i.e. what index.html loads through <script type=module>, modulepreload and stylesheet links.
 * Collected from the final bundle; the precache keeps only these under assets/ (plus index.html, the
 * manifest, favicon and icons). Lazy route chunks are runtime-cached instead.
 */
const shell = new Set<string>()
const appShell: Plugin = {
  name: 'hscode:pwa-app-shell',
  apply: 'build',
  generateBundle(_, bundle) {
    shell.clear()
    const visit = (fileName: string) => {
      const chunk = bundle[fileName]
      if (shell.has(fileName) || chunk?.type !== 'chunk') return
      shell.add(fileName)
      for (const f of chunk.viteMetadata?.importedCss ?? []) shell.add(f)
      for (const f of chunk.viteMetadata?.importedAssets ?? []) shell.add(f)
      for (const f of chunk.imports) visit(f)
    }
    for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) visit(chunk.fileName)
  },
}

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
      appShell,
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
          // Precache the app shell only: under assets/, just what index.html loads (see appShell).
          manifestTransforms: [
            async (entries) => {
              if (!shell.size) throw new Error('hscode:pwa-app-shell found no entry chunk to precache')
              return { manifest: entries.filter((e) => !e.url.startsWith('assets/') || shell.has(e.url)), warnings: [] }
            },
          ],
          // Runtime caching: lazy route chunks (and their assets) and OSM tiles only. Firestore, Google auth,
          // reCAPTCHA and Analytics have no route, so the service worker never touches them (check-build
          // asserts it).
          runtimeCaching: [
            {
              urlPattern: /\/hscode\/assets\//,
              handler: 'StaleWhileRevalidate',
              // Hashed, immutable files. ignoreVary: a `Vary: Origin` response (vite preview, CORS) must still
              // match the page's module-script request, which carries Origin while the cached one may not.
              options: { cacheName: APP_CHUNKS_CACHE, expiration: { maxEntries: 60 }, matchOptions: { ignoreVary: true } },
            },
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
