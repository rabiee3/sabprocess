import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {} }))
const getDoc = vi.fn()
const getDocs = vi.fn()
const getDocFromServer = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc: (_fs: unknown, path: string) => ({ path, withConverter: () => ({ path }) }),
  collection: (_fs: unknown, path: string) => ({ path }),
  getDoc: (...a: unknown[]) => getDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDocFromServer: (...a: unknown[]) => getDocFromServer(...a),
  Timestamp: class {},
}))

import { loadContact, loadPhotos, loadPublicFactory } from './publicRepo'

const IMG = 'data:image/png;base64,AAAA'
beforeEach(() => {
  getDoc.mockReset()
  getDocs.mockReset()
  getDocFromServer.mockReset()
})

describe('publicRepo', () => {
  it('loads an approved factory as public', async () => {
    getDoc.mockResolvedValue({ data: () => ({ id: 'f1', status: 'approved' }) })
    expect(await loadPublicFactory('f1')).toEqual({ factory: { id: 'f1', status: 'approved' }, isPublic: true })
  })
  it('a pending factory read by its owner (or a hidden one read by the admin) is not public', async () => {
    getDoc.mockResolvedValueOnce({ data: () => ({ id: 'f1', status: 'pending' }) })
    expect(await loadPublicFactory('f1')).toEqual({ factory: { id: 'f1', status: 'pending' }, isPublic: false })
    getDoc.mockResolvedValueOnce({ data: () => ({ id: 'f1', status: 'hidden' }) })
    expect((await loadPublicFactory('f1'))?.isPublic).toBe(false)
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
    getDocFromServer.mockResolvedValueOnce({ data: () => ({ phone: '1' }) })
    expect(await loadContact('f1')).toEqual({ phone: '1' })
    getDocFromServer.mockResolvedValueOnce({ data: () => undefined })
    expect(await loadContact('f1')).toEqual({})
    getDocFromServer.mockRejectedValueOnce({ code: 'permission-denied' })
    expect(await loadContact('f1')).toBeNull()
  })
  it('contact is always read from the server, never from the local cache', async () => {
    getDocFromServer.mockResolvedValue({ data: () => ({ phone: '1' }) })
    await loadContact('f1')
    expect(getDocFromServer).toHaveBeenCalledTimes(1)
    expect(getDocFromServer.mock.calls[0][0]).toMatchObject({ path: 'factories/f1/private/contact' })
    expect(getDoc).not.toHaveBeenCalled()
  })
  it('contact offline (server unreachable) is an error, not a cached copy', async () => {
    getDocFromServer.mockRejectedValue({ code: 'unavailable' })
    await expect(loadContact('f1')).rejects.toMatchObject({ code: 'unavailable' })
    expect(getDoc).not.toHaveBeenCalled()
  })
})
