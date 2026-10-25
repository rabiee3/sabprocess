import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
  loadFactoryForEdit,
  newFactoryId,
  resubmitFactory,
  submitFactory,
  subscribeMySubmissions,
  toSurveyError,
  type SubmissionItem,
} from '../../src/survey/repo'
import type { FactoryInput } from '../../src/survey/types'
import { asUser, seed } from './helpers'
import { seedFactory, seedUsersAndInvites, validContact, validFactory, validPhoto } from './fixtures'

const input = (over: Partial<FactoryInput> = {}): FactoryInput => ({
  name: { en: 'Nile Plastics' },
  area: 'oct6-zone-3',
  location: { lat: 29.97, lng: 30.94, accuracyM: 12, pinMoved: false },
  productsMade: [{ name: { en: 'Bottles' }, hs: { heading: '3923' } }],
  productsNeeded: [],
  contact: {},
  photos: [],
  ...over,
})

const photos = (n: number) =>
  (['p1', 'p2', 'p3'] as const).slice(0, n).map((id) => ({ id, data: 'data:image/webp;base64,AAAA' }))

beforeEach(seedUsersAndInvites)

describe('submitFactory', () => {
  it('writes factory, contact and photos in one batch', async () => {
    const fs = asUser('s1')
    const fid = newFactoryId(fs)
    await submitFactory(
      's1',
      fid,
      input({ photos: photos(2), thumb: 'data:t', contact: { phone: '0100', whatsappSameAsPhone: true, website: '  ' } }),
      fs,
    )
    const f = (await getDoc(doc(fs, `factories/${fid}`))).data()!
    expect(f).toMatchObject({ status: 'pending', photoCount: 2, createdBy: 's1', thumb: 'data:t' })
    expect('rejectReason' in f).toBe(false)
    expect('areaOther' in f).toBe(false)
    expect((await getDoc(doc(fs, `factories/${fid}/private/contact`))).data()).toEqual({
      phone: '0100',
      whatsappSameAsPhone: true,
    })
    expect((await getDoc(doc(fs, `factories/${fid}/photos/p2`))).data()).toMatchObject({ order: 1 })
  })

  it('writes no contact doc for an empty contact', async () => {
    const fs = asUser('s1')
    const fid = newFactoryId(fs)
    await submitFactory('s1', fid, input({ contact: { phone: ' ' } }), fs)
    expect((await getDoc(doc(fs, `factories/${fid}/private/contact`))).exists()).toBe(false)
  })

  it('is denied for an inactive surveyor and maps to accessOff', async () => {
    const fs = asUser('off')
    const err = await submitFactory('off', newFactoryId(fs), input(), fs).then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).not.toBeNull()
    expect(toSurveyError(err)).toBe('accessOff')
  })
})

describe('resubmitFactory', () => {
  it('returns a rejected factory to pending, keeps rejectReason, swaps photos', async () => {
    await seedFactory(
      'r1',
      validFactory('s1', { status: 'rejected', rejectReason: 'blurry', photoCount: 1, thumb: 'old', address: 'old' }),
    )
    await seed(async (db) => {
      await setDoc(doc(db, 'factories/r1/photos/p1'), validPhoto(0))
    })
    const fs = asUser('s1')
    await resubmitFactory('s1', 'r1', input({ name: { en: 'New name' }, photos: [{ id: 'p2', data: 'data:x' }] }), ['p1'], fs)
    const f = (await getDoc(doc(fs, 'factories/r1'))).data()!
    expect(f).toMatchObject({ status: 'pending', rejectReason: 'blurry', name: { en: 'New name' }, photoCount: 1, createdBy: 's1' })
    expect('thumb' in f).toBe(false)
    expect('address' in f).toBe(false)
    expect((await getDoc(doc(fs, 'factories/r1/photos/p1'))).exists()).toBe(false)
    expect((await getDoc(doc(fs, 'factories/r1/photos/p2'))).exists()).toBe(true)
  })

  it('is denied on an approved factory', async () => {
    await seedFactory('r1', validFactory('s1', { status: 'approved' }))
    await expect(resubmitFactory('s1', 'r1', input(), [], asUser('s1'))).rejects.toBeTruthy()
  })
})

describe('loadFactoryForEdit', () => {
  it('returns null for another surveyor pending factory and data for own', async () => {
    await seedFactory('a', validFactory('s2'))
    await seedFactory('b', validFactory('s1', { photoCount: 1 }))
    await seed(async (db) => {
      await setDoc(doc(db, 'factories/b/photos/p1'), validPhoto(0))
      await setDoc(doc(db, 'factories/b/private/contact'), validContact())
    })
    const fs = asUser('s1')
    expect(await loadFactoryForEdit('a', fs)).toBeNull()
    expect(await loadFactoryForEdit('missing', fs)).toBeNull()
    const r = await loadFactoryForEdit('b', fs)
    expect(r?.factory.id).toBe('b')
    expect(r?.contact.phone).toBe('+20 100 000 0000')
    expect(r?.photos.map((p) => p.id)).toEqual(['p1'])
  })
})

describe('subscribeMySubmissions', () => {
  it('yields only own visible items, newest first, with fromCache meta', async () => {
    const t = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms)
    await seedFactory('old', validFactory('s1', { updatedAt: t(1000) }))
    await seedFactory('new', validFactory('s1', { status: 'rejected', rejectReason: 'x', updatedAt: t(5000) }))
    await seedFactory('hid', validFactory('s1', { status: 'hidden', updatedAt: t(9000) }))
    await seedFactory('oth', validFactory('s2', { updatedAt: t(7000) }))
    const fs = asUser('s1')
    const items = await new Promise<SubmissionItem[]>((resolve, reject) => {
      const un = subscribeMySubmissions(
        's1',
        (list, meta) => {
          expect(typeof meta.fromCache).toBe('boolean')
          un()
          resolve(list)
        },
        (c) => reject(new Error(c)),
        fs,
      )
    })
    expect(items.map((i) => i.factory.id)).toEqual(['new', 'old'])
    expect(items[0].pendingWrite).toBe(false)
  })
})
