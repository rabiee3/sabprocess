import { describe, expect, it } from 'vitest'
import { areaLabel } from './labels'

describe('areaLabel', () => {
  it('names a known area in each language', () => {
    expect(areaLabel('oct6-zone-1', 'en')).toBeTruthy()
    expect(areaLabel('oct6-zone-1', 'ar')).not.toBe(areaLabel('oct6-zone-1', 'en'))
  })
  it('shows the typed name for "other"', () => {
    expect(areaLabel('other', 'en', 'Abu Rawash')).toBe('Abu Rawash')
    expect(areaLabel('other', 'ar', 'أبو رواش')).toBe('أبو رواش')
  })
  it('falls back to the "Other" label when the typed name is blank', () => {
    const plain = areaLabel('other', 'en')
    expect(plain).toBeTruthy()
    expect(areaLabel('other', 'en', '  ')).toBe(plain)
  })
  it('ignores areaOther for any other area', () => {
    expect(areaLabel('oct6-zone-1', 'en', 'stale')).toBe(areaLabel('oct6-zone-1', 'en'))
  })
})
