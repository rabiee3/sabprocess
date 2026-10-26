import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('../firebase/converters', () => ({ factoryConverter: {} }))

const getDocs = vi.fn()
const startAfter = vi.fn((s: unknown) => ({ startAfter: s }))
const query = vi.fn((...a: unknown[]) => ({ q: a }))
const runTransaction = vi.fn(async (_fs: unknown, fn: (tx: unknown) => Promise<void>) => fn({}))
vi.mock('firebase/firestore', () => ({
  collection: () => ({ withConverter: () => ({}) }),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  query: (...a: unknown[]) => query(...a),
  startAfter: (s: unknown) => startAfter(s),
  getDocs: (...a: unknown[]) => getDocs(...a),
  runTransaction: (...a: Parameters<typeof runTransaction>) => runTransaction(...a),
}))

const readShard = vi.fn()
const writeShard = vi.fn()
vi.mock('./repo', () => ({
  AdminError: class extends Error {},
  readShard: (...a: unknown[]) => readShard(...a),
  writeShard: (...a: unknown[]) => writeShard(...a),
}))

import { rebuildSearchIndex } from './rebuildIndex'

const snap = (i: number) => ({
  id: `f${i}`,
  data: () => ({
    id: `f${i}`,
    name: { en: `F${i}` },
    area: 'sadat',
    location: { lat: 30, lng: 31, accuracyM: null, pinMoved: false },
    productsMade: [],
    productsNeeded: [],
  }),
})
const page = (from: number, n: number) => {
  const docs = Array.from({ length: n }, (_, i) => snap(from + i))
  return { docs, size: n }
}

beforeEach(() => {
  for (const m of [getDocs, startAfter, query, runTransaction, readShard, writeShard]) m.mockClear()
  getDocs.mockReset()
  readShard.mockResolvedValue({ exists: true, entries: [] })
})

describe('rebuildSearchIndex paging', () => {
  it('pages past 500 using startAfter of the last snapshot', async () => {
    const first = page(0, 500)
    getDocs.mockResolvedValueOnce(first).mockResolvedValueOnce(page(500, 3))
    const r = await rebuildSearchIndex({} as never)
    expect(r).toEqual({ count: 503 })
    expect(getDocs).toHaveBeenCalledTimes(2)
    expect(startAfter).toHaveBeenCalledTimes(1)
    expect(startAfter).toHaveBeenCalledWith(first.docs[499])
    expect(writeShard.mock.calls[0][3]).toHaveLength(503)
  })

  it('stops after an exact 500 followed by an empty page', async () => {
    getDocs.mockResolvedValueOnce(page(0, 500)).mockResolvedValueOnce(page(500, 0))
    expect(await rebuildSearchIndex({} as never)).toEqual({ count: 500 })
    expect(getDocs).toHaveBeenCalledTimes(2)
  })

  it('still writes an empty shard when nothing is approved', async () => {
    getDocs.mockResolvedValueOnce(page(0, 0))
    expect(await rebuildSearchIndex({} as never)).toEqual({ count: 0 })
    expect(getDocs).toHaveBeenCalledTimes(1)
    expect(writeShard).toHaveBeenCalledTimes(1)
    expect(writeShard.mock.calls[0][3]).toEqual([])
  })
})
