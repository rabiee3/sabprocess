import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
type W = { f: string; v: string }
const failFor = vi.fn((w: W[]) => w.length < 0)
let entries: unknown[] = []
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  where: (f: string, _op: string, v: string) => ({ f, v }),
  query: (_c: unknown, ...w: W[]) => w,
  getDoc: async () => ({ exists: () => true, data: () => ({ entries }) }),
  getCountFromServer: async (w: W[]) => {
    if (failFor(w)) throw new Error('x')
    const n = w.reduce((s, c) => s + c.v.length, 0)
    return { data: () => ({ count: n }) }
  },
}))

import { loadStats } from './stats'

describe('loadStats', () => {
  it('maps counts by status and area and reads the index fill', async () => {
    entries = [{ id: 'a' }]
    failFor.mockReturnValue(false)
    const s = await loadStats({} as never)
    expect(s.byStatus).toEqual({ pending: 7, approved: 8, rejected: 8, hidden: 6 })
    const other = s.byArea.find((a) => a.area === 'other')!
    expect(other).toEqual({ area: 'other', approved: 5 + 8, pending: 5 + 7 })
    expect(s.indexFill).toBeGreaterThan(0)
    expect(s.indexFill).toBeLessThan(0.01)
  })

  it('turns a failed count into null without failing the rest', async () => {
    failFor.mockImplementation((w) => w.length === 1 && w[0].v === 'hidden')
    const s = await loadStats({} as never)
    expect(s.byStatus.hidden).toBeNull()
    expect(s.byStatus.pending).toBe(7)
  })
})
