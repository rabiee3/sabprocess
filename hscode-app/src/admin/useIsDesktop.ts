import { useEffect, useState } from 'react'

const DESKTOP = '(min-width: 1024px)'

/** True at the sidebar breakpoint. Without matchMedia (tests) it is false, i.e. the drawer layout. */
export function useIsDesktop(): boolean {
  const [on, setOn] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(DESKTOP)
    const onChange = () => setOn(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return on
}
