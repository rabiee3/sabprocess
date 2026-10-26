import { useCallback, useSyncExternalStore } from 'react'
import { signOutAndWipe } from './signOutAndWipe'

// Whether the last sign-out kept this phone's saved data (writes still queued). Module state, so the note
// outlives the component that signed out (the admin layout unmounts as soon as the user is gone).
let kept = false
let busy = false
const listeners = new Set<() => void>()
const setKept = (v: boolean) => {
  kept = v
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getKept = () => kept

/** Sign out through signOutAndWipe; `kept` drives the `nav.signOutKeptData` info banner. */
export function useSignOut() {
  const isKept = useSyncExternalStore(subscribe, getKept, getKept)
  const signOut = useCallback(async () => {
    if (busy) return
    busy = true
    setKept(false)
    try {
      if ((await signOutAndWipe()) === 'kept') setKept(true)
    } catch {
      // Sign-out itself failed: still signed in, and the Sign out button is still there to try again.
    } finally {
      busy = false
    }
  }, [])
  const dismiss = useCallback(() => setKept(false), [])
  return { signOut, kept: isKept, dismiss }
}
