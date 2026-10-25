import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore'
import { db } from '../firebase'
import type { FactoryInput } from '../survey/types'
import { DEMO_FACTORIES } from './demoFactories'
import { adminCreateFactory, deleteFactory } from './repo'

export type Progress = (done: number, total: number) => void

const sampleDocs = (fs: Firestore) => getDocs(query(collection(fs, 'factories'), where('sample', '==', true)))

/**
 * Creates the bundled demo factories (one transaction each). Idempotent: a demo factory whose English
 * name already belongs to a `sample` factory is skipped. Stops at the first error.
 */
export async function loadDemoFactories(
  data: FactoryInput[] = DEMO_FACTORIES,
  onProgress?: Progress,
  fs: Firestore = db,
): Promise<{ added: number; skipped: number }> {
  const existing = new Set((await sampleDocs(fs)).docs.map((d) => (d.data().name as { en?: string } | undefined)?.en))
  let added = 0
  let skipped = 0
  for (const input of data) {
    if (existing.has(input.name.en)) skipped += 1
    else {
      await adminCreateFactory(input, { sample: true }, fs)
      added += 1
    }
    onProgress?.(added + skipped, data.length)
  }
  return { added, skipped }
}

/** Permanently deletes every factory flagged `sample` (with its photos, contact and index entry). */
export async function removeDemoFactories(onProgress?: Progress, fs: Firestore = db): Promise<{ removed: number }> {
  const docs = (await sampleDocs(fs)).docs
  let removed = 0
  for (const d of docs) {
    await deleteFactory(d.id, fs)
    removed += 1
    onProgress?.(removed, docs.length)
  }
  return { removed }
}
