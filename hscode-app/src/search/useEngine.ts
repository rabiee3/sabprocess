import { useEffect, useState } from 'react'
import type { IndexEntry } from '../lib/types'
import { getEngine, peekEngine, type Engine } from './engine'

type Idle = (cb: () => void, opts?: { timeout?: number }) => number
type IdleWindow = { requestIdleCallback?: Idle; cancelIdleCallback?: (h: number) => void }

/** Runs `cb` when the main thread is idle, at the latest after 1.5 s; returns a cancel function. */
function whenIdle(cb: () => void): () => void {
  const w = (typeof window === 'undefined' ? {} : window) as IdleWindow
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const cancel = w.cancelIdleCallback
    const h = w.requestIdleCallback(cb, { timeout: 1500 })
    return () => cancel(h)
  }
  const h = setTimeout(cb, 1)
  return () => clearTimeout(h)
}

/**
 * The search engine for `entries`, built when the main thread is idle (spec §8) so the map can paint its pins
 * first. Null until it is ready; an engine already built for the same entries (a remount) is returned at once.
 */
export function useEngine(entries: IndexEntry[] | null): Engine | null {
  const [built, setBuilt] = useState<{ entries: IndexEntry[]; engine: Engine } | null>(null)

  useEffect(() => {
    if (!entries || peekEngine(entries)) return
    return whenIdle(() => setBuilt({ entries, engine: getEngine(entries) }))
  }, [entries])

  if (!entries) return null
  if (built?.entries === entries) return built.engine
  return peekEngine(entries) ?? null
}
