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
