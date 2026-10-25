import { collection, doc, getCountFromServer, getDoc, query, where, type Firestore } from 'firebase/firestore'
import { db } from '../firebase'
import { areas } from '../data'
import type { FactoryStatus, IndexEntry } from '../lib/types'
import { indexFill } from './searchIndex'

/** A count that could not be loaded is null (shown as "—"). */
export type Count = number | null

export const STATUSES: FactoryStatus[] = ['pending', 'approved', 'rejected', 'hidden']

export type AreaCount = { area: string; approved: Count; pending: Count }

export type Stats = {
  byStatus: Record<FactoryStatus, Count>
  byArea: AreaCount[]
  /** 0–1 share of the index shard; null when it could not be read. */
  indexFill: number | null
}

async function count(fs: Firestore, ...conds: ReturnType<typeof where>[]): Promise<Count> {
  try {
    return (await getCountFromServer(query(collection(fs, 'factories'), ...conds))).data().count
  } catch {
    return null
  }
}

async function readFill(fs: Firestore): Promise<number | null> {
  try {
    const snap = await getDoc(doc(fs, 'searchIndex/shard-0'))
    const entries = (snap.exists() ? snap.data().entries : []) as IndexEntry[] | undefined
    return indexFill(entries ?? [])
  } catch {
    return null
  }
}

/** All dashboard figures, loaded in parallel; each failed figure is null rather than failing the lot. */
export async function loadStats(fs: Firestore = db): Promise<Stats> {
  const ids = areas().map((a) => a.id)
  const [statusCounts, areaCounts, fill] = await Promise.all([
    Promise.all(STATUSES.map((s) => count(fs, where('status', '==', s)))),
    Promise.all(
      ids.map(async (area) => {
        const [approved, pending] = await Promise.all([
          count(fs, where('area', '==', area), where('status', '==', 'approved')),
          count(fs, where('area', '==', area), where('status', '==', 'pending')),
        ])
        return { area, approved, pending }
      }),
    ),
    readFill(fs),
  ])
  return {
    byStatus: Object.fromEntries(STATUSES.map((s, i) => [s, statusCounts[i]])) as Stats['byStatus'],
    byArea: areaCounts,
    indexFill: fill,
  }
}
