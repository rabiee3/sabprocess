import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { claimInvite, ensureUserDoc } from '../../src/auth/api'
import { asUser, seed } from './helpers'

const user = (uid: string, name: string | null = 'Ann', email: string | null = 'a@x.io') =>
  ({ uid, displayName: name, email }) as never

const seedInvite = (code: string) =>
  seed((db) => setDoc(doc(db, 'invites', code), { usedBy: null, cancelled: false }))

describe('ensureUserDoc', () => {
  it('creates a client doc once and does not overwrite role', async () => {
    const fs = asUser('c1')
    await ensureUserDoc(user('c1'), fs)
    expect((await getDoc(doc(fs, 'users/c1'))).data()).toMatchObject({ role: 'client', active: true, name: 'Ann' })
    await seed((db) => setDoc(doc(db, 'users/c1'), { role: 'surveyor', active: true, name: 'Ann', email: 'a@x.io', createdAt: serverTimestamp() }))
    await ensureUserDoc(user('c1'), fs)
    expect((await getDoc(doc(fs, 'users/c1'))).data()?.role).toBe('surveyor')
  })

  it('maps null displayName/email to empty strings', async () => {
    const fs = asUser('c2')
    await ensureUserDoc(user('c2', null, null), fs)
    expect((await getDoc(doc(fs, 'users/c2'))).data()).toMatchObject({ name: '', email: '' })
  })
})

describe('claimInvite', () => {
  it('returns ok for a fresh code and invalid on reuse', async () => {
    await seedInvite('482913')
    await ensureUserDoc(user('c1'), asUser('c1'))
    await ensureUserDoc(user('c2'), asUser('c2'))
    expect(await claimInvite('c1', '482913', asUser('c1'))).toBe('ok')
    expect((await getDoc(doc(asUser('c1'), 'users/c1'))).data()).toMatchObject({ role: 'surveyor', inviteCode: '482913' })
    expect(await claimInvite('c2', '482913', asUser('c2'))).toBe('invalid')
  })

  it('keeps a leading zero', async () => {
    await seedInvite('012345')
    await ensureUserDoc(user('c1'), asUser('c1'))
    expect(await claimInvite('c1', '012345', asUser('c1'))).toBe('ok')
  })

  it('works when no user doc exists yet', async () => {
    await seedInvite('111111')
    expect(await claimInvite('c3', '111111', asUser('c3'))).toBe('ok')
  })

  it('returns invalid for an unknown code', async () => {
    await ensureUserDoc(user('c1'), asUser('c1'))
    expect(await claimInvite('c1', '999999', asUser('c1'))).toBe('invalid')
  })
})
