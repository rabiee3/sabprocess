import { collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore'
import { db } from '../firebase'
import { factoryConverter } from '../firebase/converters'
import { isSafeImage } from '../lib/safeImage'
import type { Factory } from '../lib/types'
import type { ContactDraft, PhotoData } from '../survey/types'

const denied = (e: unknown) => {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined
  return code === 'permission-denied' || code === 'firestore/permission-denied'
}

/** An approved factory, or null when it is missing or not public (the rules answer permission-denied). */
export async function loadPublicFactory(id: string, fs: Firestore = db): Promise<Factory | null> {
  try {
    const snap = await getDoc(doc(fs, `factories/${id}`).withConverter(factoryConverter))
    return snap.data() ?? null
  } catch (e) {
    if (denied(e)) return null
    throw e
  }
}

/** Photos in their stored order; anything that is not an inline jpeg/png/webp data URL is dropped. */
export async function loadPhotos(id: string, fs: Firestore = db): Promise<PhotoData[]> {
  const snap = await getDocs(collection(fs, `factories/${id}/photos`))
  return snap.docs
    .map((d) => ({ id: d.id as PhotoData['id'], data: d.data().data as string | undefined, order: Number(d.data().order) || 0 }))
    .filter((p): p is { id: PhotoData['id']; data: string; order: number } => isSafeImage(p.data))
    .sort((a, b) => a.order - b.order)
    .map(({ id: pid, data }) => ({ id: pid, data }))
}

/** Contact details; only signed-in Google users may read them (permission-denied gives null). */
export async function loadContact(id: string, fs: Firestore = db): Promise<ContactDraft | null> {
  try {
    const snap = await getDoc(doc(fs, `factories/${id}/private/contact`))
    return (snap.data() as ContactDraft | undefined) ?? {}
  } catch (e) {
    if (denied(e)) return null
    throw e
  }
}
