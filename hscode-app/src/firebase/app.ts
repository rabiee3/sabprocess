import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { setupAppCheck, watchAppCheckErrors } from './appCheck'
import { EMULATOR_PROJECT_ID, RECAPTCHA_SITE_KEY, firebaseConfig } from './config'

// App + Auth only. Firestore lives in ./db so it stays out of the entry chunk; ./db imports this module,
// so App Check below always initialises before Firestore's first request.

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

export const auth = getAuth(app)

if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  // Marker the e2e suite asserts, so a run against production config aborts.
  if (typeof document !== 'undefined') document.documentElement.dataset.emulator = 'true'
}

/** Logs an Analytics event. */
export type LogEvent = (name: string, params?: Record<string, unknown>) => void

let analytics: Promise<LogEvent | null> | null = null

/**
 * Analytics, loaded lazily on first use and shared. Null in emulator mode, outside a browser, in unsupported
 * environments (e.g. jsdom) or when the chunk cannot load.
 */
export function loadAnalytics(): Promise<LogEvent | null> {
  if (useEmulator || typeof window === 'undefined') return Promise.resolve(null)
  analytics ??= import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported, logEvent }) => {
      if (!(await isSupported())) return null
      const a = getAnalytics(app)
      return ((name, params) => logEvent(a, name, params)) satisfies LogEvent
    })
    .catch(() => null)
  return analytics
}

// Analytics starts with the app (outside the emulator). A wrong App Check site key or domain makes every read
// fail: log the first failure once.
void loadAnalytics().then((log) => {
  if (log && appCheck) watchAppCheckErrors(appCheck, () => log('app_check_error'))
})
