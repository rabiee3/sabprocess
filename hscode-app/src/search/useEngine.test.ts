import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { IndexEntry } from '../lib/types'
import { fixtures as base } from './fixtures'
import { useEngine } from './useEngine'

type Idle = (cb: () => void, opts?: { timeout?: number }) => number
const w = window as unknown as { requestIdleCallback?: Idle; cancelIdleCallback?: (h: number) => void }

afterEach(() => {
  delete w.requestIdleCallback
  delete w.cancelIdleCallback
  vi.useRealTimers()
})

function fakeIdle() {
  const queue = new Map<number, () => void>()
  let n = 0
  const ric = vi.fn<Idle>((cb) => {
    queue.set(++n, cb)
    return n
  })
  const cic = vi.fn((h: number) => void queue.delete(h))
  w.requestIdleCallback = ric
  w.cancelIdleCallback = cic
  const run = () => act(() => {
    const cbs = [...queue.values()]
    queue.clear()
    cbs.forEach((cb) => cb())
  })
  return { ric, cic, run, pending: () => queue.size }
}

// A fresh array per test: engines are memoised by array identity.
let fixtures: IndexEntry[]
beforeEach(() => {
  fixtures = [...base]
})

describe('useEngine', () => {
  it('is null until the idle callback runs, then the engine (with a 1500 ms timeout)', () => {
    const idle = fakeIdle()
    const { result } = renderHook(() => useEngine(fixtures))
    expect(result.current).toBeNull()
    expect(idle.ric).toHaveBeenCalledWith(expect.any(Function), { timeout: 1500 })
    idle.run()
    expect(result.current?.byId('f1')?.id).toBe('f1')
  })

  it('stays null without entries and schedules nothing', () => {
    const idle = fakeIdle()
    const { result } = renderHook(() => useEngine(null))
    expect(result.current).toBeNull()
    expect(idle.ric).not.toHaveBeenCalled()
  })

  it('unmount cancels the pending build', () => {
    const idle = fakeIdle()
    const { unmount } = renderHook(() => useEngine(fixtures))
    unmount()
    expect(idle.cic).toHaveBeenCalled()
    expect(idle.pending()).toBe(0)
  })

  it('new entries keep the previous engine until the new one is ready (no blank results on an index swap)', () => {
    const idle = fakeIdle()
    const { result, rerender } = renderHook(({ e }: { e: IndexEntry[] }) => useEngine(e), { initialProps: { e: fixtures } })
    idle.run()
    const first = result.current
    expect(first).not.toBeNull()
    const next = fixtures.slice(0, 2)
    rerender({ e: next })
    expect(result.current).toBe(first)
    idle.run()
    expect(result.current).not.toBe(first)
    expect(result.current?.all()).toHaveLength(2)
  })

  it('new entries cancel a build that is still pending', () => {
    const idle = fakeIdle()
    const { result, rerender } = renderHook(({ e }: { e: IndexEntry[] }) => useEngine(e), { initialProps: { e: fixtures } })
    const next = fixtures.slice(0, 2)
    rerender({ e: next })
    expect(idle.cic).toHaveBeenCalledTimes(1)
    expect(idle.pending()).toBe(1)
    expect(result.current).toBeNull()
    idle.run()
    expect(result.current?.all()).toHaveLength(2)
  })

  it('returns an engine already built for the same entries at once (remount)', () => {
    const idle = fakeIdle()
    const first = renderHook(() => useEngine(fixtures))
    idle.run()
    const built = first.result.current
    first.unmount()
    const again = renderHook(() => useEngine(fixtures))
    expect(again.result.current).toBe(built)
  })

  it('falls back to setTimeout(…, 1) without requestIdleCallback', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useEngine(fixtures))
    expect(result.current).toBeNull()
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).not.toBeNull()
  })
})
