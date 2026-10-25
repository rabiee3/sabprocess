import { beforeEach, describe, expect, it, vi } from 'vitest'
import { outbox } from './outbox'

beforeEach(() => localStorage.clear())

describe('outbox', () => {
  it('add lists one saved entry', () => {
    outbox.add('f1')
    const list = outbox.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ fid: 'f1', state: 'saved' })
    expect(typeof list[0].savedAt).toBe('number')
  })

  it('markFailed sets state and error', () => {
    outbox.add('f1')
    outbox.markFailed('f1', 'accessOff')
    expect(outbox.list()[0]).toMatchObject({ fid: 'f1', state: 'failed', error: 'accessOff' })
  })

  it('remove deletes the entry', () => {
    outbox.add('f1')
    outbox.add('f2')
    outbox.remove('f1')
    expect(outbox.list().map((e) => e.fid)).toEqual(['f2'])
  })

  it('adding the same fid twice keeps one entry', () => {
    outbox.add('f1')
    outbox.markFailed('f1', 'offline')
    outbox.add('f1')
    expect(outbox.list()).toHaveLength(1)
    expect(outbox.list()[0].state).toBe('saved')
  })

  it('garbage in storage gives an empty list', () => {
    localStorage.setItem('hscode.outbox', '{not json')
    expect(outbox.list()).toEqual([])
    localStorage.setItem('hscode.outbox', '{"a":1}')
    expect(outbox.list()).toEqual([])
  })

  it('survives a module re-import', async () => {
    outbox.add('f9')
    vi.resetModules()
    const fresh = (await import('./outbox')).outbox
    expect(fresh.list().map((e) => e.fid)).toEqual(['f9'])
  })
})
