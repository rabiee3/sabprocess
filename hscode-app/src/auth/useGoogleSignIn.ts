import { useCallback, useState } from 'react'
import { signInWithGoogle } from './api'

const IGNORED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

/** Starts Google sign-in; surfaces every error except the user closing the popup. */
export function useGoogleSignIn() {
  const [failed, setFailed] = useState(false)
  const signIn = useCallback(() => {
    setFailed(false)
    signInWithGoogle().catch((e: unknown) => {
      const code = (e as { code?: string })?.code
      if (!code || !IGNORED.has(code)) setFailed(true)
    })
  }, [])
  const clearError = useCallback(() => setFailed(false), [])
  return { signIn, failed, clearError }
}
