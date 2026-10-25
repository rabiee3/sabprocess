import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { asAdmin, asUser, asVisitor, seed } from './helpers'
import { seedFactory, seedUsersAndInvites, validContact, validFactory, validPhoto } from './fixtures'

beforeEach(async () => {
  await seedUsersAndInvites()
  await seedFactory('fApproved', validFactory('s1', { status: 'approved', approvedAt: serverTimestamp() }))
  await seedFactory('fPending', validFactory('s1'))
  await seed(async (db) => {
    for (const id of ['fApproved', 'fPending']) {
      await setDoc(doc(db, `factories/${id}/photos/p1`), validPhoto())
      await setDoc(doc(db, `factories/${id}/private/contact`), validContact())
    }
  })
})

describe('batched create (parent does not exist before the write)', () => {
  it('✓ s1 creates factories/f9 + photos/p1 + private/contact in one batch', async () => {
    const db = asUser('s1')
    const batch = writeBatch(db)
    batch.set(doc(db, 'factories/f9'), validFactory('s1', { photoCount: 1 }))
    batch.set(doc(db, 'factories/f9/photos/p1'), validPhoto(1, 122880))
    batch.set(doc(db, 'factories/f9/private/contact'), validContact())
    await assertSucceeds(batch.commit())
  })

  it('✗ s1 creates a photo for a factory that does not exist', async () => {
    await assertFails(setDoc(doc(asUser('s1'), 'factories/nope/photos/p1'), validPhoto()))
  })
})

describe('photos', () => {
  it('✗ s1 creates photos/p4', async () => {
    await assertFails(setDoc(doc(asUser('s1'), 'factories/fPending/photos/p4'), validPhoto(3)))
  })

  it('✓ s1 adds photos/p2 to own pending factory', async () => {
    await assertSucceeds(setDoc(doc(asUser('s1'), 'factories/fPending/photos/p2'), validPhoto(2)))
  })

  it('✗ photo data of 122,881 chars', async () => {
    await assertFails(
      setDoc(doc(asUser('s1'), 'factories/fPending/photos/p2'), validPhoto(2, 122881)),
    )
  })

  it('✗ photo with an extra field', async () => {
    await assertFails(
      setDoc(doc(asUser('s1'), 'factories/fPending/photos/p2'), { ...validPhoto(2), caption: 'x' }),
    )
  })

  it("✗ s2 adds a photo to s1's factory", async () => {
    await assertFails(setDoc(doc(asUser('s2'), 'factories/fPending/photos/p2'), validPhoto(2)))
  })

  it('✗ s1 replaces a photo of own approved factory', async () => {
    await assertFails(setDoc(doc(asUser('s1'), 'factories/fApproved/photos/p1'), validPhoto()))
  })

  it('✓ s1 deletes a photo of own pending factory', async () => {
    await assertSucceeds(deleteDoc(doc(asUser('s1'), 'factories/fPending/photos/p1')))
  })

  it('✗ s1 deletes a photo of own approved factory', async () => {
    await assertFails(deleteDoc(doc(asUser('s1'), 'factories/fApproved/photos/p1')))
  })

  it('✓ admin replaces a photo of an approved factory', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'factories/fApproved/photos/p1'), validPhoto()))
  })

  it('✓ visitor reads photos of an approved factory', async () => {
    await assertSucceeds(getDoc(doc(asVisitor(), 'factories/fApproved/photos/p1')))
  })

  it('✗ visitor reads photos of a pending factory', async () => {
    await assertFails(getDoc(doc(asVisitor(), 'factories/fPending/photos/p1')))
  })

  it('✓ s1 reads photos of own pending factory', async () => {
    await assertSucceeds(getDoc(doc(asUser('s1'), 'factories/fPending/photos/p1')))
  })
})

describe('private/contact', () => {
  it('✗ visitor reads private/contact of an approved factory', async () => {
    await assertFails(getDoc(doc(asVisitor(), 'factories/fApproved/private/contact')))
  })

  it('✓ c1 reads private/contact of an approved factory', async () => {
    await assertSucceeds(getDoc(doc(asUser('c1'), 'factories/fApproved/private/contact')))
  })

  it('✗ c1 reads private/contact of a pending factory', async () => {
    await assertFails(getDoc(doc(asUser('c1'), 'factories/fPending/private/contact')))
  })

  it('✓ owner s1 reads own pending contact', async () => {
    await assertSucceeds(getDoc(doc(asUser('s1'), 'factories/fPending/private/contact')))
  })

  it('✓ admin reads a pending contact', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'factories/fPending/private/contact')))
  })

  it('✗ c1 writes private/contact of an approved factory', async () => {
    await assertFails(
      updateDoc(doc(asUser('c1'), 'factories/fApproved/private/contact'), { phone: '0' }),
    )
  })

  it('✓ s1 updates own pending contact', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser('s1'), 'factories/fPending/private/contact'), { website: 'https://x.eg' }),
    )
  })

  it('✗ s1 updates own approved contact', async () => {
    await assertFails(
      updateDoc(doc(asUser('s1'), 'factories/fApproved/private/contact'), { phone: '0' }),
    )
  })

  it('✗ s1 adds an unknown field to own pending contact', async () => {
    await assertFails(
      updateDoc(doc(asUser('s1'), 'factories/fPending/private/contact'), { email: 'x@y.eg' }),
    )
  })

  it('✗ s1 writes another doc under private/', async () => {
    await assertFails(setDoc(doc(asUser('s1'), 'factories/fPending/private/notes'), validContact()))
  })
})
