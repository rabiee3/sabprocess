import { doc, getDoc, setDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, it } from 'vitest'
import { AdminError } from '../../src/admin/repo'
import { rebuildSearchIndex } from '../../src/admin/rebuildIndex'
import type { IndexEntry } from '../../src/lib/types'
import { asAdmin, asUser, seed } from './helpers'
import { seedFactory, seedUsersAndInvites, validFactory } from './fixtures'

const shard = async () =>
  (await getDoc(doc(asAdmin(), 'searchIndex/shard-0'))).data() as { version: number; entries: IndexEntry[] } | undefined

const stale: IndexEntry = { id: 'gone', n: { en: 'Stale' }, lat: 30, lng: 31, a: 'sadat', m: [], d: [] }

beforeEach(async () => {
  await seedUsersAndInvites()
  await seedFactory('a1', validFactory('s1', { status: 'approved', name: { en: 'Real' } }))
  await seedFactory('a2', validFactory('s1', { status: 'approved', sample: true, name: { en: 'Demo' } }))
  await seedFactory('h1', validFactory('s1', { status: 'hidden' }))
  await seedFactory('p1', validFactory('s1', { status: 'pending' }))
})

describe('rebuildSearchIndex', () => {
  it('replaces a stale shard with exactly the approved factories, flagging samples', async () => {
    await seed((db) => setDoc(doc(db, 'searchIndex/shard-0'), { version: 4, updatedAt: new Date(), entries: [stale] }))
    const r = await rebuildSearchIndex(asAdmin())
    expect(r).toEqual({ count: 2 })
    const s = await shard()
    expect(s!.version).toBe(5)
    expect(s!.entries.map((e) => e.id).sort()).toEqual(['a1', 'a2'])
    expect(s!.entries.find((e) => e.id === 'a2')!.x).toBe(true)
    expect('x' in s!.entries.find((e) => e.id === 'a1')!).toBe(false)
  })

  it('creates the shard with version 1 when none exists', async () => {
    await rebuildSearchIndex(asAdmin())
    const s = await shard()
    expect(s!.version).toBe(1)
    expect(s!.entries).toHaveLength(2)
  })

  it('is denied for a non-admin', async () => {
    const err = await rebuildSearchIndex(asUser('s1')).then(() => null, (e: unknown) => e)
    expect(err).not.toBeNull()
    expect(err).not.toBeInstanceOf(AdminError)
    expect(await shard()).toBeUndefined()
  })
})
