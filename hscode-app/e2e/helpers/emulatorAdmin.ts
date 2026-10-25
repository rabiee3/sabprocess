// Emulator-only admin access for e2e set-up that the client rules (rightly) forbid, e.g. rejecting a factory.
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function adminDb() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('emulatorAdmin refuses to run without FIRESTORE_EMULATOR_HOST (it must never touch production)')
  }
  if (getApps().length === 0) initializeApp({ projectId: 'demo-hscode' })
  return getFirestore()
}

export async function rejectFactory(fid: string, rejectReason: string): Promise<void> {
  await adminDb().doc(`factories/${fid}`).update({ status: 'rejected', rejectReason, updatedAt: new Date() })
}

export async function createInvite(code: string): Promise<void> {
  await adminDb().doc(`invites/${code}`).set({ usedBy: null, cancelled: false, createdAt: new Date() })
}

/** The fid of the (single) factory created by this user email's uid. */
export async function factoryIdOfEmail(email: string): Promise<string> {
  const db = adminDb()
  const users = await db.collection('users').where('email', '==', email).get()
  if (users.size !== 1) throw new Error(`expected one user for ${email}, found ${users.size}`)
  const factories = await db.collection('factories').where('createdBy', '==', users.docs[0].id).get()
  if (factories.size !== 1) throw new Error(`expected one factory for ${email}, found ${factories.size}`)
  return factories.docs[0].id
}

/** The searchIndex/shard-0 entries (id + names), for asserting what the public map would see. */
export async function indexEntries(): Promise<{ id: string; n: { en?: string; ar?: string } }[]> {
  const snap = await adminDb().doc('searchIndex/shard-0').get()
  return (snap.data()?.entries ?? []) as { id: string; n: { en?: string; ar?: string } }[]
}

/** A raw Firestore document's data (or undefined), read as the emulator admin. */
export async function docData(path: string): Promise<Record<string, unknown> | undefined> {
  return (await adminDb().doc(path).get()).data()
}

/** A fresh pending factory by s1, so a test can review one that no other test touches. */
export async function createPendingFactory(fid: string, nameEn: string): Promise<void> {
  await adminDb().doc(`factories/${fid}`).set({
    name: { en: nameEn, ar: '' },
    area: 'oct6-zone-1',
    sector: 'plastics-packaging',
    location: { lat: 29.9228, lng: 30.9129, accuracyM: 85, pinMoved: false },
    productsMade: [{ name: { en: 'Plastic crates', ar: '' }, hs: { heading: '3923' } }],
    productsNeeded: [],
    photoCount: 0,
    status: 'pending',
    createdBy: 's1',
    createdAt: new Date(),
    updatedAt: new Date(),
    sample: false,
  })
}

/** A throw-away active surveyor, so the deactivate test never disturbs the seeded `s1`. */
export async function createSurveyor(uid: string, name: string): Promise<void> {
  await adminDb().doc(`users/${uid}`).set({
    role: 'surveyor',
    active: true,
    name,
    email: `${uid}@example.com`,
    createdAt: new Date(),
  })
}
