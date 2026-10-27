import { afterEach, describe, expect, it, vi } from 'vitest'

// Production wiring (no emulator, a site key): App Check must start before Firestore's first request.
const order = vi.hoisted(() => [] as string[])

vi.mock('firebase/app', () => ({ initializeApp: () => ({ name: 'app' }) }))
vi.mock('firebase/auth', () => ({ getAuth: () => ({}), connectAuthEmulator: vi.fn() }))
vi.mock('firebase/analytics', () => ({ isSupported: async () => false, getAnalytics: vi.fn(), logEvent: vi.fn() }))
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: () => {
    order.push('initializeAppCheck')
    return {}
  },
  ReCaptchaV3Provider: function ReCaptchaV3Provider() {},
  onTokenChanged: () => () => {},
}))
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => {
    order.push('initializeFirestore')
    return {}
  },
  connectFirestoreEmulator: vi.fn(),
  memoryLocalCache: () => ({}),
  persistentLocalCache: () => ({}),
  persistentMultipleTabManager: () => ({}),
}))
vi.mock('./config', async (orig) => ({ ...(await orig<typeof import('./config')>()), RECAPTCHA_SITE_KEY: 'site-key' }))

describe('firebase/db', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN
  })

  it('initialises App Check before Firestore', async () => {
    vi.stubEnv('VITE_USE_EMULATOR', 'false')
    vi.resetModules()
    order.length = 0
    await import('./db')
    expect(order).toEqual(['initializeAppCheck', 'initializeFirestore'])
  })
})
