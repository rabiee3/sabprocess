import { loadAnalytics, useEmulator } from '../firebase/app'

// At most this many reports per page load, so a render loop cannot flood Analytics.
const MAX_PER_SESSION = 10

const EMAIL = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+\.[^\s@<>()[\]"',;:]+/g
// Phone numbers: 6+ digits (ASCII, Arabic-Indic or Eastern Arabic-Indic), allowing one space, dash or dot between
// them (010 1234 5678, +20 10-1234-5678, ٠١٠١٢٣٤٥٦٧٨). HS headings and codes (4 or 5 digits) stay readable.
const PHONE = /(?:[0-9٠-٩۰-۹][\s.-]?){5,}[0-9٠-٩۰-۹]/g
// A URL's query string or hash can carry tokens or search text: an absolute URL's, or a path token's (one that
// starts with "/"), so "and/or?" stays. Each has a single quantifier before the "?", so matching stays linear,
// and no lookbehind (older Safari cannot parse it).
const ABS_URL_QUERY = /(\b[a-z][a-z\d+.-]*:\/\/[^\s?#]*)[?#]\S*/gi
const PATH_QUERY = /(^|[\s(])(\/[^\s?#]*)[?#]\S*/g
// Firestore document paths name a factory or a user.
const DOC_PATH = /\b(factories|users|invites|photos|private|searchIndex|contacts)\/[^\s/?#]+/g
// Document ids, uids and tokens (letters, digits, dashes, underscores).
const LONG_TOKEN = /(^|[^\w-])[\w-]{20,}(?=[^\w-]|$)/g
// Regexes only ever see this much of a message, however long it is.
const MAX_INPUT = 500

const seen = new Set<string>()
let installed = false

function messageOf(err: unknown): string {
  if (typeof err === 'string') return err
  if (err == null) return 'unknown'
  if (typeof err !== 'object') return String(err)
  const o = err as { message?: unknown; name?: unknown; status?: unknown; statusText?: unknown }
  if (typeof o.message === 'string' && o.message) return o.message
  // A router ErrorResponse (a 404 or a thrown Response): its status says what happened.
  if (typeof o.status === 'number') return `${o.status} ${typeof o.statusText === 'string' ? o.statusText : ''}`.trim()
  if (typeof o.name === 'string' && o.name) return o.name
  const ctor = (err as { constructor?: { name?: string } }).constructor?.name
  return ctor && ctor !== 'Object' ? ctor : 'non-error object'
}

/** `where: message` with no personal data (emails, phones, ids, document paths, URL queries), at most 100 chars. */
export function describeError(err: unknown, where: string): string {
  const clean = String(messageOf(err))
    .slice(0, MAX_INPUT)
    .replace(ABS_URL_QUERY, '$1')
    .replace(PATH_QUERY, '$1$2')
    .replace(EMAIL, '[email]')
    .replace(DOC_PATH, '$1/[id]')
    .replace(LONG_TOKEN, '$1[id]')
    .replace(PHONE, '[n]')
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
