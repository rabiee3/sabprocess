import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeStorage } from './safeStorage'

describe('safeStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('reads and writes through localStorage', () => {
    expect(safeStorage.set('k', 'v')).toBe(true)
    expect(safeStorage.get('k')).toBe('v')
    expect(safeStorage.get('missing')).toBeNull()
  })

  it('remove deletes a key', () => {
    safeStorage.set('k', 'v')
    safeStorage.remove('k')
    expect(safeStorage.get('k')).toBeNull()
  })

  it('keys lists the stored keys', () => {
    safeStorage.set('a', '1')
    safeStorage.set('b', '2')
    expect(safeStorage.keys().sort()).toEqual(['a', 'b'])
  })

  it('returns null/false/[] and does not throw when localStorage throws', () => {
    for (const m of ['getItem', 'setItem', 'removeItem', 'key'] as const) {
      vi.spyOn(Storage.prototype, m).mockImplementation(() => {
        throw new Error('denied')
      })
    }
    vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(safeStorage.get('x')).toBeNull()
    expect(safeStorage.set('x', '1')).toBe(false)
    expect(() => safeStorage.remove('x')).not.toThrow()
    expect(safeStorage.keys()).toEqual([])
  })
})
