import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
// Importing ./app first guarantees App Check is set up before Firestore starts.
import { app, useEmulator } from './app'

// Never import this module statically from the entry graph (main.tsx, AuthProvider, App, router):
// it pulls in firebase/firestore. Lazy route chunks and the lazily loaded role watcher use it.
export const db = initializeFirestore(app, {
  // Optional fields left `undefined` are dropped instead of failing the whole write.
  ignoreUndefinedProperties: true,
  // No IndexedDB (jsdom unit tests, Node): fall back to the in-memory cache.
  localCache:
    typeof indexedDB === 'undefined'
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080)
