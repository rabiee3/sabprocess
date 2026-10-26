import { useEffect, useState } from 'react'
import { whenIdle } from '../lib/idle'
import type { IndexEntry } from '../lib/types'
import { getEngine, peekEngine, type Engine } from './engine'

/**
 * The search engine for `entries`, built when the main thread is idle (spec §8) so the map can paint its pins
 * first. Null until the first one is ready; while a newer index builds, the previous engine is kept. An engine
 * already built for the same entries (a remount) is returned at once.
 */
export function useEngine(entries: IndexEntry[] | null): Engine | null {
  const [built, setBuilt] = useState<{ entries: IndexEntry[]; engine: Engine } | null>(null)

  useEffect(() => {
    if (!entries || peekEngine(entries)) return
    return whenIdle(() => setBuilt({ entries, engine: getEngine(entries) }))
  }, [entries])

  if (!entries) return null
  if (built?.entries === entries) return built.engine
  // A newer index (cache, then server): keep searching with the previous engine until this one is built, so the
  // results and pins don't blank out in between.
  return peekEngine(entries) ?? built?.engine ?? null
}
