import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
const getDoc = vi.fn()
const getDocs = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: (_fs: unknown, path: string) => ({ path, withConverter: () => ({ path }) }),
  collection: (_fs: unknown, path: string) => ({ path }),
  getDoc: (...a: unknown[]) => getDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  Timestamp: class {},
}))

import { loadContact, loadPhotos, loadPublicFactory } from './publicRepo'

const IMG = 'data:image/png;base64,AAAA'
beforeEach(() => {
  getDoc.mockReset()
  getDocs.mockReset()
})

describe('publicRepo', () => {
  it('loads a factory', async () => {
    getDoc.mockResolvedValue({ data: () => ({ id: 'f1' }) })
    expect(await loadPublicFactory('f1')).toEqual({ id: 'f1' })
  })
  it('missing doc and permission-denied give null; other errors throw', async () => {
    getDoc.mockResolvedValueOnce({ data: () => undefined })
    expect(await loadPublicFactory('x')).toBeNull()
    getDoc.mockRejectedValueOnce({ code: 'permission-denied' })
    expect(await loadPublicFactory('x')).toBeNull()
    getDoc.mockRejectedValueOnce({ code: 'unavailable' })
    await expect(loadPublicFactory('x')).rejects.toMatchObject({ code: 'unavailable' })
  })
  it('orders photos and drops unsafe ones', async () => {
    const d = (id: string, data: string, order: number) => ({ id, data: () => ({ data, order }) })
    getDocs.mockResolvedValue({ docs: [d('p2', IMG, 1), d('p3', 'https://evil/x.png', 2), d('p1', IMG, 0)] })
    expect((await loadPhotos('f1')).map((p) => p.id)).toEqual(['p1', 'p2'])
  })
  it('contact: data, empty object when absent, null on permission-denied', async () => {
    getDoc.mockResolvedValueOnce({ data: () => ({ phone: '1' }) })
    expect(await loadContact('f1')).toEqual({ phone: '1' })
    getDoc.mockResolvedValueOnce({ data: () => undefined })
    expect(await loadContact('f1')).toEqual({})
    getDoc.mockRejectedValueOnce({ code: 'permission-denied' })
    expect(await loadContact('f1')).toBeNull()
  })
})
