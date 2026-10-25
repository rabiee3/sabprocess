import { useCallback, useEffect, useState } from 'react'

export type GpsStatus = 'pending' | 'ok' | 'denied' | 'unavailable' | 'timeout'

export interface GeoState {
  status: GpsStatus
  coords?: { lat: number; lng: number }
  accuracyM?: number
}

export interface UseGeolocation extends GeoState {
  retry(): void
}

export function useGeolocation(opts: { timeoutMs?: number } = {}): UseGeolocation {
  const timeoutMs = opts.timeoutMs ?? 15000
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<GeoState>(() => ({
    status: typeof navigator !== 'undefined' && navigator.geolocation ? 'pending' : 'unavailable',
  }))

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return
    }
    let best: number | undefined
    let gotFix = false
    const timer = setTimeout(() => {
      if (!gotFix) setState((s) => (s.status === 'pending' ? { status: 'timeout' } : s))
    }, timeoutMs)
    const id = navigator.geolocation.watchPosition(
      (p) => {
        gotFix = true
        clearTimeout(timer)
        const acc = p.coords.accuracy
        if (best !== undefined && acc >= best) return
        best = acc
        setState({ status: 'ok', coords: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracyM: acc })
      },
      (e) => {
        clearTimeout(timer)
        // Keep an existing fix on transient errors; only report when nothing usable yet.
        setState((s) => (s.status === 'ok' ? s : { status: e.code === 1 ? 'denied' : 'timeout' }))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    )
    return () => {
      clearTimeout(timer)
      navigator.geolocation.clearWatch(id)
    }
  }, [attempt, timeoutMs])

  const retry = useCallback(() => {
    setState((s) => (s.status === 'ok' ? s : { status: 'pending' }))
    setAttempt((n) => n + 1)
  }, [])
  return { ...state, retry }
}
