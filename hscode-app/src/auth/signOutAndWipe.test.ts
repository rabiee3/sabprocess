import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
const waitForPendingWrites = vi.fn()
const terminate = vi.fn()
const clearIndexedDbPersistence = vi.fn()
const signOut = vi.fn()
vi.mock('firebase/firestore', () => ({
  waitForPendingWrites: (...a: unknown[]) => waitForPendingWrites(...a),
  terminate: (...a: unknown[]) => terminate(...a),
  clearIndexedDbPersistence: (...a: unknown[]) => clearIndexedDbPersistence(...a),
}))
vi.mock('firebase/auth', () => ({ signOut: (...a: unknown[]) => signOut(...a) }))
// The defaults are loaded lazily; a test that forgets to inject them must not start a real Firestore.
vi.mock('../firebase/db', () => ({ db: { real: 'db' } }))
vi.mock('../firebase/app', () => ({ auth: { real: 'auth' } }))

import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { signOutAndWipe } from './signOutAndWipe'

const db = { db: 1 } as unknown as Firestore
const auth = { auth: 1 } as unknown as Auth
const reload = vi.fn(() => {
  calls.push('reload')
})
const deps = () => ({ db, auth, reload })
const step = (name: string) => () => {
  calls.push(name)
  return Promise.resolve()
}

beforeEach(() => {
  calls.length = 0
  reload.mockClear()
  waitForPendingWrites.mockReset().mockImplementation(step('waitForPendingWrites'))
  terminate.mockReset().mockImplementation(step('terminate'))
  clearIndexedDbPersistence.mockReset().mockImplementation(step('clear'))
  signOut.mockReset().mockImplementation(step('signOut'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('signOutAndWipe', () => {
  it('waits for pending writes, then signs out, terminates, clears and reloads, in that order', async () => {
    expect(await signOutAndWipe(deps())).toBe('wiped')
    expect(calls).toEqual(['waitForPendingWrites', 'signOut', 'terminate', 'clear', 'reload'])
    expect(waitForPendingWrites).toHaveBeenCalledWith(db)
    expect(signOut).toHaveBeenCalledWith(auth)
    expect(terminate).toHaveBeenCalledWith(db)
    expect(clearIndexedDbPersistence).toHaveBeenCalledWith(db)
  })

  it('writes still pending after 5 s: signs out but keeps the cache (no terminate, no clear, no reload)', async () => {
    vi.useFakeTimers()
    waitForPendingWrites.mockImplementation(() => new Promise(() => {}))
    const result = signOutAndWipe(deps())
    await vi.advanceTimersByTimeAsync(4999)
    expect(signOut).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toBe('kept')
    expect(signOut).toHaveBeenCalledWith(auth)
    expect(terminate).not.toHaveBeenCalled()
    expect(clearIndexedDbPersistence).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('writes that cannot be confirmed (waitForPendingWrites rejects) are kept too', async () => {
    waitForPendingWrites.mockRejectedValue(new Error('x'))
    expect(await signOutAndWipe(deps())).toBe('kept')
    expect(signOut).toHaveBeenCalled()
    expect(terminate).not.toHaveBeenCalled()
    expect(clearIndexedDbPersistence).not.toHaveBeenCalled()
  })

  it('a clear failure (memory cache, another tab open) still reloads', async () => {
    clearIndexedDbPersistence.mockRejectedValue({ code: 'failed-precondition' })
    expect(await signOutAndWipe(deps())).toBe('wiped')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a terminate failure still reloads', async () => {
    terminate.mockRejectedValue(new Error('x'))
    expect(await signOutAndWipe(deps())).toBe('wiped')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('without deps it uses the app db and auth', async () => {
    const reloadSpy = vi.fn()
    expect(await signOutAndWipe({ reload: reloadSpy })).toBe('wiped')
    expect(waitForPendingWrites).toHaveBeenCalledWith({ real: 'db' })
    expect(signOut).toHaveBeenCalledWith({ real: 'auth' })
    expect(reloadSpy).toHaveBeenCalled()
  })
})
