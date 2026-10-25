import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { seed } from './helpers'

/** A spec-§4 factory as a surveyor submits it (status pending, owned by `uid`). */
export function validFactory(uid: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: { en: 'Al-Nour Feed Mills' },
    area: 'oct6-zone-3',
    location: { lat: 29.97, lng: 30.94, accuracyM: 12, pinMoved: true },
    productsMade: [],
    productsNeeded: [],
    photoCount: 0,
    status: 'pending',
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

export const validPhoto = (order = 1, size = 1000): Record<string, unknown> => ({
  data: 'a'.repeat(size),
  order,
})

export const validContact = (): Record<string, unknown> => ({
  phone: '+20 100 000 0000',
  whatsappSameAsPhone: true,
  contactPerson: 'Eng. Samir',
})

/** Seeds the users and invites listed in the Task 6 brief. */
export async function seedUsersAndInvites(): Promise<void> {
  await seed(async (db: Firestore) => {
    const user = (role: string, active: boolean) => ({
      role,
      active,
      name: 'Test',
      email: 'test@example.com',
      createdAt: serverTimestamp(),
    })
    await setDoc(doc(db, 'users/s1'), user('surveyor', true))
    await setDoc(doc(db, 'users/s2'), user('surveyor', true))
    await setDoc(doc(db, 'users/off'), user('surveyor', false))
    await setDoc(doc(db, 'users/c1'), user('client', true))
    const invite = (usedBy: string | null, cancelled: boolean) => ({
      usedBy,
      cancelled,
      createdAt: serverTimestamp(),
    })
    await setDoc(doc(db, 'invites/482913'), invite(null, false))
    await setDoc(doc(db, 'invites/012345'), invite(null, false))
    await setDoc(doc(db, 'invites/111111'), invite('s2', false))
    await setDoc(doc(db, 'invites/222222'), invite(null, true))
  })
}

/** Seeds `factories/{id}` with rules disabled. */
export async function seedFactory(id: string, data: Record<string, unknown>): Promise<void> {
  await seed(async (db) => {
    await setDoc(doc(db, `factories/${id}`), data)
  })
}
