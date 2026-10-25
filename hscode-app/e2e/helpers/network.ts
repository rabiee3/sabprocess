import type { Page } from '@playwright/test'

const EMULATORS = /^http:\/\/127\.0\.0\.1:(8080|9099)\//
const FLAG = '__e2eOffline'

/**
 * "Offline" that survives a page reload. Playwright's `context.setOffline` would also block the dev server,
 * so a reload could not load the app at all. Instead: the Firebase emulator hosts are aborted, `navigator.onLine`
 * reports false (flag in sessionStorage, re-applied by an init script on every navigation), and live connections
 * are dropped by a short setOffline toggle.
 */
export async function goOffline(page: Page): Promise<void> {
  const context = page.context()
  const overrideOnLine = (flag: string) =>
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => sessionStorage.getItem(flag) !== '1',
    })
  await page.addInitScript(overrideOnLine, FLAG) // later navigations (the reload)
  await page.evaluate(overrideOnLine, FLAG) // the current document
  await page.route(EMULATORS, (route) => route.abort('internetdisconnected'))
  await page.evaluate((flag) => sessionStorage.setItem(flag, '1'), FLAG)
  await context.setOffline(true) // kills open streams
  await context.setOffline(false) // the dev server is reachable again; the emulators stay blocked by the route
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
}

export async function goOnline(page: Page): Promise<void> {
  await page.evaluate((flag) => sessionStorage.removeItem(flag), FLAG)
  await page.unroute(EMULATORS)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}
