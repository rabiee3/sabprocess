import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import en from '../src/i18n/en.json' with { type: 'json' }
import ar from '../src/i18n/ar.json' with { type: 'json' }

// Seeded by seed/seed-emulator.ts (approved and public).
const FACTORY_ID = 'demo-feed-mill'
const KEY = 'hscode.introSeen'

test.beforeEach(async ({ page }) => {
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }))
})

async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
}

const intro = (page: Page, s = en) => page.getByRole('dialog', { name: s.home.headline })
/** The map has rendered (its search box is there), so "no intro" is a real answer, not a race. */
const mapReady = (page: Page) => expect(page.locator('main [role="combobox"]')).toBeAttached()
const seen = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY)
const menuButton = (page: Page) => page.getByRole('banner').getByRole('button', { name: en.menu.open })
const noHScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test('first visit: the intro is over an inert map, passes axe in EN and AR, and "Find factories" closes it for good', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await open(page, './')
  await expect(intro(page)).toBeVisible()
  await expect(page.locator('main')).toHaveAttribute('inert', '')
  await expect(intro(page).getByRole('heading', { level: 1 })).toBeFocused()
  await expect(intro(page).locator('a[href$="/survey"]')).toHaveCount(0)

  for (const lang of ['en', 'ar'] as const) {
    const s = lang === 'en' ? en : ar
    await intro(page).locator(`button[lang="${lang}"]`).click()
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await expect(intro(page, s)).toBeVisible()
    expect(await noHScroll(page)).toBe(true)
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  }
  await intro(page, ar).locator('button[lang="en"]').click()

  // Phone: the hero button; desktop: the (empty) search's submit. Only one is visible at each size.
  await intro(page).getByRole('button', { name: en.home.findFactories }).click()
  await expect(intro(page)).toHaveCount(0)
  await expect(page.locator('main')).not.toHaveAttribute('inert')
  expect(await seen(page)).toBe('1')

  await page.reload()
  await mapReady(page)
  await expect(intro(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Escape and ✕ close it too', async ({ page }) => {
  await open(page, './')
  await expect(intro(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(intro(page)).toHaveCount(0)
  expect(await seen(page)).toBe('1')

  await page.evaluate((k) => localStorage.removeItem(k), KEY)
  await page.reload()
  await intro(page).getByRole('button', { name: en.intro.close }).click()
  await expect(intro(page)).toHaveCount(0)
  expect(await seen(page)).toBe('1')
})

test('a search from the intro lands on /?q= with results', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the intro search box is desktop-only')
  await open(page, './')
  await intro(page).getByRole('searchbox', { name: en.home.searchLabel }).fill('feed')
  await page.keyboard.press('Enter')
  await expect(intro(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/hscode\/\?q=feed$/)
  await expect(page.getByLabel(en.map.resultsLabel, { exact: true }).locator('article').first()).toBeVisible()
})

test('a deep link with a query never shows it', async ({ page }) => {
  await open(page, './?q=feed')
  await mapReady(page)
  await expect(intro(page)).toHaveCount(0)
  expect(await seen(page)).toBeNull()
})

test('a factory page never shows it', async ({ page }) => {
  await open(page, `f/${FACTORY_ID}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('menu → "About HSCode" reopens it; closing returns focus to ☰ and keeps the key', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '1'), KEY)
  await open(page, './')
  await mapReady(page)
  await expect(intro(page)).toHaveCount(0)
  await menuButton(page).click()
  const items = page.getByRole('menu').getByRole('menuitem')
  await expect(items).toHaveText([en.menu.about, en.menu.surveyors])
  await items.first().click()
  await expect(intro(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(intro(page)).toHaveCount(0)
  await expect(menuButton(page)).toBeFocused()
  expect(await seen(page)).toBe('1')
})

test('menu → "About HSCode" on a factory page opens it on the map', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '1'), KEY)
  await open(page, `f/${FACTORY_ID}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await menuButton(page).click()
  await page.getByRole('menuitem', { name: en.menu.about }).click()
  await expect(page).toHaveURL(/\/hscode\/$/)
  await expect(intro(page)).toBeVisible()
  await intro(page).getByRole('button', { name: en.intro.close }).click()
  await page.reload()
  await mapReady(page)
  await expect(intro(page)).toHaveCount(0) // the About request was consumed, not replayed
})

test('the intro key cannot be stored: it closes, the map stays usable, and it simply shows again next visit', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  // Only the intro key fails, so this exercises the intro's degraded path, not Firestore's cache.
  await page.addInitScript((k) => {
    const real = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === k) throw new DOMException('blocked', 'QuotaExceededError')
      return real.call(this, key, value)
    }
  }, KEY)
  await open(page, './')
  await intro(page).getByRole('button', { name: en.intro.close }).click()
  await expect(intro(page)).toHaveCount(0)
  await page.getByRole('combobox', { name: en.map.searchLabel }).fill('feed')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/[?&]q=feed/)
  await expect(page.getByLabel(en.map.resultsLabel, { exact: true }).locator('article').first()).toBeVisible()
  await open(page, './')
  await expect(intro(page)).toBeVisible()
  expect(errors).toEqual([])
})

test('localStorage blocked for every key (SecurityError): the whole app still loads the map and its results', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
  })
  await open(page, './')
  await intro(page).getByRole('button', { name: en.intro.close }).click()
  await expect(intro(page)).toHaveCount(0)
  // Firestore must have fallen back to its memory cache: the index loads and pins and cards show.
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible()
  await expect(page.getByLabel(en.map.resultsLabel, { exact: true }).locator('article').first()).toBeVisible()
  await open(page, `f/${FACTORY_ID}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Delta Feed Mill' })).toBeVisible()
  expect(errors).toEqual([])
})

test('browser Back while it is open leaves the page normally', async ({ page }) => {
  await open(page, 'survey')
  await expect(page.getByRole('heading', { level: 1, name: en.survey.gate.signInTitle })).toBeVisible()
  await open(page, './')
  await expect(intro(page)).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/hscode\/survey$/)
  await expect(page.getByRole('heading', { level: 1, name: en.survey.gate.signInTitle })).toBeVisible()
})

test('the only admin link is "Login as Admin" in the open intro; none on the map, /f/<id> or /survey', async ({ page }) => {
  await open(page, './')
  await expect(intro(page)).toBeVisible()
  await expect(page.locator('a[href*="/admin"]')).toHaveCount(1)
  await expect(intro(page).locator('a[href*="/admin"]')).toHaveText('Login as Admin')
  await page.keyboard.press('Escape')
  await expect(intro(page)).toHaveCount(0)
  await expect(page.locator('a[href*="/admin"]')).toHaveCount(0)
  await menuButton(page).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.locator('a[href*="/admin"]')).toHaveCount(0)

  await open(page, `f/${FACTORY_ID}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await menuButton(page).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.locator('a[href*="/admin"]')).toHaveCount(0)

  await open(page, 'survey')
  await expect(page.getByRole('heading', { level: 1, name: en.survey.gate.signInTitle })).toBeVisible()
  await expect(page.locator('a[href*="/admin"]')).toHaveCount(0)
})

test('the admin link also shows when the intro is reopened through About, and in AR reads «دخول المشرف»', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '1'), KEY)
  await open(page, './')
  await mapReady(page)
  await menuButton(page).click()
  await page.getByRole('menuitem', { name: en.menu.about }).click()
  await expect(intro(page).locator('a[href*="/admin"]')).toHaveCount(1)
  await intro(page).locator('button[lang="ar"]').click()
  await expect(intro(page, ar).getByRole('link', { name: 'دخول المشرف' })).toBeVisible()
})

test('clicking "Login as Admin" lands on the admin sign-in page', async ({ page }) => {
  await open(page, './')
  await intro(page).getByRole('link', { name: 'Login as Admin' }).click()
  await expect(page).toHaveURL(/\/hscode\/admin$/)
  await expect(page.getByLabel(en.admin.signIn.email)).toBeVisible()
})

test('an old /map?q=x link on a first visit lands on /?q=x with no intro (Back covered in client.spec)', async ({ page }) => {
  await open(page, 'map?q=feed')
  await expect(page).toHaveURL(/\/hscode\/\?q=feed$/)
  await mapReady(page)
  await expect(page.getByRole('combobox', { name: en.map.searchLabel })).toHaveValue('feed')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await seen(page)).toBeNull()
})
