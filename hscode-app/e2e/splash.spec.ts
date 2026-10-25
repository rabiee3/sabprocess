import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import en from '../src/i18n/en.json' with { type: 'json' }
import ar from '../src/i18n/ar.json' with { type: 'json' }

test.beforeEach(async ({ page }) => {
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }))
  await page.goto('./')
  await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
})

const noHScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

for (const size of [{ width: 360, height: 740 }, { width: 1280, height: 800 }]) {
  for (const lang of ['en', 'ar'] as const) {
    test(`splash ${size.width}x${size.height} ${lang}: no horizontal scroll, axe clean, Find factories -> /map`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.goto('./')
      const strings = lang === 'en' ? en : ar
      if (lang === 'ar') await page.locator('button[lang="ar"]').click()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      await expect(page.getByRole('heading', { level: 1, name: strings.home.headline })).toBeVisible()
      expect(await noHScroll(page)).toBe(false)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
      await page.getByRole('link', { name: strings.home.findFactories }).or(page.getByRole('button', { name: strings.home.findFactories })).filter({ visible: true }).first().click()
      await expect(page).toHaveURL(/\/hscode\/map/)
      await expect(page.getByRole('heading', { level: 1, name: strings.map.title })).toBeVisible()
      expect(await noHScroll(page)).toBe(false)
      const r2 = await new AxeBuilder({ page }).analyze()
      expect(r2.violations).toEqual([])
    })
  }
}

test('desktop search goes to /map?q=', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('./')
  await page.getByRole('searchbox', { name: en.home.searchLabel }).fill('8544')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/hscode\/map\?q=8544/)
  await expect(page.getByText('8544')).toBeVisible()
  await page.getByRole('link', { name: en.map.back }).click()
  await expect(page).toHaveURL(/\/hscode\/?$/)
})

test('admin sign-in: logo above the card, lang toggle clear of it, no scroll, axe clean', async ({ page }) => {
  for (const size of [{ width: 360, height: 740 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size)
    await page.goto('admin')
    for (const lang of ['en', 'ar'] as const) {
      await page.locator(`button[lang="${lang}"]`).click()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      const logo = (await page.getByRole('img', { name: 'HSCode' }).boundingBox())!
      const card = (await page.locator('form').boundingBox())!
      const toggle = (await page.locator('[role="group"]:has(button[lang="ar"])').boundingBox())!
      expect(logo.y + logo.height, `${size.width} ${lang}`).toBeLessThanOrEqual(card.y)
      expect(Math.abs(logo.width - card.width)).toBeLessThan(2)
      expect(toggle.y + toggle.height).toBeLessThanOrEqual(logo.y + 1)
      expect(await noHScroll(page)).toBe(false)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    }
    await page.locator('button[lang="en"]').click()
  }
})
