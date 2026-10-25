import { doc, getDoc, setDoc, serverTimestamp, type Timestamp } from 'firebase/firestore'
import {
  AdminError,
  adminCreateFactory,
  approveFactory,
  deleteFactory,
  hideFactory,
  loadForReview,
  rejectFactory,
  saveEdits,
  unhideFactory,
} from '../../src/admin/repo'
import { INDEX_LIMIT, indexFill } from '../../src/admin/searchIndex'
import { resubmitFactory } from '../../src/survey/repo'
import type { IndexEntry } from '../../src/lib/types'
import type { FactoryInput } from '../../src/survey/types'
import { ADMIN_UID, asAdmin, seed } from './helpers'
import { seedFactory, seedUsersAndInvites, validContact, validFactory, validPhoto } from './fixtures'
import { asUser } from './helpers'

const FID = 'p1fac'

async function seedPending(over: Record<string, unknown> = {}) {
  await seedFactory(FID, validFactory('s1', { photoCount: 2, productsMade: [{ name: { en: 'Bottles' }, hs: { heading: '3923' } }], ...over }))
  await seed(async (db) => {
    await setDoc(doc(db, `factories/${FID}/photos/p1`), validPhoto(0))
    await setDoc(doc(db, `factories/${FID}/photos/p2`), validPhoto(1))
    await setDoc(doc(db, `factories/${FID}/private/contact`), validContact())
  })
}

const shard = async (fs = asAdmin()) => (await getDoc(doc(fs, 'searchIndex/shard-0'))).data() as
  | { version: number; entries: IndexEntry[] }
  | undefined
const factory = async (fid = FID) => (await getDoc(doc(asAdmin(), `factories/${fid}`))).data()
const opened = async (): Promise<Timestamp> => (await loadForReview(FID, asAdmin()))!.openedAt

const input: FactoryInput = {
  name: { en: 'Admin Made' },
  area: 'oct6-zone-3',
  location: { lat: 29.97, lng: 30.94, accuracyM: null, pinMoved: true },
  productsMade: [],
  productsNeeded: [],
  contact: { phone: '0100' },
  photos: [{ id: 'p1', data: 'data:image/webp;base64,AAAA' }],
}

const code = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => (e instanceof AdminError ? e.code : e),
  )

beforeEach(seedUsersAndInvites)

describe('loadForReview', () => {
  it('returns factory, raw openedAt, contact and photos; null when missing', async () => {
    await seedPending()
    const r = await loadForReview(FID, asAdmin())
    expect(r!.factory.id).toBe(FID)
    expect(r!.openedAt.isEqual).toBeTypeOf('function')
    expect(r!.photos.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(r!.contact.phone).toBe('+20 100 000 0000')
    expect(await loadForReview('nope', asAdmin())).toBeNull()
  })
})

describe('approveFactory', () => {
  it('approves, counts photos, indexes, drops rejectReason', async () => {
    await seedPending({ status: 'rejected', rejectReason: 'bad' })
    const fs = asAdmin()
    await approveFactory(FID, await opened(), {}, fs)
    const f = (await factory())!
    expect(f).toMatchObject({ status: 'approved', photoCount: 2 })
    expect('rejectReason' in f).toBe(false)
    expect(f.approvedAt).toBeDefined()
    const s = (await shard())!
    expect(s.version).toBe(1)
    expect(s.entries.map((e) => e.id)).toEqual([FID])
    expect(s.entries[0].at).toBeTypeOf('number')
  })

  it('applies an edit to the doc and the entry; bumps version', async () => {
    await seedPending()
    await approveFactory(FID, await opened(), { name: { en: 'Renamed' }, sector: 'plastics' }, asAdmin())
    expect((await shard())!.entries[0]).toMatchObject({ n: { en: 'Renamed' }, s: 'plastics' })
    expect(await factory()).toMatchObject({ name: { en: 'Renamed' }, sector: 'plastics' })
    await seedFactory('other', validFactory('s1'))
    await approveFactory('other', (await loadForReview('other', asAdmin()))!.openedAt, {}, asAdmin())
    const s = (await shard())!
    expect(s.version).toBe(2)
    expect(s.entries).toHaveLength(2)
  })

  it('refuses a stale openedAt after the surveyor resubmits', async () => {
    await seedPending()
    const old = await opened()
    await resubmitFactory('s1', FID, { ...input, name: { en: 'Edited by s1' }, contact: {}, photos: [] }, ['p1', 'p2'], asUser('s1'))
    expect(await code(approveFactory(FID, old, {}, asAdmin()))).toBe('stale')
    expect((await factory())!.status).toBe('pending')
    expect(await shard()).toBeUndefined()
  })

  const fillerShard = async (targetBytes: number) => {
    const big = Array.from({ length: 10 }, (_, i) => ({
      id: `big${i}`, n: { en: 'x'.repeat(100_000) }, lat: 30, lng: 31, a: 'a', m: [], d: [],
    }))
    const base = JSON.stringify(big).length
    big[9].n.en += 'x'.repeat(Math.max(0, targetBytes - base))
    await seed(async (db) => {
      await setDoc(doc(db, 'searchIndex/shard-0'), { version: 5, updatedAt: serverTimestamp(), entries: big })
    })
    return big
  }
  const limitBytes = Math.floor(INDEX_LIMIT * 1_048_576)

  it('throws indexFull and writes nothing when only the new entry crosses the limit', async () => {
    await seedPending()
    const big = await fillerShard(limitBytes - 50)
    expect(indexFill(big)).toBeLessThanOrEqual(INDEX_LIMIT)
    expect(await code(approveFactory(FID, await opened(), {}, asAdmin()))).toBe('indexFull')
    expect((await factory())!.status).toBe('pending')
    expect((await shard())!.version).toBe(5)
  })

  it('still approves when the new entry stays under the limit', async () => {
    await seedPending()
    await fillerShard(limitBytes - 3000)
    await approveFactory(FID, await opened(), {}, asAdmin())
    expect((await factory())!.status).toBe('approved')
    expect((await shard())!.entries.map((e) => e.id)).toContain(FID)
  })
})

describe('rejectFactory', () => {
  it('rejects with a trimmed reason', async () => {
    await seedPending()
    await rejectFactory(FID, await opened(), '  blurry photos ', asAdmin())
    expect(await factory()).toMatchObject({ status: 'rejected', rejectReason: 'blurry photos' })
    expect(await shard()).toBeUndefined()
  })
  it('rejects an empty or too-long reason as invalid', async () => {
    await seedPending()
    expect(await code(rejectFactory(FID, await opened(), '   ', asAdmin()))).toBe('invalid')
    expect(await code(rejectFactory(FID, await opened(), 'x'.repeat(501), asAdmin()))).toBe('invalid')
    expect((await factory())!.status).toBe('pending')
  })
  it('refuses a stale openedAt', async () => {
    await seedPending()
    const old = await opened()
    await saveEdits(FID, old, { address: 'one' }, asAdmin())
    expect(await code(rejectFactory(FID, old, 'late', asAdmin()))).toBe('stale')
    expect((await factory())!.status).toBe('pending')
  })
  it('removes the entry of a previously approved factory', async () => {
    await seedPending()
    await approveFactory(FID, await opened(), {}, asAdmin())
    await rejectFactory(FID, await opened(), 'recheck', asAdmin())
    expect((await shard())!.entries).toEqual([])
  })
})

describe('saveEdits / hide / unhide', () => {
  it('hide still works with the shard above the limit', async () => {
    await seedPending()
    await approveFactory(FID, await opened(), {}, asAdmin())
    const entries = (await shard())!.entries
    entries.push({ id: 'huge', n: { en: 'x'.repeat(1_020_000 - JSON.stringify(entries).length) }, lat: 30, lng: 31, a: 'a', m: [], d: [] })
    await seed(async (db) => {
      await setDoc(doc(db, 'searchIndex/shard-0'), { version: 9, updatedAt: serverTimestamp(), entries })
    })
    expect(indexFill(entries)).toBeGreaterThan(INDEX_LIMIT)
    await hideFactory(FID, asAdmin())
    expect((await shard())!.entries.map((e) => e.id)).toEqual(['huge'])
  })
  it('hide needs approved and unhide needs hidden', async () => {
    await seedPending()
    expect(await code(hideFactory(FID, asAdmin()))).toBe('invalid')
    expect(await code(unhideFactory(FID, asAdmin()))).toBe('invalid')
    expect((await factory())!.status).toBe('pending')
    expect(await code(hideFactory('missing', asAdmin()))).toBe('invalid')
  })
  it('saveEdits upserts the entry for approved, leaves the index alone for pending', async () => {
    await seedPending()
    await saveEdits(FID, await opened(), { address: 'New St' }, asAdmin())
    expect(await shard()).toBeUndefined()
    expect(await factory()).toMatchObject({ address: 'New St', status: 'pending' })
    await approveFactory(FID, await opened(), {}, asAdmin())
    await saveEdits(FID, await opened(), { name: { ar: 'مصنع' }, address: '' }, asAdmin())
    expect((await shard())!.entries[0].n).toEqual({ ar: 'مصنع' })
    expect('address' in (await factory())!).toBe(false)
  })
  it('saveEdits refuses a stale openedAt', async () => {
    await seedPending()
    const old = await opened()
    await saveEdits(FID, old, { address: 'one' }, asAdmin())
    expect(await code(saveEdits(FID, old, { address: 'two' }, asAdmin()))).toBe('stale')
  })
  it('hide removes from the index, unhide restores it', async () => {
    await seedPending()
    await approveFactory(FID, await opened(), {}, asAdmin())
    await hideFactory(FID, asAdmin())
    expect((await factory())!.status).toBe('hidden')
    expect((await shard())!.entries).toEqual([])
    await unhideFactory(FID, asAdmin())
    expect((await factory())!.status).toBe('approved')
    expect((await shard())!.entries.map((e) => e.id)).toEqual([FID])
  })
})

describe('deleteFactory', () => {
  it('leaves the shard untouched for a non-indexed factory', async () => {
    await seedPending()
    await seedFactory('other', validFactory('s1'))
    await approveFactory('other', (await loadForReview('other', asAdmin()))!.openedAt, {}, asAdmin())
    await deleteFactory(FID, asAdmin())
    expect((await factory())).toBeUndefined()
    const s = (await shard())!
    expect(s.version).toBe(1)
    expect(s.entries.map((e) => e.id)).toEqual(['other'])
  })
  it('removes factory, children and index entry', async () => {
    await seedPending()
    await approveFactory(FID, await opened(), {}, asAdmin())
    await deleteFactory(FID, asAdmin())
    const fs = asAdmin()
    expect((await getDoc(doc(fs, `factories/${FID}`))).exists()).toBe(false)
    expect((await getDoc(doc(fs, `factories/${FID}/photos/p1`))).exists()).toBe(false)
    expect((await getDoc(doc(fs, `factories/${FID}/private/contact`))).exists()).toBe(false)
    expect((await shard())!.entries).toEqual([])
  })
})

describe('adminCreateFactory', () => {
  it('creates an approved, indexed sample factory with children', async () => {
    const fs = asAdmin()
    const fid = await adminCreateFactory(input, { sample: true }, fs)
    const f = (await getDoc(doc(fs, `factories/${fid}`))).data()!
    expect(f).toMatchObject({ status: 'approved', sample: true, photoCount: 1, createdBy: ADMIN_UID })
    expect(f.approvedAt).toBeDefined()
    expect((await getDoc(doc(fs, `factories/${fid}/photos/p1`))).data()).toMatchObject({ order: 0 })
    expect((await getDoc(doc(fs, `factories/${fid}/private/contact`))).data()).toEqual({ phone: '0100' })
    expect((await shard())!.entries.map((e) => e.id)).toEqual([fid])
  })
  it('omits sample when false', async () => {
    const fid = await adminCreateFactory(input, { sample: false }, asAdmin())
    expect('sample' in (await factory(fid))!).toBe(false)
  })
})
