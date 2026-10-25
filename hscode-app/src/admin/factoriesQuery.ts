import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { factoryConverter } from '../firebase/converters'
import { db } from '../firebase'
import type { Factory, FactoryStatus } from '../lib/types'

export const PAGE_SIZE = 50

export type FactoriesCursor = QueryDocumentSnapshot<Factory>
export type FactoriesPageResult = { rows: Factory[]; cursor: FactoriesCursor | null; hasMore: boolean }

/** One page of factories with a status, newest update first (composite index status ASC, updatedAt DESC). */
export async function fetchFactoriesPage(
  status: FactoryStatus,
  after: FactoriesCursor | null,
  fs: Firestore = db,
): Promise<FactoriesPageResult> {
  const base = [where('status', '==', status), orderBy('updatedAt', 'desc')] as const
  const col = collection(fs, 'factories').withConverter(factoryConverter)
  const snap = await getDocs(
    after ? query(col, ...base, startAfter(after), limit(PAGE_SIZE)) : query(col, ...base, limit(PAGE_SIZE)),
  )
  return {
    rows: snap.docs.map((d) => d.data()),
    cursor: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === PAGE_SIZE,
  }
}
