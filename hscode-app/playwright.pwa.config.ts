import { defineConfig } from '@playwright/test'

const URL = 'http://localhost:4174/hscode/'

/**
 * The installable PWA (npm run e2e:pwa), apart from the emulator e2e so neither starts the other's server.
 * It runs against `vite preview` of a production-mode build in .pwa-preview/ (never ../hscode). It needs
 * no emulator: e2e-pwa/pwa.spec.ts aborts every Google/Firebase request, so it never touches production.
 */
export default defineConfig({
  testDir: 'e2e-pwa',
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/pwa' }]],
  outputDir: 'test-results/pwa',
  projects: [{ name: 'pwa', use: { baseURL: URL, viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: 'npx vite build --outDir .pwa-preview --emptyOutDir && npx vite preview --outDir .pwa-preview --port 4174 --strictPort',
    url: URL,
    reuseExistingServer: false,
    timeout: 180000,
  },
})
