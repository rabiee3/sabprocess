import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import en from '../src/i18n/en.json' with { type: 'json' }
import { createPendingFactory, createSurveyor, docData, indexEntries } from './helpers/emulatorAdmin'

const ADMIN_EMAIL = 'admin@example.test'
const ADMIN_PASSWORD = 'emulator-only-123' // emulator-only; the seed creates this account
const a = en.admin
const named = (template: string, name: string) => template.replace('{{name}}', name)

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'admin flows run once, at desktop size')
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }))
})

async function signInAdmin(page: Page, path = 'admin') {
  await page.goto(path)
  await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
  await page.getByLabel(a.signIn.email).fill(ADMIN_EMAIL)
  await page.getByLabel(a.signIn.password).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: a.signIn.submit }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible() // the layout's title (the nav is a hidden drawer below 1024px)
}

const nav = (page: Page) => page.getByRole('navigation', { name: a.navLabel })
const queueLink = (page: Page, name: string) =>
  page.getByRole('list', { name: a.review.queueLabel }).getByRole('link', { name: new RegExp(name) })

async function openFromQueue(page: Page, name: string) {
  await queueLink(page, name).click()
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
}

test('(a) review queue: flags, rename and approve publishes to the index', async ({ page }) => {
  await signInAdmin(page)
  await expect(page).toHaveURL(/\/admin\/review/)
  const gps = queueLink(page, 'Pending Gps Works')
  const hand = queueLink(page, 'Pending Hand Works')
  await expect(gps).toBeVisible()
  await expect(hand).toBeVisible()
  await expect(gps.getByText(a.review.flag.lowAccuracy)).toBeVisible()
  await expect(gps.getByText(a.review.flag.pinNeverMoved)).toBeVisible()
  await expect(hand.getByText(a.review.flag.manual)).toBeVisible()

  await openFromQueue(page, 'Pending Gps Works')
  await page.getByLabel(en.survey.basics.nameEn).fill('Renamed Gps Works')
  await page.getByRole('button', { name: a.review.approve }).click()
  await expect(page.getByText(named(a.review.approved, 'Renamed Gps Works'))).toBeVisible()
  await expect(queueLink(page, 'Renamed Gps Works')).toHaveCount(0)
  await expect
    .poll(async () => (await indexEntries()).some((e) => e.id === 'demo-pending-gps' && e.n.en === 'Renamed Gps Works'))
    .toBe(true)
  expect((await docData('factories/demo-pending-gps'))?.status).toBe('approved')
})

test('(b) reject with a reason', async ({ page }) => {
  await signInAdmin(page)
  await openFromQueue(page, 'Pending Hand Works')
  await page.getByRole('button', { name: a.review.reject, exact: true }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel(a.review.reasonLabel).fill('Photo is missing')
  await sheet.getByRole('button', { name: a.review.confirmReject }).click()
  await expect(page.getByText(named(a.review.rejected, 'Pending Hand Works'))).toBeVisible()
  await expect.poll(async () => (await docData('factories/demo-pending-hand'))?.status).toBe('rejected')
  expect((await docData('factories/demo-pending-hand'))?.rejectReason).toBe('Photo is missing')
})

test('(c) generate and cancel an invitation code', async ({ page }) => {
  await signInAdmin(page, 'admin/invites')
  await page.getByRole('button', { name: a.invites.generate }).click()
  const fresh = page.locator('code[dir="ltr"]').first()
  await expect(fresh).toHaveText(/^\d{6}$/)
  const code = (await fresh.textContent())!.trim()
  const row = page.getByRole('row').filter({ hasText: code })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: a.invites.cancel }).click()
  await page.getByRole('dialog').getByRole('button', { name: a.invites.confirmCancel }).click()
  await expect(row.getByText(a.invites.cancelled)).toBeVisible()
  // The row updates from the local write first; the server copy follows.
  await expect.poll(async () => (await docData(`invites/${code}`))?.cancelled).toBe(true)
})

test('(d) deactivate a surveyor', async ({ page }) => {
  await createSurveyor('e2e-deact', 'Deactivate Me')
  await signInAdmin(page, 'admin/surveyors')
  const toggle = page.getByRole('switch', { name: named(a.surveyors.toggle, 'Deactivate Me') })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await page.getByRole('dialog').getByRole('button', { name: a.surveyors.deactivate, exact: true }).click()
  await expect(toggle).not.toBeChecked()
  await expect.poll(async () => (await docData('users/e2e-deact'))?.active).toBe(false)
})

test('(e) hiding an approved factory removes it from the index', async ({ page }) => {
  expect((await indexEntries()).some((e) => e.id === 'demo-cables')).toBe(true)
  await signInAdmin(page, 'admin/factories')
  await page.getByRole('tab', { name: a.factories.tab.approved }).click()
  await page.getByRole('button', { name: named(a.factories.hideNamed, 'Nile Cables') }).click()
  await expect(page.getByText(named(a.factories.done.hidden, 'Nile Cables'))).toBeVisible()
  await expect.poll(async () => (await indexEntries()).some((e) => e.id === 'demo-cables')).toBe(false)
  expect((await docData('factories/demo-cables'))?.status).toBe('hidden')
})

test('(f) dashboard shows counts, and no export or download control exists', async ({ page }) => {
  await signInAdmin(page, 'admin/dashboard')
  const tiles = page.getByRole('region', { name: a.dash.statusTitle }).getByRole('listitem')
  await expect(tiles).toHaveCount(4)
  await expect(tiles.first().locator('p').nth(1)).toHaveText(/^\d+$/)
  // The seed has 8 approved + 3 pending + 1 rejected; other tests only move factories between statuses.
  await expect
    .poll(async () => (await tiles.locator('p:nth-child(2)').allTextContents()).reduce((n, t) => n + Number(t), 0))
    .toBeGreaterThanOrEqual(6)
  await expect(page.getByRole('meter', { name: a.dash.indexLabel })).toBeVisible()
  for (const path of ['review', 'factories', 'invites', 'surveyors', 'dashboard']) {
    await nav(page).locator(`a[href$="/admin/${path}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/admin/${path}`))
    await expect(page.getByRole('heading', { level: 1, name: a.nav[path as keyof typeof a.nav] })).toBeVisible()
    await expect(page.getByRole('button', { name: /export|download|csv/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /export|download|csv/i })).toHaveCount(0)
    await expect(page.locator('a[download]')).toHaveCount(0)
  }
})

test('(g) axe: review queue and invitation codes', async ({ page }) => {
  await signInAdmin(page)
  await expect(page.getByRole('list', { name: a.review.queueLabel })).toBeVisible()
  const queue = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(queue.violations).toEqual([])
  await nav(page).getByRole('link', { name: a.nav.invites }).click()
  await expect(page.getByRole('table', { name: a.nav.invites })).toBeVisible()
  const invites = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(invites.violations).toEqual([])
})

test('(h) 768px: the drawer layout reviews and approves', async ({ page }) => {
  await createPendingFactory('e2e-drawer', 'Drawer Works')
  await page.setViewportSize({ width: 768, height: 900 })
  await signInAdmin(page, 'admin/review')
  await expect(page.getByRole('button', { name: a.menu })).toBeVisible()
  await expect(nav(page)).toBeHidden()
  await queueLink(page, 'Drawer Works').click()
  await expect(page.getByRole('heading', { level: 2, name: 'Drawer Works' })).toBeVisible()
  await page.getByLabel(en.survey.basics.nameEn).fill('Drawer Works Two')
  await page.getByRole('button', { name: a.review.approve }).click()
  await expect(page.getByText(named(a.review.approved, 'Drawer Works Two'))).toBeVisible()
  await page.getByRole('button', { name: a.menu }).click()
  await expect(nav(page)).toBeVisible()
  await expect
    .poll(async () => (await indexEntries()).some((e) => e.id === 'e2e-drawer' && e.n.en === 'Drawer Works Two'))
    .toBe(true)
})

type Box = { x: number; y: number; width: number; height: number }
const intersects = (p: Box, q: Box) =>
  p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height

test('(i) sign-in: the language toggle sits in the top end corner and never overlaps the email field', async ({ page }) => {
  for (const size of [{ width: 360, height: 740 }, { width: 1280, height: 800 }, { width: 360, height: 420 }]) {
    await page.setViewportSize(size)
    await page.goto('admin')
    const toggle = page.locator('[role="group"]:has(button[lang="ar"])') // its name changes with the language
    const email = page.locator('input[type="email"]')
    await expect(email).toBeVisible()
    for (const lang of ['en', 'ar'] as const) {
      await toggle.locator(`button[lang="${lang}"]`).click()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      const t = (await toggle.boundingBox())!
      const e = (await email.boundingBox())!
      expect(intersects(t, e), `${size.width}x${size.height} ${lang}`).toBe(false)
      expect(t.y).toBeLessThan(24)
      // end corner: right edge in LTR, left edge in RTL
      if (lang === 'en') expect(size.width - (t.x + t.width)).toBeLessThan(24)
      else expect(t.x).toBeLessThan(24)
    }
    await toggle.locator('button[lang="en"]').click()
  }
})

test('(j) desktop: the sidebar spans the full viewport height, in LTR and RTL', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signInAdmin(page)
  const aside = page.locator('aside')
  for (const lang of ['en', 'ar'] as const) {
    await page.locator(`header button[lang="${lang}"]`).click()
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    const box = (await aside.boundingBox())!
    expect(Math.abs(box.height - 800)).toBeLessThanOrEqual(2)
    expect(box.y).toBeLessThanOrEqual(1)
    if (lang === 'en') expect(box.x).toBeLessThanOrEqual(1)
    else expect(Math.abs(box.x + box.width - 1280)).toBeLessThanOrEqual(1)
  }
})

// Moved from the old splash.spec.ts. It sets both viewports itself, so running once (desktop project) covers both.
test('(k) sign-in: logo above the card, lang toggle clear of it, no scroll, axe clean', async ({ page }) => {
  for (const size of [{ width: 360, height: 740 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size)
    await page.goto('admin')
    await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
    for (const lang of ['en', 'ar'] as const) {
      await page.locator(`button[lang="${lang}"]`).click()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      const logo = (await page.getByRole('img', { name: 'HSCode' }).boundingBox())!
      const card = (await page.locator('form').boundingBox())!
      const toggle = (await page.locator('[role="group"]:has(button[lang="ar"])').boundingBox())!
      expect(logo.y + logo.height, `${size.width} ${lang}`).toBeLessThanOrEqual(card.y)
      expect(Math.abs(logo.width - card.width)).toBeLessThan(2)
      expect(toggle.y + toggle.height).toBeLessThanOrEqual(logo.y + 1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    }
    await page.locator('button[lang="en"]').click()
  }
})

// Runs in the desktop project and sets both sizes itself, like (k).
test('(l) the admin logo links back to the client map at /, on the sign-in screen and in the signed-in layout', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hscode.introSeen', '1'))
  const mapReady = () => expect(page.locator('main [role="combobox"]')).toBeAttached()
  for (const size of [{ width: 360, height: 740 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size)
    await page.goto('admin')
    await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
    const signInLogo = page.getByRole('link', { name: 'HSCode' })
    await expect(signInLogo).toHaveAttribute('title', en.nav.backToMap)
    await signInLogo.click()
    await expect(page).toHaveURL(/\/hscode\/$/)
    await mapReady()
  }
  await signInAdmin(page)
  const brand = page.locator('aside').getByRole('link', { name: new RegExp(en.portal.admin) }) // the sidebar, always shown at 1280
  await expect(brand).toHaveAttribute('title', en.nav.backToMap)
  await brand.click()
  await expect(page).toHaveURL(/\/hscode\/$/)
  await mapReady()
})
