import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FirebaseApp } from 'firebase/app'
import { setupAppCheck } from './appCheck'

const app = {} as FirebaseApp

function makeDeps() {
  const instance = { fake: true }
  const initializeAppCheck = vi.fn(() => instance)
  const ReCaptchaV3Provider = vi.fn(function (this: { key: string }, key: string) {
    this.key = key
  })
  return { instance, deps: { initializeAppCheck, ReCaptchaV3Provider } as never, initializeAppCheck, ReCaptchaV3Provider }
}

const base = { siteKey: 'site-key', useEmulator: false, isBrowser: true, dev: false }

afterEach(() => {
  delete (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN
})

describe('setupAppCheck', () => {
  it('does nothing with an empty site key', () => {
    const d = makeDeps()
    expect(setupAppCheck(app, { ...base, siteKey: '' }, d.deps)).toBeNull()
    expect(d.initializeAppCheck).not.toHaveBeenCalled()
  })

  it('initialises with reCAPTCHA v3 and auto refresh outside the emulator', () => {
    const d = makeDeps()
    expect(setupAppCheck(app, base, d.deps)).toBe(d.instance)
    expect(d.ReCaptchaV3Provider).toHaveBeenCalledWith('site-key')
    const [passedApp, options] = d.initializeAppCheck.mock.calls[0] as unknown as [unknown, Record<string, unknown>]
    expect(passedApp).toBe(app)
    expect(options.isTokenAutoRefreshEnabled).toBe(true)
    expect(options.provider).toBeInstanceOf(d.ReCaptchaV3Provider)
  })

  it('never runs in the emulator or outside a browser', () => {
    const d = makeDeps()
    expect(setupAppCheck(app, { ...base, useEmulator: true }, d.deps)).toBeNull()
    expect(setupAppCheck(app, { ...base, isBrowser: false }, d.deps)).toBeNull()
    expect(d.initializeAppCheck).not.toHaveBeenCalled()
  })

  it('enables the debug token in dev only', () => {
    const d = makeDeps()
    setupAppCheck(app, base, d.deps)
    expect((self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined()
    setupAppCheck(app, { ...base, dev: true }, d.deps)
    expect((self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true)
  })
})
