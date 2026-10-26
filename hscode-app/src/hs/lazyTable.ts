import { useEffect, useState } from 'react'

export type HsTable = typeof import('./tableModule')

let loaded: HsTable | null = null
let pending: Promise<HsTable> | null = null

/** The HS table (chapters, headings, heading search), fetched on first need and shared afterwards. */
export function loadHsTable(): Promise<HsTable> {
  if (loaded) return Promise.resolve(loaded)
  if (!pending) {
    const p = import('./tableModule').then((m) => (loaded = m))
    pending = p
    // Offline with the chunk not cached: let a later call try again.
    p.catch(() => {
      if (pending === p) pending = null
    })
  }
  return pending
}

/** The HS table once loaded; starts loading when `enabled`. `failed` when the chunk could not be fetched. */
export function useHsTable(enabled = true): { table: HsTable | null; failed: boolean } {
  const [state, setState] = useState<{ table: HsTable | null; failed: boolean }>({ table: loaded, failed: false })
  useEffect(() => {
    if (!enabled || state.table) return
    let live = true
    loadHsTable().then(
      (table) => live && setState({ table, failed: false }),
      () => live && setState({ table: null, failed: true }),
    )
    return () => {
      live = false
    }
  }, [enabled, state.table])
  return { table: state.table ?? loaded, failed: state.failed && !loaded }
}
