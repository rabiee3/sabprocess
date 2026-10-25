import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import ar from '../src/i18n/ar.json' with { type: 'json' }
import en from '../src/i18n/en.json' with { type: 'json' }
import { createInvite, factoryIdOfEmail, rejectFactory } from './helpers/emulatorAdmin'
import { goOffline, goOnline } from './helpers/network'
import { signInGoogleEmulator } from './helpers/signInGoogleEmulator'

const SEEDED_INVITE = '482913'
const USED_INVITE = '111111'

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'surveyor flows run once, at phone size')
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }))
  await page.goto('./')
  await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
})

const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const newEmail = (tag: string) => `${tag}.${stamp()}@example.com`
/** A fresh unused 6-digit invite (admin-created, so parallel tests never share one). */
async function freshInvite(): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 899999))
  await createInvite(code)
  return code
}

async function signIn(page: Page, email: string) {
  await page.goto('./survey')
  await signInGoogleEmulator(page, email, 'E2E Surveyor')
  await expect(page.getByRole('heading', { level: 1, name: en.survey.invite.title })).toBeVisible()
}

async function unlock(page: Page, code: string) {
  const boxes = page.getByRole('group', { name: en.survey.invite.title }).locator('input')
  const unlockButton = page.getByRole('button', { name: en.survey.invite.unlock })
  // The account doc settles just after sign-in and can remount the screen; retype until the code sticks.
  await expect(async () => {
    for (let i = 5; i >= 0; i--) await boxes.nth(i).fill('')
    await boxes.first().click()
    await page.keyboard.type(code)
    await expect(unlockButton).toBeEnabled({ timeout: 1000 })
  }).toPass()
  await unlockButton.click()
}

async function becomeSurveyor(page: Page, email: string, code: string) {
  await signIn(page, email)
  await unlock(page, code)
  await expect(page.getByRole('heading', { level: 1, name: en.survey.list.title })).toBeVisible()
}

const next = (page: Page) => page.getByRole('button', { name: en.survey.step.next, exact: true }).click()
const onStep = (page: Page, step: string) => expect(page).toHaveURL(new RegExp(`step=${step}`))

async function fillLocation(page: Page) {
  await expect(page.getByText(/GPS .*15 m/)).toBeVisible() // the context's fixed geolocation was applied
  const coords = page.locator('[dir="ltr"].font-mono')
  const before = await coords.textContent()
  await page.locator('.leaflet-container').click({ position: { x: 40, y: 40 } }) // tap-to-place
  await expect(coords).not.toHaveText(before!)
  await next(page)
  await onStep(page, 'basics')
}

async function fillBasics(page: Page, name: string) {
  await page.getByLabel(en.survey.basics.nameEn).fill(name)
  await page.getByRole('combobox', { name: en.survey.basics.area }).selectOption('oct6-zone-1')
  await page.getByRole('combobox', { name: en.survey.basics.sector }).selectOption('animal-feed')
  await next(page)
  await onStep(page, 'products')
}

async function fillProducts(page: Page) {
  await page.getByRole('button', { name: en.survey.products.add }).first().click()
  await page.getByLabel(en.survey.products.nameEn).fill('Poultry feed')
  await page.getByRole('button', { name: en.survey.products.hsOptional }).click()
  const picker = page.getByRole('dialog')
  await picker.getByRole('searchbox', { name: en.hs.searchPlaceholder }).fill('feed')
  await picker.getByRole('button', { name: /2309/ }).first().click()
  await picker.getByRole('button', { name: 'Use 2309' }).click()
  await expect(picker).toBeHidden()
  await next(page)
  await onStep(page, 'contacts')
}

async function fillContactsAndPhotos(page: Page) {
  await page.getByLabel(en.survey.contacts.phone, { exact: true }).fill('+20 100 555 0101')
  await next(page)
  await onStep(page, 'photos')
  await next(page)
  await onStep(page, 'review')
}

/** From "My submissions": a whole new factory up to the Review step. */
async function startFactoryToReview(page: Page, name: string) {
  await page.getByRole('link', { name: en.survey.list.add }).click()
  await fillLocation(page)
  await fillBasics(page, name)
  await fillProducts(page)
  await fillContactsAndPhotos(page)
  await expect(page.getByRole('heading', { name: en.survey.review.title })).toBeVisible()
}

const row = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text })

test('(a) a new client unlocks with an invite, adds a factory in six steps and sees it Pending', async ({ page }) => {
  await becomeSurveyor(page, newEmail('a'), SEEDED_INVITE)
  await startFactoryToReview(page, 'E2E Feed Works')
  await page.getByRole('button', { name: en.survey.review.submit }).click()
  await expect(page).toHaveURL(/\/survey\/?$/)
  const item = row(page, 'E2E Feed Works')
  await expect(item).toBeVisible()
  await expect(item.getByText(en.survey.list.pending, { exact: true })).toBeVisible()
})

test('(b) an invalid or already used code shows the invalid message', async ({ page }) => {
  await signIn(page, newEmail('b'))
  await unlock(page, USED_INVITE)
  await expect(page.getByText(en.survey.invite.invalid)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: en.survey.invite.title })).toBeVisible()
})

test('(c) offline submit is saved on the phone, survives a reload, then uploads on reconnect', async ({ page }) => {
  await becomeSurveyor(page, newEmail('c'), await freshInvite())
  await startFactoryToReview(page, 'E2E Offline Works')
  await goOffline(page)
  await expect(page.getByText(en.survey.review.offlineBanner)).toBeVisible()
  await page.getByRole('button', { name: en.survey.review.saveOnPhone }).click()
  const item = row(page, 'E2E Offline Works')
  await expect(item.getByText(en.survey.list.savedOnPhone, { exact: true })).toBeVisible()

  await page.reload() // still offline
  await expect(page.getByRole('heading', { level: 1, name: en.survey.list.title })).toBeVisible()
  await expect(row(page, 'E2E Offline Works').getByText(en.survey.list.savedOnPhone, { exact: true })).toBeVisible()

  await goOnline(page)
  await expect(row(page, 'E2E Offline Works').getByText(en.survey.list.pending, { exact: true })).toBeVisible({
    timeout: 30000,
  })
  await expect(row(page, en.survey.list.savedOnPhone)).toHaveCount(0)
})

// Skipped while ALLOW_EDIT (src/survey/features.ts) is false: editing and resubmitting is hidden. Re-enable with the switch.
test.skip('(d) a rejected factory shows the reason; Fix and resubmit returns it to Pending', async ({ page }) => {
  const email = newEmail('d')
  await becomeSurveyor(page, email, await freshInvite())
  await startFactoryToReview(page, 'E2E Rejected Works')
  await page.getByRole('button', { name: en.survey.review.submit }).click()
  await expect(row(page, 'E2E Rejected Works').getByText(en.survey.list.pending, { exact: true })).toBeVisible()

  // The admin rejects it (emulator-only back door; the client rules rightly forbid this).
  await rejectFactory(await factoryIdOfEmail(email), 'Photo is blurry')
  const item = row(page, 'E2E Rejected Works')
  await expect(item.getByText('Photo is blurry')).toBeVisible()
  await expect(item.getByText(en.survey.list.rejected, { exact: true })).toBeVisible()

  await item.getByRole('link', { name: en.survey.list.fixResubmit }).click()
  await expect(page.getByRole('heading', { level: 1, name: en.survey.step.location })).toBeVisible()
  for (const step of ['basics', 'products', 'contacts', 'photos', 'review']) {
    await next(page)
    await onStep(page, step)
  }
  await page.getByRole('button', { name: en.survey.review.submit }).click()
  const after = row(page, 'E2E Rejected Works')
  await expect(after.getByText(en.survey.list.pending, { exact: true })).toBeVisible()
  await expect(after.getByText('Photo is blurry')).toHaveCount(0)
})

test('(e) the Arabic run is RTL with no horizontal scroll', async ({ page }) => {
  await becomeSurveyor(page, newEmail('e'), await freshInvite())
  await page.getByRole('button', { name: 'ع' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('link', { name: ar.survey.list.add }).click()
  const noOverflow = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  await expect(page.getByText(/GPS .*15/)).toBeVisible()
  await expect(page.locator('.leaflet-control-zoom')).toHaveCount(0) // it used to sit under "My location"
  await expect(page.getByRole('button', { name: ar.survey.location.myLocation })).toBeVisible()
  await noOverflow()
  await page.getByRole('button', { name: ar.survey.step.next, exact: true }).click()
  await onStep(page, 'basics')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await noOverflow()
})

test('(f) axe: invite screen, location step and My submissions', async ({ page }) => {
  const scan = async (label: string) => {
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations, label).toEqual([])
  }
  await signIn(page, newEmail('f'))
  await scan('invite screen')
  await unlock(page, await freshInvite())
  await expect(page.getByRole('heading', { level: 1, name: en.survey.list.title })).toBeVisible()
  await scan('my submissions')
  await page.getByRole('link', { name: en.survey.list.add }).click()
  await expect(page.getByText(/GPS .*15 m/)).toBeVisible()
  await scan('location step')
})

test('(g) an overlong Facebook URL is blocked at the contacts step with an error, not submitted', async ({ page }) => {
  await becomeSurveyor(page, newEmail('g'), await freshInvite())
  await page.getByRole('link', { name: en.survey.list.add }).click()
  await fillLocation(page)
  await fillBasics(page, 'E2E Long Link Works')
  await next(page) // no products is fine
  await onStep(page, 'contacts')

  const fb = page.getByLabel(en.survey.contacts.facebook)
  await expect(fb).toHaveAttribute('maxlength', '300')
  const long = `https://facebook.com/${'x'.repeat(300)}`
  // A real paste: the browser would cut it at maxlength silently; the form keeps it whole so validation can flag it.
  await fb.focus()
  await fb.evaluate((el, text) => {
    const data = new DataTransfer()
    data.setData('text/plain', text)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, long)
  await expect(fb).toHaveValue(long)

  await next(page)
  await expect(page.getByText(en.errors.tooLong.replace('{{max}}', '300'))).toBeVisible()
  await onStep(page, 'contacts')

  await page.goto('./survey')
  await expect(page.getByRole('heading', { level: 1, name: en.survey.list.title })).toBeVisible()
  await expect(row(page, 'E2E Long Link Works')).toHaveCount(0)
})
