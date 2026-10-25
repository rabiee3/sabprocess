import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { asAdmin, asUser, asUserWithProvider, emailOf, seed, type SignInProvider } from './helpers'
import { seedFactory, seedUsersAndInvites, validContact, validFactory } from './fixtures'

// Spec §2: every non-admin user signs in with Google. The admin signs in with email/password and is
// recognised by UID alone. A token from any other provider must not unlock a non-admin branch.

beforeEach(async () => {
  await seedUsersAndInvites()
  await seedFactory('fApproved', validFactory('s1', { status: 'approved', approvedAt: serverTimestamp() }))
  await seedFactory('fPending', validFactory('s1'))
  await seed(async (db) => {
    await setDoc(doc(db, 'factories/fApproved/private/contact'), validContact())
    await setDoc(doc(db, 'factories/fPending/private/contact'), validContact())
  })
})

const clientDoc = (uid: string, email = emailOf(uid)) => ({
  role: 'client',
  active: true,
  name: 'New User',
  email,
  createdAt: serverTimestamp(),
})

function claimBatch(db: Firestore, uid: string, code: string) {
  const batch = writeBatch(db)
  batch.update(doc(db, `users/${uid}`), { role: 'surveyor', inviteCode: code })
  batch.update(doc(db, `invites/${code}`), { usedBy: uid, usedAt: serverTimestamp() })
  return batch.commit()
}

function claimCreateBatch(db: Firestore, uid: string, code: string, email = emailOf(uid)) {
  const batch = writeBatch(db)
  batch.set(doc(db, `users/${uid}`), { ...clientDoc(uid, email), role: 'surveyor', inviteCode: code })
  batch.update(doc(db, `invites/${code}`), { usedBy: uid, usedAt: serverTimestamp() })
  return batch.commit()
}

describe.each<SignInProvider>(['password', 'anonymous'])("non-Google provider '%s'", (provider) => {
  const as = (uid: string) => asUserWithProvider(uid, provider)

  it('✗ reads private/contact of an approved factory', async () => {
    await assertFails(getDoc(doc(as('c1'), 'factories/fApproved/private/contact')))
  })

  it('✗ creates a client users doc', async () => {
    await assertFails(setDoc(doc(as('u9'), 'users/u9'), clientDoc('u9')))
  })

  it('✗ claims an invite (existing client)', async () => {
    await assertFails(claimBatch(as('c1'), 'c1', '482913'))
  })

  it('✗ claims an invite while creating its user doc', async () => {
    await assertFails(claimCreateBatch(as('u9'), 'u9', '482913'))
  })

  it('✗ creates a factory as a seeded active surveyor', async () => {
    await assertFails(setDoc(doc(as('s1'), 'factories/fNew'), validFactory('s1')))
  })

  it('✗ reads own pending factory', async () => {
    await assertFails(getDoc(doc(as('s1'), 'factories/fPending')))
  })

  it('✗ reads own pending contact', async () => {
    await assertFails(getDoc(doc(as('s1'), 'factories/fPending/private/contact')))
  })
})

describe('Google provider (control)', () => {
  it('✓ reads private/contact of an approved factory', async () => {
    await assertSucceeds(getDoc(doc(asUser('c1'), 'factories/fApproved/private/contact')))
  })

  it('✓ creates a factory as a seeded active surveyor', async () => {
    await assertSucceeds(setDoc(doc(asUser('s1'), 'factories/fNew'), validFactory('s1')))
  })
})

describe('email binding on users create', () => {
  it('✓ client create with the token email', async () => {
    await assertSucceeds(setDoc(doc(asUser('u9'), 'users/u9'), clientDoc('u9')))
  })

  it("✗ client create with an email that differs from the token's", async () => {
    await assertFails(setDoc(doc(asUser('u9'), 'users/u9'), clientDoc('u9', 'someone@else.com')))
  })

  it("✗ claim-create with an email that differs from the token's", async () => {
    await assertFails(claimCreateBatch(asUser('u9'), 'u9', '482913', 'someone@else.com'))
  })

  it('✗ client create when the token carries no email', async () => {
    await assertFails(setDoc(doc(asUserWithProvider('u9', 'google.com', null), 'users/u9'), clientDoc('u9', '')))
  })
})

describe('admin is recognised by UID alone (password provider)', () => {
  it('✓ admin reads a pending contact', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'factories/fPending/private/contact')))
  })

  it('✓ admin creates an approved factory', async () => {
    await assertSucceeds(
      setDoc(
        doc(asAdmin(), 'factories/fAdmin'),
        validFactory('k0a0b8HhATfZuFcC0clBqGmtGmF3', { status: 'approved', approvedAt: serverTimestamp() }),
      ),
    )
  })
})
