import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { ADMIN_UID, asAdmin, asUser, asVisitor, seed } from './helpers'
import { seedFactory, seedUsersAndInvites, validFactory } from './fixtures'

beforeEach(async () => {
  await seedUsersAndInvites()
  await seedFactory('fApproved', validFactory('s1', { status: 'approved', approvedAt: serverTimestamp() }))
  await seedFactory('fPending', validFactory('s1'))
  await seedFactory('fRejected', validFactory('s1', { status: 'rejected', rejectReason: 'Blurry photos' }))
  await seedFactory('fHidden', validFactory('s1', { status: 'hidden' }))
})

const create = (uid: string, data: Record<string, unknown>) =>
  setDoc(doc(asUser(uid), 'factories/fNew'), data)
const edit = (uid: string, id: string, data: Record<string, unknown>) =>
  updateDoc(doc(asUser(uid), `factories/${id}`), { updatedAt: serverTimestamp(), ...data })
const product = { name: { en: 'Feed' }, hs: { heading: '2309', sub: '230990' } }

describe('factories: read', () => {
  it('✓ visitor reads an approved factory', async () => {
    await assertSucceeds(getDoc(doc(asVisitor(), 'factories/fApproved')))
  })

  it('✗ visitor reads a pending factory', async () => {
    await assertFails(getDoc(doc(asVisitor(), 'factories/fPending')))
  })

  it('✗ visitor reads a hidden factory', async () => {
    await assertFails(getDoc(doc(asVisitor(), 'factories/fHidden')))
  })

  it('✓ s1 reads own pending factory', async () => {
    await assertSucceeds(getDoc(doc(asUser('s1'), 'factories/fPending')))
  })

  it("✗ s2 reads s1's pending factory", async () => {
    await assertFails(getDoc(doc(asUser('s2'), 'factories/fPending')))
  })

  it('✓ admin reads a hidden factory', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'factories/fHidden')))
  })
})

describe('factories: create', () => {
  it("✓ s1 creates validFactory('s1')", async () => {
    await assertSucceeds(create('s1', validFactory('s1')))
  })

  it('✓ s1 creates with products, optional fields and a 20,480-char thumb', async () => {
    await assertSucceeds(
      create(
        's1',
        validFactory('s1', {
          name: { en: 'Al-Nour', ar: 'النور' },
          area: 'other',
          areaOther: 'Abu Rawash',
          address: 'Behind the gas station',
          sector: 'animal-feed',
          productsMade: [product],
          productsNeeded: [product],
          thumb: 'a'.repeat(20480),
          photoCount: 3,
        }),
      ),
    )
  })

  it("✗ s1 creates with status:'approved'", async () => {
    await assertFails(create('s1', validFactory('s1', { status: 'approved' })))
  })

  it("✗ s1 creates with createdBy:'s2'", async () => {
    await assertFails(create('s1', validFactory('s2')))
  })

  it('✗ off (inactive surveyor) creates', async () => {
    await assertFails(create('off', validFactory('off')))
  })

  it('✗ c1 (client) creates', async () => {
    await assertFails(create('c1', validFactory('c1')))
  })

  it('✗ visitor creates', async () => {
    await assertFails(setDoc(doc(asVisitor(), 'factories/fNew'), validFactory('anon')))
  })

  it('✗ create with location outside Egypt {lat: 51.5, lng: -0.12}', async () => {
    await assertFails(
      create('s1', validFactory('s1', { location: { lat: 51.5, lng: -0.12, accuracyM: 5, pinMoved: false } })),
    )
  })

  it('✗ create with name: {}', async () => {
    await assertFails(create('s1', validFactory('s1', { name: {} })))
  })

  it('✗ create with a 121-char name', async () => {
    await assertFails(create('s1', validFactory('s1', { name: { en: 'x'.repeat(121) } })))
  })

  it('✗ create with sample: true', async () => {
    await assertFails(create('s1', validFactory('s1', { sample: true })))
  })

  it('✗ create with approvedAt set', async () => {
    await assertFails(create('s1', validFactory('s1', { approvedAt: serverTimestamp() })))
  })

  it('✗ create with rejectReason set', async () => {
    await assertFails(create('s1', validFactory('s1', { rejectReason: 'x' })))
  })

  it('✗ create with 31 productsMade', async () => {
    await assertFails(create('s1', validFactory('s1', { productsMade: Array(31).fill(product) })))
  })

  it('✗ create with a thumb of 20,481 chars', async () => {
    await assertFails(create('s1', validFactory('s1', { thumb: 'a'.repeat(20481) })))
  })

  it('✗ create with an unknown field', async () => {
    await assertFails(create('s1', validFactory('s1', { verified: true })))
  })

  it('✗ create with photoCount 4', async () => {
    await assertFails(create('s1', validFactory('s1', { photoCount: 4 })))
  })

  it('✗ create with a client-chosen createdAt', async () => {
    await assertFails(create('s1', validFactory('s1', { createdAt: new Date('2020-01-01') })))
  })

  it('✗ create with a client-chosen updatedAt', async () => {
    await assertFails(create('s1', validFactory('s1', { updatedAt: new Date('2020-01-01') })))
  })
})

describe('factories: update', () => {
  it('✓ s1 edits own pending factory', async () => {
    await assertSucceeds(edit('s1', 'fPending', { name: { en: 'Al-Nour Feed Mills 2' } }))
  })

  it('✓ s1 edits own rejected factory setting status → pending', async () => {
    await assertSucceeds(edit('s1', 'fRejected', { status: 'pending', address: 'Fixed address' }))
  })

  it('✗ s1 edits own rejected factory keeping status rejected', async () => {
    await assertFails(edit('s1', 'fRejected', { address: 'Fixed address' }))
  })

  it('✗ s1 sets status → approved', async () => {
    await assertFails(edit('s1', 'fPending', { status: 'approved' }))
  })

  it('✗ s1 sets status → hidden', async () => {
    await assertFails(edit('s1', 'fPending', { status: 'hidden' }))
  })

  it('✗ s1 edits own approved factory', async () => {
    await assertFails(edit('s1', 'fApproved', { address: 'x' }))
  })

  it('✗ s1 edits own hidden factory', async () => {
    await assertFails(edit('s1', 'fHidden', { status: 'pending' }))
  })

  it('✗ s1 changes createdBy', async () => {
    await assertFails(edit('s1', 'fPending', { createdBy: 's2' }))
  })

  it('✗ s1 changes createdAt', async () => {
    await assertFails(edit('s1', 'fPending', { createdAt: serverTimestamp() }))
  })

  it('✗ s1 sets approvedAt', async () => {
    await assertFails(edit('s1', 'fPending', { approvedAt: serverTimestamp() }))
  })

  it('✗ s1 sets sample:true on own pending', async () => {
    await assertFails(edit('s1', 'fPending', { sample: true }))
  })

  it('✗ s1 sets rejectReason on own pending', async () => {
    await assertFails(edit('s1', 'fPending', { rejectReason: 'x' }))
  })

  it('✗ s1 edits without updatedAt == request.time', async () => {
    await assertFails(
      updateDoc(doc(asUser('s1'), 'factories/fPending'), { address: 'x', updatedAt: new Date('2020-01-01') }),
    )
  })

  it('✗ s1 adds an unknown field on edit', async () => {
    await assertFails(edit('s1', 'fPending', { verified: true }))
  })

  it('✗ s1 moves the pin outside Egypt on edit', async () => {
    await assertFails(
      edit('s1', 'fPending', { location: { lat: 51.5, lng: -0.12, accuracyM: 5, pinMoved: true } }),
    )
  })

  it("✗ s2 edits s1's pending factory", async () => {
    await assertFails(edit('s2', 'fPending', { address: 'x' }))
  })

  it('✗ s1 edits own pending after being deactivated', async () => {
    await seed(async (db) => {
      await updateDoc(doc(db, 'users/s1'), { active: false })
    })
    await assertFails(edit('s1', 'fPending', { address: 'x' }))
  })
})

describe('factories: admin and delete', () => {
  it("✓ admin creates with status:'approved', sample:true", async () => {
    await assertSucceeds(
      setDoc(
        doc(asAdmin(), 'factories/fSample'),
        validFactory(ADMIN_UID, {
          status: 'approved',
          sample: true,
          approvedAt: serverTimestamp(),
        }),
      ),
    )
  })

  it('✓ admin approves a pending factory', async () => {
    await assertSucceeds(
      updateDoc(doc(asAdmin(), 'factories/fPending'), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('✓ admin rejects with a reason', async () => {
    await assertSucceeds(
      updateDoc(doc(asAdmin(), 'factories/fPending'), { status: 'rejected', rejectReason: 'Wrong area' }),
    )
  })

  it('✗ admin sets an invalid status', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'factories/fPending'), { status: 'deleted' }))
  })

  it('✓ admin deletes a factory', async () => {
    await assertSucceeds(deleteDoc(doc(asAdmin(), 'factories/fApproved')))
  })

  it('✗ s1 deletes own factory', async () => {
    await assertFails(deleteDoc(doc(asUser('s1'), 'factories/fPending')))
  })
})
