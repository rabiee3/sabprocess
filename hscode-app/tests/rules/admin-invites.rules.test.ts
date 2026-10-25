import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { claimInvite } from '../../src/auth/api'
import { cancelInvite, generateInvite, randomCode } from '../../src/admin/invites'
import { countSubmissions, setSurveyorActive } from '../../src/admin/surveyors'
import { newFactoryId, submitFactory } from '../../src/survey/repo'
import type { FactoryInput } from '../../src/survey/types'
import { asAdmin, asUser, emailOf, seed } from './helpers'
import { seedFactory, seedUsersAndInvites, validFactory } from './fixtures'

beforeEach(seedUsersAndInvites)

const input: FactoryInput = {
  name: { en: 'Nile Plastics' },
  area: 'oct6-zone-3',
  location: { lat: 29.97, lng: 30.94, accuracyM: 12, pinMoved: false },
  productsMade: [],
  productsNeeded: [],
  contact: {},
  photos: [],
}

describe('generateInvite', () => {
  it('creates a 6-digit code with usedBy null', async () => {
    const fs = asAdmin()
    const code = await generateInvite('Ahmed', fs)
    expect(code).toMatch(/^\d{6}$/)
    expect((await getDoc(doc(fs, `invites/${code}`))).data()).toMatchObject({
      label: 'Ahmed',
      usedBy: null,
      cancelled: false,
    })
  })

  it('retries on collision (012345 exists) and keeps a leading zero', async () => {
    const seq = (...v: number[]) => {
      let n = 0
      return () => v[n++]
    }
    expect(await generateInvite(undefined, asAdmin(), seq(0.012345, 0.777777))).toBe('777777')
    expect(await generateInvite(undefined, asAdmin(), seq(0.012345, 0.042913))).toBe('042913')
  })

  it("throws 'collision' after 5 attempts", async () => {
    await expect(generateInvite(undefined, asAdmin(), () => 0.012345)).rejects.toThrow('collision')
  })

  it('randomCode(() => 0) is 000000', () => {
    expect(randomCode(() => 0)).toBe('000000')
  })

  it('is denied for a non-admin', async () => {
    await expect(generateInvite('x', asUser('s1'))).rejects.toBeTruthy()
  })
})

describe('invite create shape rule', () => {
  const create = (data: Record<string, unknown>) => setDoc(doc(asAdmin(), 'invites/555555'), data)
  const ok = () => ({ usedBy: null, cancelled: false, createdAt: serverTimestamp() })

  it('accepts the valid shape, with and without a label', async () => {
    await assertSucceeds(create(ok()))
    await assertSucceeds(setDoc(doc(asAdmin(), 'invites/555556'), { ...ok(), label: 'A' }))
  })
  it('rejects usedBy set', async () => {
    await assertFails(create({ ...ok(), usedBy: 'x' }))
  })
  it('rejects cancelled true', async () => {
    await assertFails(create({ ...ok(), cancelled: true }))
  })
  it('rejects extra keys', async () => {
    await assertFails(create({ ...ok(), usedAt: serverTimestamp() }))
  })
  it('rejects a missing createdAt or a client-chosen one', async () => {
    await assertFails(create({ usedBy: null, cancelled: false }))
    await assertFails(create({ ...ok(), createdAt: new Date() }))
  })
  it('rejects a non-string or over-long label', async () => {
    await assertFails(create({ ...ok(), label: 5 }))
    await assertFails(create({ ...ok(), label: 'x'.repeat(81) }))
  })
})

describe('cancelInvite', () => {
  it('cancels and blocks a later claim', async () => {
    const admin = asAdmin()
    await cancelInvite('482913', admin)
    expect((await getDoc(doc(admin, 'invites/482913'))).data()?.cancelled).toBe(true)
    const user = { uid: 'c1', displayName: 'C', email: emailOf('c1') }
    expect(await claimInvite(user, '482913', asUser('c1'))).toBe('invalid')
  })

  it('does not cancel a used invite', async () => {
    const admin = asAdmin()
    await cancelInvite('111111', admin)
    expect((await getDoc(doc(admin, 'invites/111111'))).data()?.cancelled).toBe(false)
  })
})

describe('surveyors', () => {
  it('deactivating s1 stops submitFactory', async () => {
    await setSurveyorActive('s1', false, asAdmin())
    const fs = asUser('s1')
    await expect(submitFactory('s1', newFactoryId(fs), input, fs)).rejects.toBeTruthy()
  })

  it('countSubmissions matches the seeded counts', async () => {
    await seedFactory('a', validFactory('s1', { status: 'pending' }))
    await seedFactory('b', validFactory('s1', { status: 'approved' }))
    await seedFactory('c', validFactory('s1', { status: 'approved' }))
    await seedFactory('d', validFactory('s1', { status: 'rejected' }))
    await seedFactory('e', validFactory('s2', { status: 'pending' }))
    await seed(async () => {})
    expect(await countSubmissions('s1', asAdmin())).toEqual({ pending: 1, approved: 2, rejected: 1 })
  })
})
