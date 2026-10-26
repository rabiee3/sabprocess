import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { safeStorage } from '../../lib/safeStorage'

export const INTRO_KEY = 'hscode.introSeen'

/** Router state that asks the map to open the intro as "About" (sent from pages without the intro, e.g. /f/:id). */
export const ABOUT_STATE = { intro: 'about' } as const

const isAbout = (state: unknown) => (state as { intro?: unknown } | null)?.intro === ABOUT_STATE.intro

/**
 * The first-visit intro over the map. It opens by itself only on `/` with no query, until this device
 * dismisses it once. `show()` reopens it as "About"; closing that again leaves the stored key alone.
 * Not a route, so browser Back never has to close it.
 */
export function useIntro(): { open: boolean; show: () => void; dismiss: () => void } {
  const { pathname, search, hash, state } = useLocation()
  const navigate = useNavigate()
  const about = isAbout(state)
  const [intro, setIntro] = useState(() => ({
    open: about || (pathname === '/' && search === '' && safeStorage.get(INTRO_KEY) !== '1'),
    shown: about,
  }))

  // Consume the "About" request so a reload or Back to this entry does not reopen it.
  useEffect(() => {
    if (about) void navigate({ pathname, search, hash }, { replace: true, state: null })
  }, [about, navigate, pathname, search, hash])

  const show = useCallback(() => setIntro({ open: true, shown: true }), [])
  const dismiss = useCallback(() => {
    // Blocked storage (private mode): set() returns false and the intro simply shows again next visit.
    if (intro.open && !intro.shown) safeStorage.set(INTRO_KEY, '1')
    setIntro({ open: false, shown: false })
  }, [intro])

  return { open: intro.open, show, dismiss }
}
