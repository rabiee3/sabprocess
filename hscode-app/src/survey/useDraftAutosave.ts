import { useCallback, useEffect, useRef, useState } from 'react'
import { saveDraft, type Draft } from './draft'

export const SAVE_DELAY_MS = 500

/**
 * Saves the draft ~500 ms after the last change, and at once when `step` changes or the form unmounts.
 * `storageFull` is true while the last save did not stick. `finish(draft)` saves the final draft and stops
 * autosaving (submit); it returns whether that save stuck.
 */
export function useDraftAutosave(uid: string, draft: Draft, initial: Draft, step: string) {
  const [storageFull, setStorageFull] = useState(false)
  const pending = useRef<Draft | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const done = useRef(false)

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const d = pending.current
    pending.current = null
    if (d) setStorageFull(!saveDraft(uid, d))
  }, [uid])

  useEffect(() => {
    if (draft === initial || done.current) return
    pending.current = draft
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
  }, [draft, initial, flush])

  // Cleanup runs on every step change and on unmount.
  useEffect(() => () => flush(), [step, flush])

  const finish = useCallback(
    (final: Draft): boolean => {
      clearTimeout(timer.current)
      pending.current = null
      done.current = true
      return saveDraft(uid, final)
    },
    [uid],
  )

  return { storageFull, dismissStorageFull: () => setStorageFull(false), finish }
}
