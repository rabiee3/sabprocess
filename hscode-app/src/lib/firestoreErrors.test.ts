import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyFirestoreError, firestoreErrorKey } from './firestoreErrors'

const err = (code: string, message = '') => Object.assign(new Error(message), { code })

describe('classifyFirestoreError', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['resource-exhausted', 'quota'],
    ['firestore/resource-exhausted', 'quota'],
    ['permission-denied', 'denied'],
    ['unauthenticated', 'denied'],
    ['app-check/token-error', 'denied'],
    ['unavailable', 'offline'],
    ['firestore/unavailable', 'offline'],
    ['internal', 'generic'],
  ])('maps %s to %s', (code, kind) => {
    expect(classifyFirestoreError(err(code))).toBe(kind)
  })

  it('maps an App Check failure message to denied', () => {
    expect(classifyFirestoreError(new Error('Firebase: AppCheck app-check/fetch-status-error'))).toBe('denied')
  })

  it('treats any error while the browser is offline as offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(classifyFirestoreError(err('internal'))).toBe('offline')
  })

  it('handles non-errors', () => {
    expect(classifyFirestoreError(undefined)).toBe('generic')
    expect(classifyFirestoreError('boom')).toBe('generic')
  })
})

describe('firestoreErrorKey', () => {
  it('shows the quota message for resource-exhausted and the fallback otherwise', () => {
    expect(firestoreErrorKey(err('resource-exhausted'), 'factory.loadError')).toBe('errors.quota')
    expect(firestoreErrorKey(err('internal'), 'factory.loadError')).toBe('factory.loadError')
    expect(firestoreErrorKey(err('permission-denied'), 'errors.generic')).toBe('errors.generic')
  })
})
