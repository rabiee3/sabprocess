import { useEffect, useState } from 'react'
import type { Timestamp } from 'firebase/firestore'
import type { Factory } from '../lib/types'
import { draftFromFactory, type Draft } from '../survey/draft'
import type { ContactDraft, PhotoData } from '../survey/types'
import { loadForReview } from './repo'

export type Loaded = { factory: Factory; openedAt: Timestamp; contact: ContactDraft; photos: PhotoData[] }
export type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'failed' }
  | { kind: 'ready'; data: Loaded; draft: Draft }

/** Loads one factory (any status) with its contact and photos, and holds the editable draft. */
export function useFactoryLoad(fid: string) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    loadForReview(fid).then(
      (data) => {
        if (!live) return
        setState(data ? { kind: 'ready', data, draft: draftFromFactory(data.factory, data.contact, data.photos) } : { kind: 'missing' })
      },
      () => live && setState({ kind: 'failed' }),
    )
    return () => {
      live = false
    }
  }, [fid, attempt])

  return {
    state,
    reload: () => {
      setState({ kind: 'loading' })
      setAttempt((n) => n + 1)
    },
    setDraft: (data: Loaded, draft: Draft) => setState({ kind: 'ready', data, draft }),
  }
}
