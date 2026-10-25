import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase/firestore'

const getDoc = vi.fn()
// A plain function for the failing read: a vi.fn returning a rejected promise is reported as unhandled.
let getDocFails = false
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: (_fs: unknown, path: string) => ({ path }),
  getDoc: (ref: unknown) => (getDocFails ? Promise.reject(new Error('unavailable')) : getDoc(ref)),
}))
vi.mock('../firebase', () => ({ db: {} }))

import { classifySubmitError, factoryDocExists } from './repo'

const fs = {} as Firestore
const denied = { code: 'permission-denied' }
const userDoc = (data: Record<string, unknown> | undefined) => ({ data: () => data })

describe('classifySubmitError', () => {
  beforeEach(() => {
    getDoc.mockReset()
    getDocFails = false
  })

  it('maps non-permission errors directly without reading the user', async () => {
    expect(await classifySubmitError({ code: 'unavailable' }, 'u1', fs)).toBe('offline')
    expect(await classifySubmitError({ code: 'resource-exhausted' }, 'u1', fs)).toBe('quota')
    expect(await classifySubmitError(new Error('x'), 'u1', fs)).toBe('generic')
    expect(getDoc).not.toHaveBeenCalled()
  })

  it('an active surveyor whose write was denied gets rejected, not accessOff', async () => {
    getDoc.mockResolvedValue(userDoc({ role: 'surveyor', active: true }))
    expect(await classifySubmitError(denied, 'u1', fs)).toBe('rejected')
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/u1' })
  })

  it('a deactivated or demoted account gets accessOff', async () => {
    getDoc.mockResolvedValue(userDoc({ role: 'surveyor', active: false }))
    expect(await classifySubmitError(denied, 'u1', fs)).toBe('accessOff')
    getDoc.mockResolvedValue(userDoc({ role: 'client', active: true }))
    expect(await classifySubmitError(denied, 'u1', fs)).toBe('accessOff')
    getDoc.mockResolvedValue(userDoc(undefined))
    expect(await classifySubmitError(denied, 'u1', fs)).toBe('accessOff')
  })

  it('an unreadable user doc falls back to rejected', async () => {
    getDocFails = true
    expect(await classifySubmitError(denied, 'u1', fs)).toBe('rejected')
  })
})

describe('factoryDocExists', () => {
  beforeEach(() => {
    getDoc.mockReset()
    getDocFails = false
  })

  it('is false only when the read succeeds and finds nothing', async () => {
    getDoc.mockResolvedValue({ exists: () => false })
    expect(await factoryDocExists('f1', fs)).toBe(false)
    expect(getDoc).toHaveBeenCalledWith({ path: 'factories/f1' })
    getDoc.mockResolvedValue({ exists: () => true })
    expect(await factoryDocExists('f1', fs)).toBe(true)
  })

  it('any read error (offline, no cache) counts as existing', async () => {
    getDocFails = true
    expect(await factoryDocExists('f1', fs)).toBe(true)
  })
})
