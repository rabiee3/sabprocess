import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/db'

// Loaded with a dynamic import() from AuthProvider only when someone is signed in, so signed-out visitors
// never pull firebase/firestore through the entry chunk.

export { ensureUserDoc } from './api'

export interface UserDocSnap {
  data: () => { role?: unknown; active?: unknown } | undefined
  metadata?: { hasPendingWrites: boolean }
}

/** Watches users/{uid}, including metadata-only changes (the server's ack of a claim changes no data). */
export function watchUserDoc(uid: string, next: (snap: UserDocSnap) => void, error: () => void): () => void {
  return onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, next, error)
}
