import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { claimInvite, ensureUserDoc } from '../../src/auth/api'
import { assertFails } from '@firebase/rules-unit-testing'
import { asUser, asUserWithProvider, emailOf, seed } from './helpers'

// The email matches the token asUser(uid) carries (the rules bind them).
const user = (uid: string, name: string | null = 'Ann', email: string | null = emailOf(uid)) => ({
  uid,
  displayName: name,
  email,
})

const seedInvite = (code: string) =>
  seed((db) => setDoc(doc(db, 'invites', code), { usedBy: null, cancelled: false }))

describe('ensureUserDoc', () => {
  it('creates a client doc once and does not overwrite role', async () => {
    const fs = asUser('c1')
    await ensureUserDoc(user('c1'), fs)
    expect((await getDoc(doc(fs, 'users/c1'))).data()).toMatchObject({ role: 'client', active: true, name: 'Ann' })
    await seed((db) => setDoc(doc(db, 'users/c1'), { role: 'surveyor', active: true, name: 'Ann', email: emailOf('c1'), createdAt: serverTimestamp() }))
    await ensureUserDoc(user('c1'), fs)
    expect((await getDoc(doc(fs, 'users/c1'))).data()?.role).toBe('surveyor')
  })

  it('maps a null displayName to an empty string', async () => {
    const fs = asUser('c2')
    await ensureUserDoc(user('c2', null), fs)
    expect((await getDoc(doc(fs, 'users/c2'))).data()).toMatchObject({ name: '', email: emailOf('c2') })
  })

  it('a null email maps to "" and is rejected when the token has no email (acceptable: Google always sends one)', async () => {
    await assertFails(ensureUserDoc(user('c2', 'Ann', null), asUserWithProvider('c2', 'google.com', null)))
  })
})

describe('claimInvite', () => {
  it('returns ok for a fresh code and invalid on reuse', async () => {
    await seedInvite('482913')
    await ensureUserDoc(user('c1'), asUser('c1'))
    await ensureUserDoc(user('c2'), asUser('c2'))
    expect(await claimInvite(user('c1'), '482913', asUser('c1'))).toBe('ok')
    expect((await getDoc(doc(asUser('c1'), 'users/c1'))).data()).toMatchObject({ role: 'surveyor', inviteCode: '482913' })
    expect(await claimInvite(user('c2'), '482913', asUser('c2'))).toBe('invalid')
  })

  it('keeps a leading zero', async () => {
    await seedInvite('012345')
    await ensureUserDoc(user('c1'), asUser('c1'))
    expect(await claimInvite(user('c1'), '012345', asUser('c1'))).toBe('ok')
  })

  it('works when no user doc exists yet', async () => {
    await seedInvite('111111')
    expect(await claimInvite(user('c3'), '111111', asUser('c3'))).toBe('ok')
    expect((await getDoc(doc(asUser('c3'), 'users/c3'))).data()).toMatchObject({ role: 'surveyor', email: emailOf('c3') })
  })

  it('returns invalid for an unknown code', async () => {
    await ensureUserDoc(user('c1'), asUser('c1'))
    expect(await claimInvite(user('c1'), '999999', asUser('c1'))).toBe('invalid')
  })
})
