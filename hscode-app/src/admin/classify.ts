import { AdminError } from './repo'

export type ActionError = 'stale' | 'indexFull' | 'invalid' | 'offline' | 'generic'

export function classify(e: unknown): ActionError {
  if (e instanceof AdminError) return e.code
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'generic'
}
