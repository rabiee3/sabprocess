import { defineConfig, devices } from '@playwright/test'

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
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop',
      // Full Chromium (new headless), not the default chrome-headless-shell: on desktop the Google sign-in
      // popup is a separate window, and the headless shell stalls the opener's Auth-emulator helper iframe
      // behind it, so the popup's result never arrives and sign-in hangs (client.spec (f)).
      use: { channel: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // Always our own emulator-mode server on a dedicated port: never reuse a dev server that may
    // point at production (hscode-egypt).
    command: 'npx vite --mode emulator --port 5174 --strictPort',
    url: 'http://localhost:5174/hscode/',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
