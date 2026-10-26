import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { resetNearMeCache, useNearMe } from './useNearMe'

const getCurrentPosition = vi.fn()
const setGeo = (v: unknown) => Object.defineProperty(globalThis.navigator, 'geolocation', { value: v, configurable: true })
beforeEach(() => {
  resetNearMeCache()
  vi.useRealTimers()
  getCurrentPosition.mockReset()
  setGeo({ getCurrentPosition })
})
afterEach(() => setGeo(undefined))

describe('useNearMe', () => {
  it('starts idle and does not ask until request()', () => {
    const { result } = renderHook(() => useNearMe())
    expect(result.current.status).toBe('idle')
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('request asks once with the pinned options and is locating meanwhile', () => {
    const { result } = renderHook(() => useNearMe())
    act(() => result.current.request())
    expect(result.current.status).toBe('locating')
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
  })

  it('ok gives pos', () => {
    getCurrentPosition.mockImplementation((ok) => ok({ coords: { latitude: 30.1, longitude: 31.2 } }))
    const { result } = renderHook(() => useNearMe())
    act(() => result.current.request())
    expect(result.current.status).toBe('ok')
    expect(result.current.pos).toEqual({ lat: 30.1, lng: 31.2 })
  })

  it('code 1 is denied', () => {
    getCurrentPosition.mockImplementation((_ok, err) => err({ code: 1 }))
    const { result } = renderHook(() => useNearMe())
    act(() => result.current.request())
    expect(result.current.status).toBe('denied')
    expect(result.current.pos).toBeUndefined()
  })

  it('other errors are unavailable', () => {
    getCurrentPosition.mockImplementation((_ok, err) => err({ code: 3 }))
    const { result } = renderHook(() => useNearMe())
    act(() => result.current.request())
    expect(result.current.status).toBe('unavailable')
  })

  it('no geolocation api is unavailable', () => {
    setGeo(undefined)
    const { result } = renderHook(() => useNearMe())
    act(() => result.current.request())
    expect(result.current.status).toBe('unavailable')
  })

  it('a result after unmount is ignored', () => {
    let cb: ((p: unknown) => void) | undefined
    getCurrentPosition.mockImplementation((ok) => { cb = ok })
    const { result, unmount } = renderHook(() => useNearMe())
    act(() => result.current.request())
    unmount()
    expect(() => cb?.({ coords: { latitude: 1, longitude: 2 } })).not.toThrow()
  })
})

describe('useNearMe cache', () => {
  const fix = () => {
    getCurrentPosition.mockImplementation((ok) => ok({ coords: { latitude: 30.1, longitude: 31.2 } }))
    const first = renderHook(() => useNearMe())
    act(() => first.result.current.request())
    first.unmount()
    getCurrentPosition.mockClear()
  }

  it('a fresh fix is restored on remount without asking again', () => {
    fix()
    const { result } = renderHook(() => useNearMe())
    expect(result.current.status).toBe('ok')
    expect(result.current.pos).toEqual({ lat: 30.1, lng: 31.2 })
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('a fix older than 10 minutes is not reused', () => {
    vi.useFakeTimers()
    fix()
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    const { result } = renderHook(() => useNearMe())
    expect(result.current.status).toBe('idle')
    expect(result.current.pos).toBeUndefined()
  })
})
