import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGeolocation } from './useGeolocation'

type Ok = (p: GeolocationPosition) => void
type Err = (e: { code: number }) => void
let onOk: Ok
let onErr: Err
const clearWatch = vi.fn()
const watchPosition = vi.fn((ok: Ok, err: Err) => {
  onOk = ok
  onErr = err
  return 7
})
const pos = (lat: number, lng: number, accuracy: number) =>
  ({ coords: { latitude: lat, longitude: lng, accuracy } }) as GeolocationPosition

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearWatch.mockClear()
    watchPosition.mockClear()
    Object.defineProperty(navigator, 'geolocation', {
      value: { watchPosition, clearWatch },
      configurable: true,
    })
  })
  afterEach(() => vi.useRealTimers())

  it('ok with coords on success', () => {
    const { result } = renderHook(() => useGeolocation())
    expect(result.current.status).toBe('pending')
    expect((watchPosition.mock.calls[0] as unknown[])[2]).toMatchObject({ enableHighAccuracy: true })
    act(() => onOk(pos(30, 31, 20)))
    expect(result.current.status).toBe('ok')
    expect(result.current.coords).toEqual({ lat: 30, lng: 31 })
    expect(result.current.accuracyM).toBe(20)
  })

  it('denied on error code 1', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => onErr({ code: 1 }))
    expect(result.current.status).toBe('denied')
  })

  it('unavailable on error code 2, timeout on code 3', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => onErr({ code: 2 }))
    expect(result.current.status).toBe('unavailable')
    act(() => result.current.retry())
    act(() => onErr({ code: 3 }))
    expect(result.current.status).toBe('timeout')
  })

  it('timeout when no fix arrives', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => void vi.advanceTimersByTime(15000))
    expect(result.current.status).toBe('timeout')
  })

  it('no timeout once a fix arrived', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => onOk(pos(30, 31, 20)))
    act(() => void vi.advanceTimersByTime(20000))
    expect(result.current.status).toBe('ok')
  })

  it('keeps the best fix', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => onOk(pos(30, 31, 20)))
    act(() => onOk(pos(30.5, 31.5, 90)))
    expect(result.current.accuracyM).toBe(20)
    expect(result.current.coords).toEqual({ lat: 30, lng: 31 })
    act(() => onOk(pos(30.1, 31.1, 5)))
    expect(result.current.accuracyM).toBe(5)
    expect(result.current.coords).toEqual({ lat: 30.1, lng: 31.1 })
  })

  it('unavailable without geolocation', () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
    const { result } = renderHook(() => useGeolocation())
    expect(result.current.status).toBe('unavailable')
  })

  it('clears the watch on unmount', () => {
    const { unmount } = renderHook(() => useGeolocation())
    unmount()
    expect(clearWatch).toHaveBeenCalledWith(7)
  })

  it('retry restarts the watch', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => onErr({ code: 1 }))
    act(() => result.current.retry())
    expect(watchPosition).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('pending')
  })

  it('disabled: never starts a watch', () => {
    const { result } = renderHook(() => useGeolocation({ enabled: false }))
    expect(watchPosition).not.toHaveBeenCalled()
    expect(result.current.status).toBe('unavailable')
  })
})
