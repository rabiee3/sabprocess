import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }))
  await page.goto('./')
  await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
})

const noHScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

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
