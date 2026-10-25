import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { outbox } from './outbox'

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('outbox', () => {
  it('add lists one saved entry with savedAt and submittedAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)
    outbox.add('u1', 'f1')
    const list = outbox.list('u1')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ fid: 'f1', state: 'saved', savedAt: 5000, submittedAt: 5000 })
  })

  it('markFailed sets state and error', () => {
    outbox.add('u1', 'f1')
    outbox.markFailed('u1', 'f1', 'accessOff')
    expect(outbox.list('u1')[0]).toMatchObject({ fid: 'f1', state: 'failed', error: 'accessOff' })
  })

  it('remove deletes the entry', () => {
    outbox.add('u1', 'f1')
    outbox.add('u1', 'f2')
    outbox.remove('u1', 'f1')
    expect(outbox.list('u1').map((e) => e.fid)).toEqual(['f2'])
  })

  it('adding the same fid twice keeps one entry', () => {
    outbox.add('u1', 'f1')
    outbox.markFailed('u1', 'f1', 'offline')
    outbox.add('u1', 'f1')
    expect(outbox.list('u1')).toHaveLength(1)
    expect(outbox.list('u1')[0].state).toBe('saved')
  })

  it('garbage in storage gives an empty list', () => {
    localStorage.setItem('hscode.outbox.u1', '{not json')
    expect(outbox.list('u1')).toEqual([])
    localStorage.setItem('hscode.outbox.u1', '{"a":1}')
    expect(outbox.list('u1')).toEqual([])
  })

  it('an old entry without submittedAt falls back to savedAt', () => {
    localStorage.setItem('hscode.outbox.u1', JSON.stringify([{ fid: 'f1', savedAt: 42, state: 'saved' }]))
    expect(outbox.list('u1')[0]).toMatchObject({ fid: 'f1', submittedAt: 42 })
  })

  it('survives a module re-import', async () => {
    outbox.add('u1', 'f9')
    vi.resetModules()
    const fresh = (await import('./outbox')).outbox
    expect(fresh.list('u1').map((e) => e.fid)).toEqual(['f9'])
  })

  it('is scoped per user: B never sees A entries', () => {
    outbox.add('userA', 'fa')
    expect(outbox.list('userB')).toEqual([])
    outbox.add('userB', 'fb')
    outbox.remove('userB', 'fa')
    expect(outbox.list('userA').map((e) => e.fid)).toEqual(['fa'])
    expect(outbox.list('userB').map((e) => e.fid)).toEqual(['fb'])
    expect(localStorage.getItem('hscode.outbox.userA')).toContain('fa')
  })

  it('ignores and removes the old unscoped key', () => {
    localStorage.setItem('hscode.outbox', JSON.stringify([{ fid: 'legacy', savedAt: 1, state: 'saved' }]))
    expect(outbox.list('u1')).toEqual([])
    expect(localStorage.getItem('hscode.outbox')).toBeNull()
  })

  it('add and markFailed report whether storage accepted the write', () => {
    expect(outbox.add('u1', 'f1')).toBe(true)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(outbox.add('u1', 'f2')).toBe(false)
    vi.restoreAllMocks()
  })
})
