import { collection, getDocs, limit, orderBy, query, runTransaction, startAfter, where, type Firestore, type QueryDocumentSnapshot } from 'firebase/firestore'
import { factoryConverter } from '../firebase/converters'
import { db } from '../firebase'
import { toIndexEntry } from '../lib/indexEntry'
import type { Factory, IndexEntry } from '../lib/types'
import { AdminError, readShard, writeShard } from './repo'
import { INDEX_LIMIT, indexFill } from './searchIndex'

const PAGE = 500

/**
 * Rebuilds searchIndex/shard-0 from every approved factory (replacing the entries).
 * The factories are read outside the transaction, so an approve that lands during a rebuild
 * could be overwritten. Acceptable: admin-only and rare; running the rebuild again fixes it.
 */
export async function rebuildSearchIndex(fs: Firestore = db): Promise<{ count: number }> {
  const entries: IndexEntry[] = []
  let last: QueryDocumentSnapshot<Factory> | undefined
  for (;;) {
    const base = [where('status', '==', 'approved'), orderBy('__name__'), limit(PAGE)] as const
    const q = query(collection(fs, 'factories').withConverter(factoryConverter), ...base, ...(last ? [startAfter(last)] : []))
    const page = await getDocs(q)
    for (const d of page.docs) entries.push(toIndexEntry(d.data()))
    if (page.size < PAGE) break
    last = page.docs[page.docs.length - 1]
  }
  if (indexFill(entries) > INDEX_LIMIT) throw new AdminError('indexFull')
  await runTransaction(fs, async (tx) => {
    const shard = await readShard(tx, fs)
    writeShard(tx, fs, shard, entries)
  })
  return { count: entries.length }
}
