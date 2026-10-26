import { loadAnalytics, useEmulator } from '../firebase/app'

// At most this many reports per page load, so a render loop cannot flood Analytics.
const MAX_PER_SESSION = 10

const EMAIL = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[^\s@<>()[\]"',;:]+/g
// Phone numbers and similar ids. HS codes (4 to 10 digits) are not personal, but a 6+ digit run may be a phone.
const LONG_DIGITS = /\d{6,}/g
// A URL's query string can carry tokens or search text.
const URL_QUERY = /(\b[a-z][a-z\d+.-]*:\/\/[^\s?#]*)[?#][^\s]*/gi

const seen = new Set<string>()
let installed = false

function messageOf(err: unknown): string {
  if (typeof err === 'string') return err
  const m = (err as { message?: unknown } | null | undefined)?.message
  if (typeof m === 'string' && m) return m
  return err == null ? 'unknown' : String(err)
}

/** `where: message`, with no personal data (emails, long digit runs, URL query strings), at most 100 chars. */
export function describeError(err: unknown, where: string): string {
  const clean = messageOf(err).replace(URL_QUERY, '$1').replace(EMAIL, '[email]').replace(LONG_DIGITS, '[n]')
  return `${where}: ${clean}`.slice(0, 100)
}

/** Logs an Analytics `exception` (not fatal). Never in the emulator; each message once; never throws. */
export function reportError(err: unknown, where: string): void {
  if (useEmulator) return
  try {
    const description = describeError(err, where)
    if (seen.has(description) || seen.size >= MAX_PER_SESSION) return
    seen.add(description)
    loadAnalytics().then(
      (log) => log?.('exception', { description, fatal: false }),
      () => {},
    )
  } catch {
    // Reporting must never become the error.
  }
}

/** Reports uncaught errors and unhandled promise rejections. Installed once, never in the emulator. */
export function installErrorReporting(target: EventTarget = window): void {
  if (useEmulator || installed) return
  installed = true
  target.addEventListener('error', (e) => {
    const ev = e as ErrorEvent
    reportError(ev.error ?? ev.message, 'window')
  })
  target.addEventListener('unhandledrejection', (e) => reportError((e as PromiseRejectionEvent).reason, 'promise'))
}
