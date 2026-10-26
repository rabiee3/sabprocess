export type FirestoreErrorKind = 'offline' | 'denied' | 'quota' | 'generic'

/** What a Firestore (or App Check) failure means for the user. `quota` is the Spark plan's daily limit. */
export function classifyFirestoreError(err: unknown): FirestoreErrorKind {
  const code = String((err as { code?: unknown } | null)?.code ?? '').replace(/^firestore\//, '')
  const msg = String((err as { message?: unknown } | null)?.message ?? '')
  if (code === 'resource-exhausted') return 'quota'
  if (code === 'permission-denied' || code === 'unauthenticated' || code.startsWith('app-check') || /app-check/i.test(msg)) {
    return 'denied'
  }
  if (code === 'unavailable' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 'offline'
  return 'generic'
}

/** The i18n key to show for a failed read: the service-busy message on quota, else the screen's own message. */
export function firestoreErrorKey(err: unknown, fallback: string): string {
  return classifyFirestoreError(err) === 'quota' ? 'errors.quota' : fallback
}
