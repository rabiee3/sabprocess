import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { ADMIN_UID } from '../firebase/config'
import { auth, db } from '../firebase'

const REDIRECT_FALLBACK_CODES = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]

const errorCode = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    const code = errorCode(e)
    if (code && REDIRECT_FALLBACK_CODES.includes(code)) {
      await signInWithRedirect(auth, provider)
      return
    }
    throw e
  }
}

export async function signInAdmin(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password)
}

/** The User fields the user doc is built from. */
export type UserProfile = Pick<User, 'uid' | 'displayName' | 'email'>

/**
 * Creates users/{uid} as an active client if missing. Skipped for the admin.
 * The rules bind `email` to the token's email; a Google token always carries one, so the `''`
 * fallback only applies to tokens the rules reject anyway.
 */
export async function ensureUserDoc(user: UserProfile, fs: Firestore = db): Promise<void> {
  if (user.uid === ADMIN_UID) return
  const ref = doc(fs, 'users', user.uid)
  if ((await getDoc(ref)).exists()) return
  const batch = writeBatch(fs)
  batch.set(ref, {
    role: 'client',
    active: true,
    name: user.displayName ?? '',
    email: user.email ?? '',
    createdAt: serverTimestamp(),
  })
  await batch.commit()
}

/**
 * Claims an invitation code: promotes the user to surveyor and marks the invite used, in one batch.
 * Only permission-denied / not-found map to 'invalid'; anything else (e.g. offline) is re-thrown.
 */
export async function claimInvite(
  user: UserProfile,
  code: string,
  fs: Firestore = db,
): Promise<'ok' | 'invalid'> {
  const { uid } = user
  try {
    const userRef = doc(fs, 'users', uid)
    const exists = (await getDoc(userRef)).exists()
    const batch = writeBatch(fs)
    if (exists) {
      batch.update(userRef, { role: 'surveyor', active: true, inviteCode: code })
    } else {
      batch.set(userRef, {
        role: 'surveyor',
        active: true,
        inviteCode: code,
        name: user.displayName ?? '',
        email: user.email ?? '',
        createdAt: serverTimestamp(),
      })
    }
    batch.update(doc(fs, 'invites', code), { usedBy: uid, usedAt: serverTimestamp() })
    await batch.commit()
    return 'ok'
  } catch (e) {
    const c = errorCode(e)
    if (c === 'permission-denied' || c === 'not-found') return 'invalid'
    throw e
  }
}
