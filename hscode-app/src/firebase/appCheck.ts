import type { FirebaseApp } from 'firebase/app'
import {
  type AppCheck,
  initializeAppCheck as realInitializeAppCheck,
  onTokenChanged,
  ReCaptchaV3Provider as RealReCaptchaV3Provider,
} from 'firebase/app-check'

export interface AppCheckOptions {
  siteKey: string
  useEmulator: boolean
  isBrowser: boolean
  dev: boolean
}

export interface AppCheckDeps {
  initializeAppCheck: typeof realInitializeAppCheck
  ReCaptchaV3Provider: typeof RealReCaptchaV3Provider
}

const realDeps: AppCheckDeps = {
  initializeAppCheck: realInitializeAppCheck,
  ReCaptchaV3Provider: RealReCaptchaV3Provider,
}

/** Starts App Check (reCAPTCHA v3). Returns null when it is off: no site key, emulator, or no browser. */
export function setupAppCheck(
  app: FirebaseApp,
  opts: AppCheckOptions,
  deps: AppCheckDeps = realDeps,
): AppCheck | null {
  if (!opts.siteKey || opts.useEmulator || !opts.isBrowser) return null
  // Dev: the SDK prints a debug token to the console; register it in the Firebase console.
  if (opts.dev) (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  return deps.initializeAppCheck(app, {
    provider: new deps.ReCaptchaV3Provider(opts.siteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

/** Calls `onFirstError` once, the first time App Check fails to get a token. */
export function watchAppCheckErrors(appCheck: AppCheck, onFirstError: () => void): void {
  let reported = false
  onTokenChanged(
    appCheck,
    () => {},
    () => {
      if (reported) return
      reported = true
      onFirstError()
    },
  )
}
