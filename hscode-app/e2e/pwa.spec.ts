import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type BrowserContext, type Request } from '@playwright/test'
import en from '../src/i18n/en.json' with { type: 'json' }

/**
 * The installable PWA, against `vite preview` of a non-emulator build in .pwa-preview/ (the `pwa`
 * Playwright project). That build carries the production Firebase config, so every request that could
 * reach Google or Firebase is aborted: this spec never touches production. The app shows its index error
 * state, which is fine; only the shell, the service worker, the manifest and offline reload are checked.
 */

const SW_FILE = fileURLToPath(new URL('../.pwa-preview/sw.js', import.meta.url))
// A 1x1 transparent PNG for OpenStreetMap tiles.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function blockProduction(context: BrowserContext) {
  await context.route(/^https?:\/\/([^/]+\.)?googleapis\.com\//, (r) => r.abort())
  await context.route(/^https?:\/\/www\.google\.com\/recaptcha/, (r) => r.abort())
  await context.route(/^https?:\/\/www\.gstatic\.com\//, (r) => r.abort())
  await context.route(/^https?:\/\/([^/]+\.)?firebaseapp\.com\//, (r) => r.abort())
  await context.route(/^https?:\/\/([^/]+\.)?tile\.openstreetmap\.org\//, (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  )
}

const swReady = () => navigator.serviceWorker.ready.then((r) => r.scope)

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ context }) => {
  await blockProduction(context)
  await context.addInitScript(() => localStorage.setItem('hscode.introSeen', '1'))
})

test('index.html links the manifest, scoped to /hscode/ with the three icons', async ({ page, request }) => {
  await page.goto('./')
  const link = page.locator('link[rel="manifest"]')
  await expect(link).toHaveAttribute('href', '/hscode/manifest.webmanifest')
  const res = await request.get('/hscode/manifest.webmanifest')
  expect(res.ok()).toBe(true)
  const m = await res.json()
  expect(m).toMatchObject({ name: 'HSCode', short_name: 'HSCode', start_url: '/hscode/', scope: '/hscode/', display: 'standalone' })
  expect(m.icons.map((i: { src: string }) => i.src).sort()).toEqual(
    ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'].map((s) => expect.stringContaining(s)),
  )
  expect(m.icons.find((i: { purpose?: string }) => i.purpose === 'maskable')?.src).toContain('icon-maskable-512.png')
  for (const icon of m.icons as { src: string }[]) {
    const r = await request.get(new URL(icon.src, res.url()).href)
    expect(r.ok(), icon.src).toBe(true)
    expect(r.headers()['content-type']).toContain('image/png')
  }
})

test('the service worker registers with scope /hscode/', async ({ page }) => {
  await page.goto('./')
  const scope = await page.evaluate(swReady)
  expect(scope).toMatch(/\/hscode\/$/)
  expect(new URL(scope).pathname).toBe('/hscode/')
})

test('after the first load, an offline reload still renders the app shell; Firestore never goes through the SW', async ({
  context,
  page,
}) => {
  const firestore: Request[] = []
  context.on('request', (r) => {
    if (r.url().includes('firestore.googleapis.com')) firestore.push(r)
  })
  const servedBySw: string[] = []
  page.on('response', (r) => {
    if (r.url().includes('firestore.googleapis.com') && r.fromServiceWorker()) servedBySw.push(r.url())
  })

  await page.goto('./')
  await expect(page.getByRole('banner').getByRole('img', { name: 'HSCode' })).toBeVisible()
  await page.evaluate(swReady)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('banner').getByRole('img', { name: 'HSCode' })).toBeVisible()
  await expect(page.getByRole('button', { name: en.menu.open })).toBeVisible()
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  // A deep link works offline too (navigateFallback to the precached index.html).
  await page.goto('./survey')
  await expect(page.getByRole('banner').getByRole('img', { name: 'HSCode' })).toBeVisible()
  await context.setOffline(false)

  expect(servedBySw).toEqual([])
  // The SW never re-issues a Firestore request on the page's behalf (no fetch handler matched it).
  expect(firestore.filter((r) => r.serviceWorker() !== null).map((r) => r.url())).toEqual([])
})

test('a new deploy while the tab is open shows the Update banner, never a forced reload; Reload switches', async ({ page }) => {
  const original = readFileSync(SW_FILE)
  try {
    await page.goto('./')
    await page.evaluate(swReady)
    // Controlled from here on (the first visit has no controller until a navigation).
    await page.reload()
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await expect(page.getByText(en.pwa.updateTitle)).toHaveCount(0)

    await page.evaluate(() => ((window as unknown as { __session: string }).__session = 'kept'))
    appendFileSync(SW_FILE, `\n// e2e new deploy ${Date.now()}\n`)
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()))

    await expect(page.getByText(en.pwa.updateTitle)).toBeVisible({ timeout: 20000 })
    // No reload happened: the page's own state survived.
    expect(await page.evaluate(() => (window as unknown as { __session?: string }).__session)).toBe('kept')

    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: en.pwa.reload }).click()])
    await expect(page.getByRole('banner').getByRole('img', { name: 'HSCode' })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __session?: string }).__session)).toBeUndefined()
    await expect(page.getByText(en.pwa.updateTitle)).toHaveCount(0)
  } finally {
    writeFileSync(SW_FILE, original)
  }
})
