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
  await expect(page.getByText(named(a.review.approved, 'Pending Gps Works'))).toBeVisible()
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
  expect((await docData(`invites/${code}`))?.cancelled).toBe(true)
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
  await expect(page.getByText(named(a.review.approved, 'Drawer Works'))).toBeVisible()
  await page.getByRole('button', { name: a.menu }).click()
  await expect(nav(page)).toBeVisible()
  await expect
    .poll(async () => (await indexEntries()).some((e) => e.id === 'e2e-drawer' && e.n.en === 'Drawer Works Two'))
    .toBe(true)
})
