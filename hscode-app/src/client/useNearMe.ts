import { useCallback, useEffect, useRef, useState } from 'react'

export type NearMeStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable'
export type LatLng = { lat: number; lng: number }

const FRESH_MS = 10 * 60 * 1000
let lastFix: { pos: LatLng; at: number } | null = null
const freshFix = () => (lastFix && Date.now() - lastFix.at < FRESH_MS ? lastFix.pos : undefined)
/** Test hook. */
export function resetNearMeCache() {
  lastFix = null
}

/** One-shot geolocation, only when request() is called (never on mount). */
export function useNearMe() {
  const [state, setState] = useState<{ status: NearMeStatus; pos?: LatLng }>(() => {
    // Back from a factory page: restore a recent fix without prompting again.
    const pos = freshFix()
    return pos ? { status: 'ok', pos } : { status: 'idle' }
  })
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'unavailable' })
      return
    }
    setState((s) => ({ ...s, status: 'locating' }))
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        lastFix = { pos, at: Date.now() }
        if (alive.current) setState({ status: 'ok', pos })
      },
      (e) => {
        if (alive.current) setState({ status: e.code === 1 ? 'denied' : 'unavailable' })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  return { status: state.status, pos: state.pos, request }
}
