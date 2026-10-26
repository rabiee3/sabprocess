import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ADMIN_UID } from '../firebase/config'
// Only the app/auth module: Firestore is loaded lazily (./roleWatcher) to keep it out of the entry chunk.
import { auth } from '../firebase/app'
import { AuthContext, type AuthState, type Role } from './context'

// Roles a users doc may grant. The admin comes only from the UID, never from the doc.
const ROLES: Role[] = ['client', 'surveyor']
const VISITOR: AuthState = { user: null, role: 'visitor', active: false, loading: false }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...VISITOR, loading: true })

  useEffect(() => {
    let unsubDoc: (() => void) | undefined
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubDoc?.()
      unsubDoc = undefined
      if (!user) return setState(VISITOR)
      if (user.uid === ADMIN_UID) return setState({ user, role: 'admin', active: true, loading: false })

      // Fresh loading state for the new user so guards don't see a stale or visitor role.
      setState({ user, role: 'visitor', active: false, loading: true })
      let cancelled = false
      let unsubSnap: (() => void) | undefined
      unsubDoc = () => {
        cancelled = true
        unsubSnap?.()
      }
      const fallBackToClient = () => setState({ user, role: 'client', active: false, loading: false })
      void (async () => {
        let watcher: typeof import('./roleWatcher')
        try {
          watcher = await import('./roleWatcher')
        } catch {
          // The chunk failed to load (e.g. offline on a fresh deploy): same outcome as a snapshot error.
          if (!cancelled) fallBackToClient()
          return
        }
        if (cancelled) return
        try {
          await watcher.ensureUserDoc(user)
        } catch {
          // Offline or denied: fall through to the snapshot, which resolves from cache if it can.
        }
        if (cancelled) return
        unsubSnap = watcher.watchUserDoc(
          user.uid,
          (snap) => {
            const data = snap.data()
            // A claim's optimistic local write would flip the UI to surveyor before the server decides; a rejected
            // claim would then bounce back and wipe the invalid-code message. Wait for the server's verdict.
            if (snap.metadata?.hasPendingWrites && data?.role === 'surveyor') {
              // Still loading (e.g. an offline reopen with an unconfirmed claim): show the client view, never a spinner.
              setState((prev) =>
                prev.user?.uid === user.uid && prev.loading ? { user, role: 'client', active: data.active === true, loading: false } : prev,
              )
              return
            }
            const role = ROLES.includes(data?.role as Role) ? (data?.role as Role) : 'client'
            setState({ user, role, active: data?.active === true, loading: false })
          },
          fallBackToClient,
        )
      })()
    })
    return () => {
      unsubAuth()
      unsubDoc?.()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
