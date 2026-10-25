import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { factoryConverter } from '../firebase/converters'
import { db } from '../firebase'
import type { Factory } from '../lib/types'
import type { ContactDraft, FactoryInput, PhotoData } from './types'

export type SurveyErrorCode = 'offline' | 'accessOff' | 'rejected' | 'quota' | 'generic'
export type SubmissionItem = { factory: Factory; pendingWrite: boolean }

export function toSurveyError(e: unknown): SurveyErrorCode {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined
  switch (code) {
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'accessOff'
    case 'unavailable':
    case 'firestore/unavailable':
      return 'offline'
    case 'resource-exhausted':
    case 'firestore/resource-exhausted':
      return 'quota'
    default:
      return 'generic'
  }
}

/**
 * Like toSurveyError, but a denied write is blamed on the account only when the account really is off:
 * `users/{uid}` (always readable by its owner) says inactive or not a surveyor. Otherwise the rules
 * rejected the data itself ('rejected'), and so does an unreadable user doc (we can't tell).
 */
export async function classifySubmitError(e: unknown, uid: string, fs: Firestore = db): Promise<SurveyErrorCode> {
  const code = toSurveyError(e)
  if (code !== 'accessOff') return code
  try {
    const u = (await getDoc(doc(fs, `users/${uid}`))).data()
    return !u || u.active === false || u.role !== 'surveyor' ? 'accessOff' : 'rejected'
  } catch {
    return 'rejected'
  }
}

/**
 * Whether factories/<fid> may already exist. Only a read that succeeds and finds nothing is false; any error
 * (offline with no cache, permission-denied, anything else) is true. A duplicate factory is acceptable, a lost draft is not.
 */
export async function factoryDocExists(fid: string, fs: Firestore = db): Promise<boolean> {
  try {
    return (await getDoc(doc(fs, `factories/${fid}`))).exists()
  } catch {
    return true
  }
}

export const newFactoryId = (fs: Firestore = db): string => doc(collection(fs, 'factories')).id

const clean = (s: string | undefined): string | undefined => {
  const t = s?.trim()
  return t ? t : undefined
}

const CONTACT_KEYS = ['phone', 'whatsapp', 'website', 'facebook', 'contactPerson'] as const

function contactPayload(c: ContactDraft): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (const k of CONTACT_KEYS) {
    const v = clean(c[k])
    if (v) out[k] = v
  }
  if (typeof c.whatsappSameAsPhone === 'boolean' && Object.keys(out).length > 0) {
    out.whatsappSameAsPhone = c.whatsappSameAsPhone
  }
  return out
}

const OPTIONAL = ['areaOther', 'address', 'sector', 'thumb'] as const

function factoryFields(input: FactoryInput): Record<string, unknown> {
  return {
    name: input.name,
    area: input.area,
    location: input.location,
    productsMade: input.productsMade,
    productsNeeded: input.productsNeeded,
    photoCount: input.photos.length,
    status: 'pending',
    updatedAt: serverTimestamp(),
  }
}

type Batch = ReturnType<typeof writeBatch>

function writePhotos(batch: Batch, fs: Firestore, fid: string, photos: PhotoData[]) {
  photos.forEach((p, i) => batch.set(doc(fs, `factories/${fid}/photos/${p.id}`), { data: p.data, order: i }))
}

/** One batch; offline callers must not await the returned commit. */
export function submitFactory(uid: string, fid: string, input: FactoryInput, fs: Firestore = db): Promise<void> {
  const batch = writeBatch(fs)
  const data: Record<string, unknown> = { ...factoryFields(input), createdBy: uid, createdAt: serverTimestamp() }
  for (const k of OPTIONAL) {
    const v = clean(input[k])
    if (v) data[k] = v
  }
  batch.set(doc(fs, `factories/${fid}`), data)
  const contact = contactPayload(input.contact)
  if (Object.keys(contact).length > 0) batch.set(doc(fs, `factories/${fid}/private/contact`), contact)
  writePhotos(batch, fs, fid, input.photos)
  return batch.commit()
}

export function resubmitFactory(
  _uid: string,
  fid: string,
  input: FactoryInput,
  previousPhotoIds: string[],
  fs: Firestore = db,
): Promise<void> {
  const batch = writeBatch(fs)
  const data: Record<string, unknown> = factoryFields(input)
  for (const k of OPTIONAL) data[k] = clean(input[k]) ?? deleteField()
  batch.update(doc(fs, `factories/${fid}`), data)
  const contactRef = doc(fs, `factories/${fid}/private/contact`)
  const contact = contactPayload(input.contact)
  if (Object.keys(contact).length > 0) batch.set(contactRef, contact)
  else batch.delete(contactRef)
  writePhotos(batch, fs, fid, input.photos)
  const keep = new Set<string>(input.photos.map((p) => p.id))
  for (const id of previousPhotoIds) if (!keep.has(id)) batch.delete(doc(fs, `factories/${fid}/photos/${id}`))
  return batch.commit()
}

export async function loadFactoryForEdit(
  fid: string,
  fs: Firestore = db,
): Promise<{ factory: Factory; contact: ContactDraft; photos: PhotoData[] } | null> {
  try {
    const snap = await getDoc(doc(fs, `factories/${fid}`).withConverter(factoryConverter))
    const factory = snap.data()
    if (!factory) return null
    const [contactSnap, photoSnap] = await Promise.all([
      getDoc(doc(fs, `factories/${fid}/private/contact`)),
      getDocs(collection(fs, `factories/${fid}/photos`)),
    ])
    const photos = photoSnap.docs
      .map((d) => ({ id: d.id as PhotoData['id'], data: d.data().data as string, order: d.data().order as number }))
      .sort((a, b) => a.order - b.order)
      .map(({ id, data }) => ({ id, data }))
    return { factory, contact: (contactSnap.data() as ContactDraft | undefined) ?? {}, photos }
  } catch (e) {
    if (toSurveyError(e) === 'accessOff') return null
    throw e
  }
}

export function subscribeMySubmissions(
  uid: string,
  cb: (items: SubmissionItem[], meta: { fromCache: boolean }) => void,
  onError: (code: SurveyErrorCode) => void,
  fs: Firestore = db,
): Unsubscribe {
  const q = query(
    collection(fs, 'factories').withConverter(factoryConverter),
    where('createdBy', '==', uid),
    where('status', 'in', ['pending', 'rejected', 'approved']),
    orderBy('updatedAt', 'desc'),
  )
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) =>
      cb(
        snap.docs.map((d) => ({ factory: d.data(), pendingWrite: d.metadata.hasPendingWrites })),
        { fromCache: snap.metadata.fromCache },
      ),
    (e) => onError(toSurveyError(e)),
  )
}
