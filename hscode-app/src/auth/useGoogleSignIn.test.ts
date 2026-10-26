import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const signInWithGoogle = vi.fn()
vi.mock('./api', () => ({ signInWithGoogle: () => signInWithGoogle() }))

import { useGoogleSignIn } from './useGoogleSignIn'

async function run(code: string) {
  signInWithGoogle.mockImplementation(() => Promise.reject({ code }))
  const hook = renderHook(() => useGoogleSignIn())
  act(() => {
    hook.result.current.signIn()
  })
  await act(async () => {})
  return hook
}

describe('useGoogleSignIn', () => {
  beforeEach(() => {
    signInWithGoogle.mockReset()
  })

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])('%s is not a failure', async (code) => {
    const { result } = await run(code)
    expect(signInWithGoogle).toHaveBeenCalled()
    expect(result.current.failed).toBe(false)
  })
  it('network failure sets failed; clearError resets', async () => {
    const { result } = await run('auth/network-request-failed')
    expect(result.current.failed).toBe(true)
    act(() => result.current.clearError())
    expect(result.current.failed).toBe(false)
  })
})
