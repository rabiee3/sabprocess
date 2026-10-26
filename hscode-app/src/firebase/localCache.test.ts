import { afterEach, describe, expect, it, vi } from 'vitest'
import { chooseLocalCache, storageWritable } from './localCache'

describe('chooseLocalCache', () => {
  it('persistent (multi-tab) only when IndexedDB exists and localStorage is writable', () => {
    expect(chooseLocalCache({ hasIndexedDb: true, storageWritable: true })).toBe('persistent')
  })
  it('memory when localStorage throws (Safari with site data blocked, enterprise policy)', () => {
    expect(chooseLocalCache({ hasIndexedDb: true, storageWritable: false })).toBe('memory')
  })
  it('memory without IndexedDB (jsdom, Node)', () => {
    expect(chooseLocalCache({ hasIndexedDb: false, storageWritable: true })).toBe('memory')
    expect(chooseLocalCache({ hasIndexedDb: false, storageWritable: false })).toBe('memory')
  })
})

describe('storageWritable', () => {
  afterEach(() => vi.restoreAllMocks())

  it('is true when a probe key can be written, and leaves nothing behind', () => {
    const before = localStorage.length
    expect(storageWritable()).toBe(true)
    expect(localStorage.length).toBe(before)
  })
  it('is false when setItem throws SecurityError', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(storageWritable()).toBe(false)
  })
  it('is false when reading localStorage itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(storageWritable()).toBe(false)
  })
})
