import { defineConfig, devices } from '@playwright/test'

const PWA_SPEC = /pwa\.spec\.ts$/
const PWA_URL = 'http://localhost:4174/hscode/'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174/hscode/',
    // The location step needs a GPS fix: a fixed position near 6th of October City, accuracy 15 m.
    permissions: ['geolocation'],
    geolocation: { latitude: 29.968, longitude: 30.94, accuracy: 15 },
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: PWA_SPEC,
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: 'desktop', testIgnore: PWA_SPEC, use: { viewport: { width: 1280, height: 800 } } },
    {
      // The installable PWA against `vite preview` of a production-mode build in .pwa-preview/ (never
      // ../hscode). Needs no emulator: pwa.spec.ts aborts every Google/Firebase request.
      name: 'pwa',
      testMatch: PWA_SPEC,
      use: { baseURL: PWA_URL, viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      // Always our own emulator-mode server on a dedicated port: never reuse a dev server that may
      // point at production (hscode-egypt).
      command: 'npx vite --mode emulator --port 5174 --strictPort',
      url: 'http://localhost:5174/hscode/',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      // A scratch production build with the service worker; ../hscode is never written here.
      command: 'npx vite build --outDir .pwa-preview --emptyOutDir && npx vite preview --outDir .pwa-preview --port 4174 --strictPort',
      url: PWA_URL,
      reuseExistingServer: false,
      timeout: 180000,
    },
  ],
})
