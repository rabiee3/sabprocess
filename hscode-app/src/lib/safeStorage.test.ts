import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeStorage } from './safeStorage'

describe('safeStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('reads and writes through localStorage', () => {
    safeStorage.set('k', 'v')
    expect(safeStorage.get('k')).toBe('v')
    expect(safeStorage.get('missing')).toBeNull()
  })

  it('returns null and does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(safeStorage.get('x')).toBeNull()
    expect(() => safeStorage.set('x', '1')).not.toThrow()
  })
})
