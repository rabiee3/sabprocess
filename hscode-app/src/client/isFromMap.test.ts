import { describe, expect, it } from 'vitest'
import { isFromMap } from './isFromMap'

describe('isFromMap', () => {
  it('accepts the root and /map forms', () => {
    for (const ok of ['/', '/?q=a', '/#x', '/map', '/map?q=a']) expect(isFromMap(ok)).toBe(true)
  })
  it('rejects everything else', () => {
    for (const no of ['/f/x', '/mapx', '', undefined, 5]) expect(isFromMap(no)).toBe(false)
  })
})
