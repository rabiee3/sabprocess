import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { setupAppCheck, watchAppCheckErrors } from './appCheck'
import { EMULATOR_PROJECT_ID, RECAPTCHA_SITE_KEY, firebaseConfig } from './config'

export const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'

export const app = initializeApp(
  useEmulator ? { ...firebaseConfig, projectId: EMULATOR_PROJECT_ID } : firebaseConfig,
)

// Before Firestore, so its very first request already carries an App Check token.
export const appCheck = setupAppCheck(app, {
  siteKey: RECAPTCHA_SITE_KEY,
  useEmulator,
  isBrowser: typeof window !== 'undefined',
  dev: import.meta.env.DEV,
})

export const db = initializeFirestore(app, {
  // Optional fields left `undefined` are dropped instead of failing the whole write.
  ignoreUndefinedProperties: true,
  // No IndexedDB (jsdom unit tests, Node): fall back to the in-memory cache.
  localCache:
    typeof indexedDB === 'undefined'
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

export const auth = getAuth(app)

if (useEmulator) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  // Marker the e2e suite asserts, so a run against production config aborts.
  if (typeof document !== 'undefined') document.documentElement.dataset.emulator = 'true'
} else if (typeof window !== 'undefined') {
  // Analytics is lazy and never runs in emulator mode or unsupported environments (e.g. jsdom).
  void import('firebase/analytics').then(async ({ getAnalytics, isSupported, logEvent }) => {
    if (!(await isSupported())) return
    const analytics = getAnalytics(app)
    // A wrong site key or domain makes every read fail: log the first failure once.
    if (appCheck) watchAppCheckErrors(appCheck, () => logEvent(analytics, 'app_check_error'))
  })
}
