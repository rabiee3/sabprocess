import { describe, expect, it } from 'vitest'
import type { IndexEntry } from '../lib/types'
import { INDEX_LIMIT, indexFill, removeEntry, upsertEntry } from './searchIndex'

const e = (id: string, en = 'X'): IndexEntry => ({ id, n: { en }, lat: 30, lng: 31, a: 'a', m: [], d: [] })

describe('searchIndex', () => {
  it('upsert replaces by id, otherwise appends', () => {
    const list = [e('a'), e('b')]
    expect(upsertEntry(list, e('b', 'New')).map((x) => x.n.en)).toEqual(['X', 'New'])
    expect(upsertEntry(list, e('c')).map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(list).toHaveLength(2)
  })
  it('remove drops the id and ignores unknown ids', () => {
    expect(removeEntry([e('a'), e('b')], 'a').map((x) => x.id)).toEqual(['b'])
    expect(removeEntry([e('a')], 'zz')).toHaveLength(1)
  })
  it('fill of 1000 entries is between 0 and 1', () => {
    const list = Array.from({ length: 1000 }, (_, i) => e(`id${i}`, 'Factory name'))
    const f = indexFill(list)
    expect(f).toBeGreaterThan(0)
    expect(f).toBeLessThan(1)
    expect(f).toBeCloseTo(new TextEncoder().encode(JSON.stringify(list)).length / 1_048_576, 10)
  })
  it('counts UTF-8 bytes, not characters (Arabic is 2 bytes per char)', () => {
    const list = [e('a', 'مصنع الحديد والصلب')]
    const chars = JSON.stringify(list).length
    const bytes = new TextEncoder().encode(JSON.stringify(list)).length
    expect(bytes).toBeGreaterThan(chars)
    expect(indexFill(list)).toBe(bytes / 1_048_576)
  })
  it('limit is 0.97', () => expect(INDEX_LIMIT).toBe(0.97))
})
