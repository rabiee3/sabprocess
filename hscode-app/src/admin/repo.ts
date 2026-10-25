import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Timestamp,
  type Transaction,
} from 'firebase/firestore'
import { ADMIN_UID } from '../firebase/config'
import { factoryConverter } from '../firebase/converters'
import { db } from '../firebase'
import { toIndexEntry } from '../lib/indexEntry'
import type { Factory, IndexEntry } from '../lib/types'
import { clean, contactPayload, newFactoryId } from '../survey/repo'
import type { ContactDraft, FactoryInput, PhotoData } from '../survey/types'
import { INDEX_LIMIT, indexFill, removeEntry, upsertEntry } from './searchIndex'

export type AdminErrorCode = 'stale' | 'indexFull' | 'invalid'

export class AdminError extends Error {
  readonly code: AdminErrorCode
  constructor(code: AdminErrorCode) {
    super(code)
    this.name = 'AdminError'
    this.code = code
  }
}

export type AdminEdit = Partial<
  Pick<Factory, 'name' | 'area' | 'areaOther' | 'address' | 'sector' | 'location' | 'productsMade' | 'productsNeeded'>
>

type Shard = { exists: boolean; entries: IndexEntry[] }

const PHOTO_IDS = ['p1', 'p2', 'p3'] as const
const OPTIONAL_TEXT = ['areaOther', 'address', 'sector'] as const
const PLAIN = ['name', 'area', 'location', 'productsMade', 'productsNeeded'] as const

const shardRef = (fs: Firestore) => doc(fs, 'searchIndex/shard-0')
const factoryRef = (fs: Firestore, fid: string) => doc(fs, `factories/${fid}`).withConverter(factoryConverter)

/** Firestore payload for an edit: empty optional text deletes the field. */
function editPayload(edit: AdminEdit): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of PLAIN) if (edit[k] !== undefined) out[k] = edit[k]
  for (const k of OPTIONAL_TEXT) if (k in edit) out[k] = clean(edit[k]) ?? deleteField()
  return out
}

/** The stored factory with the edit applied (what the index entry is built from). */
function applyEdit(f: Factory, edit: AdminEdit): Factory {
  const out: Factory = { ...f }
  for (const k of PLAIN) if (edit[k] !== undefined) Object.assign(out, { [k]: edit[k] })
  for (const k of OPTIONAL_TEXT) {
    if (!(k in edit)) continue
    const v = clean(edit[k])
    if (v) out[k] = v
    else delete out[k]
  }
  return out
}

/** Reads the factory in the tx and checks the raw updatedAt (never the converter's fallback date). */
async function readFresh(tx: Transaction, fs: Firestore, fid: string, openedAt: Timestamp): Promise<Factory> {
  const snap = await tx.get(factoryRef(fs, fid))
  const factory = snap.data()
  const raw = snap.get('updatedAt') as Timestamp | undefined
  if (!factory || !raw || typeof raw.isEqual !== 'function' || !raw.isEqual(openedAt)) throw new AdminError('stale')
  return factory
}

async function readShard(tx: Transaction, fs: Firestore): Promise<Shard> {
  const snap = await tx.get(shardRef(fs))
  const entries = snap.exists() ? ((snap.data().entries as IndexEntry[] | undefined) ?? []) : []
  return { exists: snap.exists(), entries }
}

function writeShard(tx: Transaction, fs: Firestore, s: Shard, entries: IndexEntry[]) {
  if (indexFill(entries) > INDEX_LIMIT) throw new AdminError('indexFull')
  // set() would reset increment() to 0 + 1, so an existing shard is updated instead.
  if (s.exists) tx.update(shardRef(fs), { version: increment(1), updatedAt: serverTimestamp(), entries })
  else tx.set(shardRef(fs), { version: 1, updatedAt: serverTimestamp(), entries })
}

/** Writes the shard only when the removal changed something. */
function dropFromShard(tx: Transaction, fs: Firestore, s: Shard, fid: string) {
  const next = removeEntry(s.entries, fid)
  if (next.length !== s.entries.length) writeShard(tx, fs, s, next)
}

export async function loadForReview(
  fid: string,
  fs: Firestore = db,
): Promise<{ factory: Factory; openedAt: Timestamp; contact: ContactDraft; photos: PhotoData[] } | null> {
  const snap = await getDoc(factoryRef(fs, fid))
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
  return {
    factory,
    openedAt: snap.get('updatedAt') as Timestamp,
    contact: (contactSnap.data() as ContactDraft | undefined) ?? {},
    photos,
  }
}

export async function approveFactory(fid: string, openedAt: Timestamp, edit: AdminEdit, fs: Firestore = db): Promise<void> {
  const photoCount = (await getDocs(collection(fs, `factories/${fid}/photos`))).size
  await runTransaction(fs, async (tx) => {
    const stored = await readFresh(tx, fs, fid, openedAt)
    const shard = await readShard(tx, fs)
    const merged: Factory = { ...applyEdit(stored, edit), status: 'approved', approvedAt: new Date() }
    const entries = upsertEntry(shard.entries, toIndexEntry(merged))
    tx.update(factoryRef(fs, fid), {
      ...editPayload(edit),
      status: 'approved',
      photoCount,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      rejectReason: deleteField(),
    })
    writeShard(tx, fs, shard, entries)
  })
}

export async function rejectFactory(fid: string, openedAt: Timestamp, reason: string, fs: Firestore = db): Promise<void> {
  const text = reason.trim()
  if (text.length < 1 || text.length > 500) throw new AdminError('invalid')
  await runTransaction(fs, async (tx) => {
    await readFresh(tx, fs, fid, openedAt)
    const shard = await readShard(tx, fs)
    tx.update(factoryRef(fs, fid), { status: 'rejected', rejectReason: text, updatedAt: serverTimestamp() })
    dropFromShard(tx, fs, shard, fid)
  })
}

export async function saveEdits(fid: string, openedAt: Timestamp, edit: AdminEdit, fs: Firestore = db): Promise<void> {
  await runTransaction(fs, async (tx) => {
    const stored = await readFresh(tx, fs, fid, openedAt)
    const shard = await readShard(tx, fs)
    tx.update(factoryRef(fs, fid), { ...editPayload(edit), updatedAt: serverTimestamp() })
    if (stored.status === 'approved') {
      writeShard(tx, fs, shard, upsertEntry(shard.entries, toIndexEntry(applyEdit(stored, edit))))
    }
  })
}

async function setStatus(fid: string, status: 'hidden' | 'approved', fs: Firestore): Promise<void> {
  await runTransaction(fs, async (tx) => {
    const stored = (await tx.get(factoryRef(fs, fid))).data()
    if (!stored) throw new AdminError('invalid')
    const shard = await readShard(tx, fs)
    tx.update(factoryRef(fs, fid), { status, updatedAt: serverTimestamp() })
    if (status === 'hidden') dropFromShard(tx, fs, shard, fid)
    else writeShard(tx, fs, shard, upsertEntry(shard.entries, toIndexEntry({ ...stored, status })))
  })
}

export const hideFactory = (fid: string, fs: Firestore = db): Promise<void> => setStatus(fid, 'hidden', fs)
export const unhideFactory = (fid: string, fs: Firestore = db): Promise<void> => setStatus(fid, 'approved', fs)

export async function deleteFactory(fid: string, fs: Firestore = db): Promise<void> {
  const batch = writeBatch(fs)
  for (const id of PHOTO_IDS) batch.delete(doc(fs, `factories/${fid}/photos/${id}`))
  batch.delete(doc(fs, `factories/${fid}/private/contact`))
  batch.delete(doc(fs, `factories/${fid}`))
  await batch.commit()
  await runTransaction(fs, async (tx) => {
    dropFromShard(tx, fs, await readShard(tx, fs), fid)
  })
}

export async function adminCreateFactory(input: FactoryInput, opts: { sample: boolean }, fs: Firestore = db): Promise<string> {
  const fid = newFactoryId(fs)
  const data: Record<string, unknown> = {
    name: input.name,
    area: input.area,
    location: input.location,
    productsMade: input.productsMade,
    productsNeeded: input.productsNeeded,
    photoCount: input.photos.length,
    status: 'approved',
    createdBy: ADMIN_UID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
  }
  for (const k of [...OPTIONAL_TEXT, 'thumb'] as const) {
    const v = clean(input[k])
    if (v) data[k] = v
  }
  if (opts.sample) data.sample = true
  const now = new Date()
  const entry = toIndexEntry({
    id: fid,
    name: input.name,
    area: input.area,
    sector: clean(input.sector),
    location: input.location,
    productsMade: input.productsMade,
    productsNeeded: input.productsNeeded,
    photoCount: input.photos.length,
    status: 'approved',
    createdBy: ADMIN_UID,
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
  })
  const contact = contactPayload(input.contact)
  await runTransaction(fs, async (tx) => {
    const shard = await readShard(tx, fs)
    tx.set(doc(fs, `factories/${fid}`), data)
    if (Object.keys(contact).length > 0) tx.set(doc(fs, `factories/${fid}/private/contact`), contact)
    input.photos.forEach((p, i) => tx.set(doc(fs, `factories/${fid}/photos/${p.id}`), { data: p.data, order: i }))
    writeShard(tx, fs, shard, upsertEntry(shard.entries, entry))
  })
  return fid
}
