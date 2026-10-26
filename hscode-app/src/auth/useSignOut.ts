import { useCallback, useSyncExternalStore } from 'react'
import { clearFactoryCache } from '../client/factoryCache'
import { signOutAndWipe } from './signOutAndWipe'

// Sign-out state as module state: `kept` (the last sign-out kept this phone's saved data, writes still queued)
// outlives the component that signed out (the admin layout unmounts as soon as the user is gone), and `busy`
// is shared by every Sign out button while the wait of up to 5 s runs.
type State = { kept: boolean; busy: boolean }
let state: State = { kept: false, busy: false }
const listeners = new Set<() => void>()
const update = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getState = () => state

/**
 * Sign out through signOutAndWipe. The session factory cache is emptied on every sign-out, so the next user of
 * this tab never sees a cached factory (one that is not public) without a rules check. `kept` drives the
 * `nav.signOutKeptData` banner; `busy` disables the Sign out buttons.
 */
export function useSignOut() {
  const { kept, busy } = useSyncExternalStore(subscribe, getState, getState)
  const signOut = useCallback(async () => {
    if (state.busy) return
    update({ busy: true, kept: false })
    try {
      if ((await signOutAndWipe({ onSignedOut: clearFactoryCache })) === 'kept') update({ kept: true })
    } catch {
      // Sign-out itself failed: still signed in, and the Sign out button is there to try again.
    } finally {
      update({ busy: false })
    }
  }, [])
  const dismiss = useCallback(() => update({ kept: false }), [])
  return { signOut, kept, busy, dismiss }
}
