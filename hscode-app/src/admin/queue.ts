import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { factoryConverter } from '../firebase/converters'
import { db } from '../firebase'
import type { Factory } from '../lib/types'

/** Live pending submissions, oldest first (composite index status ASC, createdAt ASC). */
export function subscribeQueue(
  cb: (rows: Factory[]) => void,
  onError: (e: unknown) => void,
  fs: Firestore = db,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(fs, 'factories').withConverter(factoryConverter),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
    ),
    (snap) => cb(snap.docs.map((d) => d.data())),
    onError,
  )
}
