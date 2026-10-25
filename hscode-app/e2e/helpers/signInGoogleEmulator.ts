import type { Page } from '@playwright/test'

/**
 * Signs in through the real `signInWithGoogle()` popup. In emulator mode the popup is the Auth emulator's
 * fake Google account chooser; "Add new account" mints a fresh google.com identity (new uid) whose token
 * email equals the one typed here, which is what the Firestore rules require.
 */
export async function signInGoogleEmulator(page: Page, email: string, displayName: string, buttonName = 'Continue with Google') {
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: buttonName }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  await popup.locator('.js-new-account').click()
  await popup.locator('#email-input').fill(email)
  await popup.locator('#display-name-input').fill(displayName)
  await popup.locator('#sign-in').click()
  await popup.waitForEvent('close').catch(() => {}) // already closed is fine
}
