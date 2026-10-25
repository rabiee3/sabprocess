import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDocFromServer,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Invite } from './types'

const MAX_ATTEMPTS = 5

/** A 6-digit, zero-padded code. `rng` returns a float in [0, 1); the default is crypto-backed. */
export function randomCode(rng: () => number = cryptoRandom): string {
  const n = Math.min(999_999, Math.floor(rng() * 1_000_000))
  return String(n).padStart(6, '0')
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 2 ** 32
}

/** Creates a fresh invite and returns its code. Retries on collision; throws 'collision' after 5 tries. */
export async function generateInvite(
  label: string | undefined,
  fs: Firestore = db,
  rng?: () => number,
): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = randomCode(rng)
    const ref = doc(fs, 'invites', code)
    if ((await getDoc(ref)).exists()) continue
    const trimmed = label?.trim()
    await setDoc(ref, {
      ...(trimmed ? { label: trimmed } : {}),
      usedBy: null,
      cancelled: false,
      createdAt: serverTimestamp(),
    })
    return code
  }
  throw new Error('collision')
}

/** Cancels an unused invite (a used one is left alone). */
export async function cancelInvite(code: string, fs: Firestore = db): Promise<void> {
  const ref = doc(fs, 'invites', code)
  const snap = await getDocFromServer(ref)
  if (!snap.exists() || snap.data().usedBy != null) return
  await updateDoc(ref, { cancelled: true })
}

const toDate = (v: unknown): Date | undefined =>
  v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : undefined

function toInvite(s: QueryDocumentSnapshot<DocumentData>): Invite {
  const d = s.data({ serverTimestamps: 'estimate' })
  const usedAt = toDate(d.usedAt)
  return {
    code: s.id,
    ...(typeof d.label === 'string' ? { label: d.label } : {}),
    usedBy: typeof d.usedBy === 'string' ? d.usedBy : null,
    ...(usedAt ? { usedAt } : {}),
    cancelled: d.cancelled === true,
    createdAt: toDate(d.createdAt) ?? new Date(0),
  }
}

/** Live invites, newest first. */
export function subscribeInvites(
  cb: (rows: Invite[]) => void,
  onError: (e: unknown) => void,
  fs: Firestore = db,
): Unsubscribe {
  return onSnapshot(
    query(collection(fs, 'invites'), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map(toInvite)),
    onError,
  )
}
