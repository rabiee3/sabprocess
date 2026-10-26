import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const waitForPendingWrites = vi.fn()
const signOut = vi.fn()
vi.mock('firebase/firestore', () => ({
  waitForPendingWrites: (...a: unknown[]) => waitForPendingWrites(...a),
  terminate: vi.fn().mockResolvedValue(undefined),
  clearIndexedDbPersistence: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('firebase/auth', () => ({ signOut: (...a: unknown[]) => signOut(...a) }))
vi.mock('../firebase/db', () => ({ db: {} }))
vi.mock('../firebase/app', () => ({ auth: {} }))

import { useSignOut } from './useSignOut'
import { getCached, setCached } from '../client/factoryCache'
import type { LoadedFactory } from '../client/factoryCache'

const load = { factory: { id: 'f1', status: 'pending' }, isPublic: false } as unknown as LoadedFactory

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(undefined)
  waitForPendingWrites.mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSignOut', () => {
  it('a kept sign-out (writes still pending) empties the factory cache and sets kept', async () => {
    waitForPendingWrites.mockRejectedValue(new Error('pending'))
    setCached('f1', { load, photos: null })
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(getCached('f1')).toBeUndefined()
    expect(result.current.kept).toBe(true)
    act(() => result.current.dismiss())
  })

  // The order (cache cleared after signOut, before terminate and reload) is pinned in signOutAndWipe.test.ts.
  it('a wiped sign-out empties the factory cache too', async () => {
    waitForPendingWrites.mockResolvedValue(undefined)
    setCached('f1', { load, photos: null })
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(getCached('f1')).toBeUndefined()
    expect(result.current.kept).toBe(false)
  })

  it('busy while the wait runs; a second click is ignored; it clears afterwards', async () => {
    let finish: () => void = () => {}
    waitForPendingWrites.mockImplementation(() => new Promise<void>((r) => { finish = () => r() }))
    const { result } = renderHook(() => useSignOut())
    let first!: Promise<void>
    act(() => {
      first = result.current.signOut()
    })
    expect(result.current.busy).toBe(true)
    await act(() => result.current.signOut())
    await vi.waitFor(() => expect(waitForPendingWrites).toHaveBeenCalledTimes(1))
    await act(async () => {
      finish()
      await first
    })
    expect(result.current.busy).toBe(false)
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('a failed sign-out resets busy, so a later click works', async () => {
    waitForPendingWrites.mockResolvedValue(undefined)
    signOut.mockRejectedValueOnce(new Error('net'))
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(result.current.busy).toBe(false)
    await act(() => result.current.signOut())
    expect(signOut).toHaveBeenCalledTimes(2)
  })
})
