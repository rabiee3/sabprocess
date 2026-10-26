import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import en from '../src/i18n/en.json' with { type: 'json' }
import ar from '../src/i18n/ar.json' with { type: 'json' }
import { signInGoogleEmulator } from './helpers/signInGoogleEmulator'

// Seeded by seed/seed-emulator.ts. demo-cables is hidden by admin.spec (e), so it is never relied on here.
const FEED_MILL = { id: 'demo-feed-mill', en: 'Delta Feed Mill', ar: 'مطحنة الدلتا للأعلاف', phone: '+20 100 000 0001' }
const GRAIN_MILL = { id: 'seed-grain-mill', en: 'Upper Egypt Grain Mills' } // makes maize (HS 1005), which the feed mill needs
const PENDING_ID = 'demo-pending-deeplink' // pending, and never reviewed by any test

type Strings = typeof en

test.beforeEach(async ({ page }) => {
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }))
})

async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('html'), 'app is not in emulator mode').toHaveAttribute('data-emulator', 'true')
}

const results = (page: Page, s: Strings = en) => page.getByLabel(s.map.resultsLabel, { exact: true })
const cards = (page: Page, s: Strings = en) => results(page, s).locator('article')
const cardNames = (page: Page, s: Strings = en) => cards(page, s).getByRole('heading', { level: 3 })
const searchBox = (page: Page, s: Strings = en) => page.getByRole('combobox', { name: s.map.searchLabel })
const noHScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

/** The map has loaded the index: pins on the map and at least one result card. */
async function expectPinsAndResults(page: Page, s: Strings) {
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible()
  await expect(cards(page, s).first()).toBeVisible()
  const heading = results(page, s).getByRole('heading', { level: 2 })
  await expect(heading).not.toHaveText(s.map.loading)
  await expect(heading).not.toHaveText(s.map.emptyTitle)
  expect(await cards(page, s).count()).toBeGreaterThan(0)
}

/** (a) + (b) in one language: map at the root, then a suggestion search that survives a reload. */
async function rootMapAndSearch(page: Page, lang: 'en' | 'ar') {
  const s = (lang === 'en' ? en : ar) as Strings
  await open(page, './')
  if (lang === 'ar') {
    await page.locator('button[lang="ar"]').click()
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
  }
  await expect(page).toHaveURL(/\/hscode\/?$/)
  await expectPinsAndResults(page, s)
  if (lang === 'en') await expect(results(page, s).getByRole('heading', { level: 2 })).toHaveText(/^[1-9]\d* factor(y|ies)$/)

  await searchBox(page, s).fill('علف')
  const suggestion = page.getByRole('group', { name: s.map.sugProducts }).getByRole('option').first()
  await expect(suggestion).toBeVisible()
  await suggestion.click()
  await expect(page).toHaveURL(/[?&]q=/)
  const name = lang === 'en' ? FEED_MILL.en : FEED_MILL.ar
  await expect(cardNames(page, s).filter({ hasText: name })).toBeVisible()
  const query = await searchBox(page, s).inputValue()
  expect(query).not.toBe('')

  await page.reload()
  await expect(searchBox(page, s)).toHaveValue(query)
  await expect(cardNames(page, s).filter({ hasText: name })).toBeVisible()
  if (lang === 'ar') expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
  expect(await noHScroll(page)).toBe(true)
}

test('(a)(b) map at the root with pins and results; an Arabic suggestion finds the feed mill and survives a reload', async ({ page }) => {
  await rootMapAndSearch(page, 'en')
})

test('(h) Arabic: the same flow runs right-to-left with no horizontal scroll', async ({ page }) => {
  await rootMapAndSearch(page, 'ar')
})

test('(c) the "Animal feed" sector chip shows only feed factories', async ({ page }) => {
  await open(page, './')
  await expectPinsAndResults(page, en)
  await page.getByRole('button', { name: en.map.chipSector }).click()
  await page.getByRole('dialog').getByRole('radio', { name: 'Animal feed' }).click() // the sheet closes on choice
  await expect(page).toHaveURL(/[?&]sector=animal-feed/)
  await expect(page.getByRole('button', { name: 'Animal feed' })).toBeVisible() // the chip shows the choice
  await expect(cards(page)).toHaveCount(2)
  await expect(cardNames(page).filter({ hasText: FEED_MILL.en })).toBeVisible()
  for (const card of await cards(page).all()) await expect(card).toContainText('Animal feed')
})

test('(d) near me sorts the results by distance, nearest first', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 29.9727, longitude: 30.9421, accuracy: 15 }) // at the feed mill
  await open(page, './')
  await expectPinsAndResults(page, en)
  await page.getByRole('button', { name: en.map.nearMe }).click()
  await expect(page.getByRole('button', { name: en.map.nearMe })).toHaveAttribute('aria-pressed', 'true')
  await expect(results(page).getByText(en.map.sortDistance)).toBeVisible()
  const n = await cards(page).count()
  const distances = results(page).locator('article').getByText(/^[\d.,]+ km$/)
  await expect(distances).toHaveCount(n)
  const km = (await distances.allTextContents()).map((t) => Number(t.replace(/[^\d.]/g, '')))
  expect(km).toEqual([...km].sort((x, y) => x - y))
  await expect(cardNames(page).first()).toHaveText(FEED_MILL.en)
})

test('(e) "Who supplies this?" on a needed product lists the seeded maker', async ({ page }) => {
  await open(page, `f/${FEED_MILL.id}`)
  await expect(page.getByRole('heading', { level: 1, name: FEED_MILL.en })).toBeVisible()
  const maize = page.getByRole('region', { name: en.factory.needs }).getByRole('listitem').filter({ hasText: 'Maize' })
  await maize.getByRole('link', { name: en.factory.whoSupplies }).click()
  await expect(page).toHaveURL(/\/hscode\/\?hs=1005/)
  await expect(cardNames(page).filter({ hasText: GRAIN_MILL.en })).toBeVisible()
  await expect(cardNames(page).filter({ hasText: FEED_MILL.en })).toHaveCount(0)
})

test('(f) contacts are locked signed out, and shown after a Google sign-in', async ({ page }, testInfo) => {
  await open(page, `f/${FEED_MILL.id}`)
  const contacts = page.getByRole('region', { name: en.factory.contacts })
  await expect(contacts.getByText(en.factory.lockedTitle)).toBeVisible()
  // Signed out, no contact data reaches the DOM at all.
  const html = await page.content()
  for (const leak of [FEED_MILL.phone, FEED_MILL.phone.replace(/\D/g, ''), '000 0001', 'tel:', 'wa.me']) {
    expect(html, `signed-out DOM contains "${leak}"`).not.toContain(leak)
  }
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)

  await signInGoogleEmulator(page, `buyer-${testInfo.project.name}@example.com`, 'Buyer E2E', en.auth.continueWithGoogle)
  await expect(contacts.getByRole('link', { name: FEED_MILL.phone, exact: true })).toBeVisible()
  await expect(contacts.locator('a[href^="tel:"]')).toHaveCount(1)
  await expect(contacts.getByText(en.factory.lockedTitle)).toHaveCount(0)
})

test('(g) the seeded sample carries a Demo badge on its card and its page; a real factory does not', async ({ page }) => {
  await open(page, './')
  await expectPinsAndResults(page, en)
  const feedCard = cards(page).filter({ has: page.getByRole('heading', { level: 3, name: FEED_MILL.en }) })
  await expect(feedCard.getByText(en.map.demo, { exact: true })).toBeVisible()
  const grainCard = cards(page).filter({ has: page.getByRole('heading', { level: 3, name: GRAIN_MILL.en }) })
  await expect(grainCard).toBeVisible()
  await expect(grainCard.getByText(en.map.demo, { exact: true })).toHaveCount(0)

  await open(page, `f/${FEED_MILL.id}`)
  await expect(page.getByRole('main').getByText(en.factory.demo, { exact: true })).toBeVisible()
  await open(page, `f/${GRAIN_MILL.id}`)
  await expect(page.getByRole('heading', { level: 1, name: GRAIN_MILL.en })).toBeVisible()
  await expect(page.getByRole('main').getByText(en.factory.demo, { exact: true })).toHaveCount(0)
})

test('(i) axe: the map, the results open, and the factory page', async ({ page }, testInfo) => {
  await open(page, './')
  await expectPinsAndResults(page, en)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  // Open the results: the mobile sheet expands; on desktop the list is always open, so select a factory.
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: en.map.sheetToggle }).click()
    await expect(page.getByRole('button', { name: en.map.sheetToggle })).toHaveAttribute('aria-expanded', 'true')
  }
  await cardNames(page).filter({ hasText: FEED_MILL.en }).getByRole('button').click()
  await expect(page).toHaveURL(/[?&]sel=demo-feed-mill/)
  await expect(cards(page).filter({ hasText: FEED_MILL.en })).toHaveAttribute('aria-current', 'true')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await open(page, `f/${FEED_MILL.id}`)
  await expect(page.getByRole('heading', { level: 1, name: FEED_MILL.en })).toBeVisible()
  await expect(page.getByRole('region', { name: en.factory.contacts })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('(j) a deep link to a pending factory shows the not-found page', async ({ page }) => {
  await open(page, `f/${PENDING_ID}`)
  await expect(page.getByRole('heading', { level: 1, name: en.factory.notFoundTitle })).toBeVisible()
  await expect(page.getByRole('link', { name: en.factory.backToMap })).toBeVisible()
})

test('an old /map?q= link lands on the root map with the query intact, and Back does not return to /map', async ({ page }) => {
  await open(page, `./f/${FEED_MILL.id}`)
  await page.goto('map?q=feed&near=1')
  await expect(page).toHaveURL(/\/hscode\/\?q=feed&near=1$/)
  await expect(searchBox(page)).toHaveValue('feed')
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/hscode/f/${FEED_MILL.id}$`))
})
