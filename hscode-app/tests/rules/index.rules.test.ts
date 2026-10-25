import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { asAdmin, asUser, asVisitor, seed } from './helpers'
import { seedUsersAndInvites } from './fixtures'

const shard = () => ({ version: 1, updatedAt: serverTimestamp(), entries: [] })

beforeEach(async () => {
  await seedUsersAndInvites()
  await seed(async (db) => {
    await setDoc(doc(db, 'searchIndex/shard-0'), shard())
  })
})

it('✓ visitor reads searchIndex/shard-0', async () => {
  await assertSucceeds(getDoc(doc(asVisitor(), 'searchIndex/shard-0')))
})

it('✗ s1 writes searchIndex/shard-0', async () => {
  await assertFails(setDoc(doc(asUser('s1'), 'searchIndex/shard-0'), shard()))
})

it('✗ visitor writes searchIndex/shard-0', async () => {
  await assertFails(setDoc(doc(asVisitor(), 'searchIndex/shard-0'), shard()))
})

it('✓ admin writes searchIndex/shard-0', async () => {
  await assertSucceeds(setDoc(doc(asAdmin(), 'searchIndex/shard-0'), shard()))
})

it('✗ visitor reads an unknown top-level collection', async () => {
  await assertFails(getDoc(doc(asVisitor(), 'secrets/x')))
})
