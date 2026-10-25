import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FactoryInput } from '../survey/types'

vi.mock('../firebase', () => ({ db: {} }))
const getDocs = vi.fn()
const where = vi.fn((...a: unknown[]) => ({ where: a }))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: (...a: unknown[]) => ({ q: a }),
  where: (...a: unknown[]) => where(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
}))
const adminCreateFactory = vi.fn()
const deleteFactory = vi.fn()
vi.mock('./repo', () => ({
  adminCreateFactory: (...a: unknown[]) => adminCreateFactory(...a),
  deleteFactory: (...a: unknown[]) => deleteFactory(...a),
}))

import { loadDemoFactories, removeDemoFactories } from './demo'

const mk = (en: string): FactoryInput => ({
  name: { en, ar: en },
  area: 'oct6-zone-1',
  location: { lat: 29.9, lng: 30.9, accuracyM: null, pinMoved: true },
  productsMade: [],
  productsNeeded: [],
  contact: {},
  photos: [],
})
const snap = (docs: { id: string; en?: string }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => ({ name: d.en ? { en: d.en } : {} }) })),
})

beforeEach(() => {
  getDocs.mockReset()
  where.mockClear()
  adminCreateFactory.mockReset().mockResolvedValue('new')
  deleteFactory.mockReset().mockResolvedValue(undefined)
})

describe('loadDemoFactories', () => {
  it('queries sample factories, skips existing names and creates the rest as samples', async () => {
    getDocs.mockResolvedValue(snap([{ id: 'x1', en: 'A' }]))
    const progress = vi.fn()
    const r = await loadDemoFactories([mk('A'), mk('B'), mk('C')], progress)
    expect(where).toHaveBeenCalledWith('sample', '==', true)
    expect(r).toEqual({ added: 2, skipped: 1 })
    expect(adminCreateFactory).toHaveBeenCalledTimes(2)
    expect(adminCreateFactory.mock.calls[0]![1]).toEqual({ sample: true })
    expect(adminCreateFactory.mock.calls.map((c) => (c[0] as FactoryInput).name.en)).toEqual(['B', 'C'])
    expect(progress).toHaveBeenLastCalledWith(3, 3)
  })
  it('is idempotent: a second run adds nothing', async () => {
    getDocs.mockResolvedValue(snap([{ id: '1', en: 'A' }, { id: '2', en: 'B' }]))
    expect(await loadDemoFactories([mk('A'), mk('B')])).toEqual({ added: 0, skipped: 2 })
    expect(adminCreateFactory).not.toHaveBeenCalled()
  })
  it('propagates a create error and stops', async () => {
    getDocs.mockResolvedValue(snap([]))
    adminCreateFactory.mockResolvedValueOnce('a').mockRejectedValueOnce(new Error('boom'))
    await expect(loadDemoFactories([mk('A'), mk('B'), mk('C')])).rejects.toThrow('boom')
    expect(adminCreateFactory).toHaveBeenCalledTimes(2)
  })
})

describe('removeDemoFactories', () => {
  it('deletes every sample factory', async () => {
    getDocs.mockResolvedValue(snap([{ id: 'a' }, { id: 'b' }]))
    const progress = vi.fn()
    expect(await removeDemoFactories(progress)).toEqual({ removed: 2 })
    expect(where).toHaveBeenCalledWith('sample', '==', true)
    expect(deleteFactory.mock.calls.map((c) => c[0])).toEqual(['a', 'b'])
    expect(progress).toHaveBeenLastCalledWith(2, 2)
  })
  it('returns zero when there are none', async () => {
    getDocs.mockResolvedValue(snap([]))
    expect(await removeDemoFactories()).toEqual({ removed: 0 })
    expect(deleteFactory).not.toHaveBeenCalled()
  })
})
