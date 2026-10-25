import { useCallback, useEffect, useRef, useState } from 'react'

export type NearMeStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable'
export type LatLng = { lat: number; lng: number }

/** One-shot geolocation, only when request() is called (never on mount). */
export function useNearMe() {
  const [state, setState] = useState<{ status: NearMeStatus; pos?: LatLng }>({ status: 'idle' })
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
        if (alive.current) setState({ status: 'ok', pos: { lat: p.coords.latitude, lng: p.coords.longitude } })
      },
      (e) => {
        if (alive.current) setState({ status: e.code === 1 ? 'denied' : 'unavailable' })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  return { status: state.status, pos: state.pos, request }
}
