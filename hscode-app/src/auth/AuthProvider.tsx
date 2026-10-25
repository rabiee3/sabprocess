import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { ADMIN_UID } from '../firebase/config'
import { auth, db } from '../firebase'
import { ensureUserDoc } from './api'
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
      void (async () => {
        try {
          await ensureUserDoc(user)
        } catch {
          // Offline or denied: fall through to the snapshot, which resolves from cache if it can.
        }
        if (cancelled) return
        unsubSnap = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            const data = snap.data()
            const role = ROLES.includes(data?.role) ? (data?.role as Role) : 'client'
            setState({ user, role, active: data?.active === true, loading: false })
          },
          () => setState({ user, role: 'client', active: false, loading: false }),
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
