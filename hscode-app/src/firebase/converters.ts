import {
  Timestamp,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from 'firebase/firestore'
import type { Factory } from '../lib/types'

const toDate = (v: unknown): Date | undefined =>
  v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : undefined

/** Read-only converter; writes use explicit payloads built in survey/repo.ts. */
export const factoryConverter: FirestoreDataConverter<Factory> = {
  toFirestore(): DocumentData {
    throw new Error('factoryConverter is read-only')
  },
  fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): Factory {
    // 'estimate' turns a not-yet-committed serverTimestamp() into a local time.
    const d = snap.data({ ...options, serverTimestamps: 'estimate' })
    const f: Factory = {
      id: snap.id,
      name: d.name,
      area: d.area,
      location: d.location,
      productsMade: d.productsMade ?? [],
      productsNeeded: d.productsNeeded ?? [],
      photoCount: d.photoCount ?? 0,
      status: d.status,
      createdBy: d.createdBy,
      createdAt: toDate(d.createdAt) ?? new Date(),
      updatedAt: toDate(d.updatedAt) ?? new Date(),
    }
    if (d.areaOther !== undefined) f.areaOther = d.areaOther
    if (d.address !== undefined) f.address = d.address
    if (d.sector !== undefined) f.sector = d.sector
    if (d.thumb !== undefined) f.thumb = d.thumb
    if (d.rejectReason !== undefined) f.rejectReason = d.rejectReason
    const approvedAt = toDate(d.approvedAt)
    if (approvedAt) f.approvedAt = approvedAt
    if (d.sample !== undefined) f.sample = d.sample
    return f
  },
}
