import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { asUser, asVisitor, emailOf, seed } from './helpers'
import { seedFactory, seedUsersAndInvites, validContact, validFactory, validPhoto } from './fixtures'

beforeEach(async () => {
  await seedUsersAndInvites()
  await seedFactory('fApproved', validFactory('s1', { status: 'approved', approvedAt: serverTimestamp() }))
  await seedFactory('fPending', validFactory('s1'))
  await seedFactory('fRejected', validFactory('s1', { status: 'rejected', rejectReason: 'Blurry' }))
  await seedFactory('fHidden', validFactory('s1', { status: 'hidden' }))
  await seed(async (db) => {
    await setDoc(doc(db, 'factories/fApproved/photos/p1'), validPhoto())
    await setDoc(doc(db, 'factories/fApproved/private/contact'), validContact())
  })
})

describe('list queries', () => {
  it('✗ visitor lists factories with no filter', async () => {
    await assertFails(getDocs(collection(asVisitor(), 'factories')))
  })

  it("✓ visitor lists factories where status == 'approved'", async () => {
    await assertSucceeds(getDocs(query(collection(asVisitor(), 'factories'), where('status', '==', 'approved'))))
  })

  it("✗ s1 lists factories where createdBy == 's1' without a status filter", async () => {
    const db = asUser('s1')
    await assertFails(getDocs(query(collection(db, 'factories'), where('createdBy', '==', 's1'))))
  })

  it("✓ s1 lists own factories with status in ['pending','rejected','approved'] (Plan 2 \"My submissions\")", async () => {
    const db = asUser('s1')
    const q = query(
      collection(db, 'factories'),
      where('createdBy', '==', 's1'),
      where('status', 'in', ['pending', 'rejected', 'approved']),
    )
    const snap = await assertSucceeds(getDocs(q))
    expect(snap.docs.map((d) => d.id).sort()).toEqual(['fApproved', 'fPending', 'fRejected'])
  })

  it('✗ a non-admin lists users', async () => {
    await assertFails(getDocs(collection(asUser('s1'), 'users')))
  })

  it('✗ a non-admin lists invites', async () => {
    await assertFails(getDocs(collection(asUser('c1'), 'invites')))
  })

  it("✗ a client queries collectionGroup('private')", async () => {
    await assertFails(getDocs(collectionGroup(asUser('c1'), 'private')))
  })

  it("✗ a visitor queries collectionGroup('photos')", async () => {
    await assertFails(getDocs(collectionGroup(asVisitor(), 'photos')))
  })
})

describe('un-claim', () => {
  it('✗ s2 sets invites/111111 usedBy → null', async () => {
    await assertFails(updateDoc(doc(asUser('s2'), 'invites/111111'), { usedBy: null }))
  })

  it("✗ a surveyor sets own role → 'client'", async () => {
    await assertFails(updateDoc(doc(asUser('s1'), 'users/s1'), { role: 'client' }))
  })

  it('✗ a surveyor clears own inviteCode (delete or null)', async () => {
    await seed((db) => updateDoc(doc(db, 'users/s2'), { inviteCode: '111111' }))
    await assertFails(updateDoc(doc(asUser('s2'), 'users/s2'), { inviteCode: deleteField() }))
    await assertFails(updateDoc(doc(asUser('s2'), 'users/s2'), { inviteCode: null }))
  })
})

describe('claim with a fabricated invite', () => {
  const fakeInvite = { usedBy: 'c1', usedAt: serverTimestamp(), cancelled: false }

  it('✗ c1 claim batch that batch.set-creates the missing invite 999999', async () => {
    const db = asUser('c1')
    const batch = writeBatch(db)
    batch.update(doc(db, 'users/c1'), { role: 'surveyor', inviteCode: '999999' })
    batch.set(doc(db, 'invites/999999'), fakeInvite)
    await assertFails(batch.commit())
  })

  it('✗ new user u9 claim-create batch that batch.set-creates the missing invite 999999', async () => {
    const db = asUser('u9')
    const batch = writeBatch(db)
    batch.set(doc(db, 'users/u9'), {
      role: 'surveyor',
      active: true,
      inviteCode: '999999',
      name: 'U9',
      email: emailOf('u9'),
      createdAt: serverTimestamp(),
    })
    batch.set(doc(db, 'invites/999999'), { ...fakeInvite, usedBy: 'u9' })
    await assertFails(batch.commit())
  })
})

describe('factory create: type confusion', () => {
  const create = (data: Record<string, unknown>) => setDoc(doc(asUser('s1'), 'factories/fNew'), data)

  it("✗ location.lat: '30' (string)", async () => {
    await assertFails(create(validFactory('s1', { location: { lat: '30', lng: 30.94, accuracyM: 12, pinMoved: true } })))
  })

  it("✗ name: 'x' (string, not a map)", async () => {
    await assertFails(create(validFactory('s1', { name: 'x' })))
  })

  it('✗ productsMade: {} (map, not a list)', async () => {
    await assertFails(create(validFactory('s1', { productsMade: {} })))
  })
})
