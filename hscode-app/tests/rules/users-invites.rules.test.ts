import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { asAdmin, asUser } from './helpers'
import { seedUsersAndInvites } from './fixtures'

beforeEach(seedUsersAndInvites)

const newUser = (extra: Record<string, unknown> = {}) => ({
  role: 'client',
  active: true,
  name: 'New User',
  email: 'new@example.com',
  createdAt: serverTimestamp(),
  ...extra,
})

/** The §5.2 claim: upgrade `uid` (an existing client) and mark the invite used, in one batch. */
function claim(db: Firestore, uid: string, code: string, usedBy = uid) {
  const batch = writeBatch(db)
  batch.update(doc(db, `users/${uid}`), { role: 'surveyor', inviteCode: code })
  batch.update(doc(db, `invites/${code}`), { usedBy, usedAt: serverTimestamp() })
  return batch.commit()
}

describe('users', () => {
  it('✓ new user u9 creates users/u9 as an active client', async () => {
    await assertSucceeds(setDoc(doc(asUser('u9'), 'users/u9'), newUser()))
  })

  it('✗ u9 creates users/u9 as surveyor without an invite claim', async () => {
    await assertFails(setDoc(doc(asUser('u9'), 'users/u9'), newUser({ role: 'surveyor' })))
  })

  it('✗ u9 creates users/u9 with a self-set inviteCode and no claim', async () => {
    await assertFails(setDoc(doc(asUser('u9'), 'users/u9'), newUser({ inviteCode: '482913' })))
  })

  it('✗ u9 creates users/u9 with an extra field', async () => {
    await assertFails(setDoc(doc(asUser('u9'), 'users/u9'), newUser({ isAdmin: true })))
  })

  it('✗ u9 creates users/u9 with active:false', async () => {
    await assertFails(setDoc(doc(asUser('u9'), 'users/u9'), newUser({ active: false })))
  })

  it('✗ u9 creates users/u8 (someone else)', async () => {
    await assertFails(setDoc(doc(asUser('u9'), 'users/u8'), newUser()))
  })

  it('✓ new user u9 creates users/u9 as surveyor via a claim batch', async () => {
    const db = asUser('u9')
    const batch = writeBatch(db)
    batch.set(doc(db, 'users/u9'), newUser({ role: 'surveyor', inviteCode: '482913' }))
    batch.update(doc(db, 'invites/482913'), { usedBy: 'u9', usedAt: serverTimestamp() })
    await assertSucceeds(batch.commit())
  })

  it('✗ c1 updates own role to surveyor without touching an invite', async () => {
    await assertFails(updateDoc(doc(asUser('c1'), 'users/c1'), { role: 'surveyor' }))
  })

  it('✗ c1 sets inviteCode on itself without the invite write', async () => {
    await assertFails(
      updateDoc(doc(asUser('c1'), 'users/c1'), { role: 'surveyor', inviteCode: '482913' }),
    )
  })

  it('✓ c1 updates own name', async () => {
    await assertSucceeds(updateDoc(doc(asUser('c1'), 'users/c1'), { name: 'Renamed' }))
  })

  it('✗ c1 updates own active', async () => {
    await assertFails(updateDoc(doc(asUser('c1'), 'users/c1'), { active: false }))
  })

  it('✗ c1 updates own email', async () => {
    await assertFails(updateDoc(doc(asUser('c1'), 'users/c1'), { email: 'x@example.com' }))
  })

  it('✗ off (deactivated surveyor) reactivates itself', async () => {
    await assertFails(updateDoc(doc(asUser('off'), 'users/off'), { active: true }))
  })

  it('✗ c1 deletes own user doc', async () => {
    await assertFails(deleteDoc(doc(asUser('c1'), 'users/c1')))
  })

  it('✓ c1 reads own user doc', async () => {
    await assertSucceeds(getDoc(doc(asUser('c1'), 'users/c1')))
  })

  it('✗ s2 reads users/s1', async () => {
    await assertFails(getDoc(doc(asUser('s2'), 'users/s1')))
  })

  it('✓ admin sets users/s1.active=false', async () => {
    await assertSucceeds(updateDoc(doc(asAdmin(), 'users/s1'), { active: false }))
  })

  it("✗ admin changes users/s1.role (admin may only toggle active)", async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'users/s1'), { role: 'client' }))
  })

  it('✓ admin reads users/s1', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'users/s1')))
  })
})

describe('invite claim', () => {
  it('✓ c1 claims 482913 (user update + invite update in one batch)', async () => {
    await assertSucceeds(claim(asUser('c1'), 'c1', '482913'))
  })

  it('✓ c1 claims a leading-zero code "012345" (string)', async () => {
    await assertSucceeds(claim(asUser('c1'), 'c1', '012345'))
  })

  it('✗ c1 claims used code 111111', async () => {
    await assertFails(claim(asUser('c1'), 'c1', '111111'))
  })

  it('✗ c1 claims cancelled code 222222', async () => {
    await assertFails(claim(asUser('c1'), 'c1', '222222'))
  })

  it('✗ c1 claims non-existent code 999999', async () => {
    await assertFails(claim(asUser('c1'), 'c1', '999999'))
  })

  it('✗ c1 claims with the invite usedBy set to a different uid', async () => {
    await assertFails(claim(asUser('c1'), 'c1', '482913', 's2'))
  })

  it('✗ c1 marks an invite used without updating its own user doc', async () => {
    await assertFails(
      updateDoc(doc(asUser('c1'), 'invites/482913'), { usedBy: 'c1', usedAt: serverTimestamp() }),
    )
  })

  it('✗ off (deactivated surveyor) re-claims a fresh code to reactivate', async () => {
    const db = asUser('off')
    const batch = writeBatch(db)
    batch.update(doc(db, 'users/off'), { role: 'surveyor', inviteCode: '482913', active: true })
    batch.update(doc(db, 'invites/482913'), { usedBy: 'off', usedAt: serverTimestamp() })
    await assertFails(batch.commit())
  })
})

describe('invites', () => {
  it('✗ a signed-in user reads invites/482913', async () => {
    await assertFails(getDoc(doc(asUser('c1'), 'invites/482913')))
  })

  it('✗ a surveyor reads invites/482913', async () => {
    await assertFails(getDoc(doc(asUser('s1'), 'invites/482913')))
  })

  it('✗ a user creates an invite', async () => {
    await assertFails(
      setDoc(doc(asUser('c1'), 'invites/777777'), {
        usedBy: null,
        cancelled: false,
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('✓ admin creates, reads and cancels invites', async () => {
    const db = asAdmin()
    const ref = doc(db, 'invites/000777')
    await assertSucceeds(
      setDoc(ref, { label: 'Ahmed', usedBy: null, cancelled: false, createdAt: serverTimestamp() }),
    )
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(updateDoc(ref, { cancelled: true }))
  })
})
