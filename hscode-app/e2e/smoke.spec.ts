import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import en from '../src/i18n/en.json' with { type: 'json' }

test.beforeEach(async ({ page }) => {
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }))
  // Guard: every test fails unless the app runs in emulator mode, so e2e never reaches production.
  await page.goto('./')
  await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
})

test('shell loads in EN, toggles to AR RTL without horizontal scroll, passes axe', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: 'HSCode' })).toBeVisible()
  await page.getByRole('button', { name: 'ع' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('deep link /hscode/survey renders the app, not a 404', async ({ page }) => {
  await page.goto('./survey')
  await expect(page.getByRole('banner').getByRole('img', { name: 'HSCode' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: en.survey.gate.signInTitle })).toBeVisible()
})
