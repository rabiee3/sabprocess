import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Factory } from '../lib/types'
import { emptyDraft, loadDraft, saveDraft } from './draft'
import { outbox } from './outbox'
import { SKEW_MS, reconcile } from './reconcile'
import type { SubmissionItem } from './repo'

const T = Date.UTC(2026, 9, 25, 12)
const MIN = 60_000
const item = (id: string, updatedAt: number, pendingWrite = false, status: Factory['status'] = 'pending'): SubmissionItem => ({
  factory: { id, status, updatedAt: new Date(updatedAt) } as Factory,
  pendingWrite,
})

/** Submits fid at device time `at`. */
function submittedAt(fid: string, at: number, kind: 'new' | 'edit' = 'edit') {
  vi.setSystemTime(at)
  outbox.add('u1', fid, kind)
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('reconcile', () => {
  it('SKEW_MS is five minutes', () => {
    expect(SKEW_MS).toBe(5 * MIN)
  })

  it('removes an entry the server confirms with a newer updatedAt, and clears its draft', () => {
    saveDraft('u1', emptyDraft('a'))
    submittedAt('a', T)
    expect(reconcile('u1', [item('a', T + 2000)], false)).toEqual([])
    expect(loadDraft('u1', 'a')).toBeNull()
  })

  it('accepts a server time up to five minutes behind the device clock', () => {
    submittedAt('a', T)
    expect(reconcile('u1', [item('a', T - 4 * MIN)], false)).toEqual([])
  })

  it('a server doc older than the submit marks the entry failed "rejected" and keeps the draft', () => {
    saveDraft('u1', { ...emptyDraft('a'), mode: 'edit' })
    submittedAt('a', T)
    const out = reconcile('u1', [item('a', T - 10 * MIN)], false)
    expect(out).toMatchObject([{ fid: 'a', state: 'failed', error: 'rejected' }])
    expect(loadDraft('u1', 'a')).not.toBeNull()
  })

  it('a NEW entry is confirmed by its doc even when the phone clock runs an hour ahead', () => {
    saveDraft('u1', emptyDraft('a'))
    submittedAt('a', T + 60 * MIN, 'new')
    expect(reconcile('u1', [item('a', T)], false)).toEqual([])
    expect(loadDraft('u1', 'a')).toBeNull()
  })

  it('an entry without a kind (old data) is treated as new', () => {
    localStorage.setItem('hscode.outbox.u1', JSON.stringify([{ fid: 'a', savedAt: T + 60 * MIN, submittedAt: T + 60 * MIN, state: 'saved' }]))
    expect(reconcile('u1', [item('a', T)], false)).toEqual([])
  })

  it('a failed NEW entry stays (and keeps its draft) even though its doc exists', () => {
    saveDraft('u1', emptyDraft('a'))
    submittedAt('a', T, 'new')
    outbox.markFailed('u1', 'a', 'rejected')
    expect(reconcile('u1', [item('a', T + 1000)], false)).toMatchObject([{ fid: 'a', state: 'failed', error: 'rejected' }])
    expect(loadDraft('u1', 'a')).not.toBeNull()
  })

  it('a kind-less entry whose stored draft is an edit keeps the clock check', () => {
    saveDraft('u1', { ...emptyDraft('a'), mode: 'edit' })
    localStorage.setItem('hscode.outbox.u1', JSON.stringify([{ fid: 'a', savedAt: T, submittedAt: T, state: 'saved' }]))
    expect(reconcile('u1', [item('a', T - 10 * MIN)], false)).toMatchObject([{ fid: 'a', state: 'failed', error: 'rejected' }])
  })

  it('a doc still pending locally changes nothing', () => {
    submittedAt('a', T)
    expect(reconcile('u1', [item('a', T - 10 * MIN, true)], true)).toMatchObject([{ fid: 'a', state: 'saved' }])
  })

  it('a server snapshot without the fid marks it failed; a cache snapshot does not', () => {
    submittedAt('z', T)
    expect(reconcile('u1', [], true)).toMatchObject([{ fid: 'z', state: 'saved' }])
    expect(reconcile('u1', [], false)).toMatchObject([{ fid: 'z', state: 'failed', error: 'generic' }])
  })

  it('a failed entry whose newer doc arrives is removed', () => {
    submittedAt('a', T)
    outbox.markFailed('u1', 'a', 'generic')
    expect(reconcile('u1', [item('a', T + 1000)], false)).toEqual([])
  })

  it('a failed entry keeps its original error when the doc is older', () => {
    submittedAt('a', T)
    outbox.markFailed('u1', 'a', 'accessOff')
    expect(reconcile('u1', [item('a', T - 10 * MIN)], false)).toMatchObject([{ fid: 'a', state: 'failed', error: 'accessOff' }])
  })

  it('clears drafts of approved factories even without an outbox entry', () => {
    saveDraft('u1', { ...emptyDraft('ok'), mode: 'edit' })
    saveDraft('u1', { ...emptyDraft('p'), mode: 'edit' })
    reconcile('u1', [item('ok', T, false, 'approved'), item('p', T, false, 'pending')], false)
    expect(loadDraft('u1', 'ok')).toBeNull()
    expect(loadDraft('u1', 'p')).not.toBeNull()
  })

  it('only touches the given user', () => {
    vi.setSystemTime(T)
    outbox.add('u2', 'a')
    reconcile('u1', [], false)
    expect(outbox.list('u2')).toMatchObject([{ fid: 'a', state: 'saved' }])
  })
})
