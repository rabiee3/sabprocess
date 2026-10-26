import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
// Importing ./app first guarantees App Check is set up before Firestore starts.
import { app, useEmulator } from './app'
import { chooseLocalCache, storageWritable } from './localCache'

// Never import this module statically from the entry graph (main.tsx, AuthProvider, App, router):
// it pulls in firebase/firestore. Lazy route chunks and the lazily loaded role watcher use it.
export const db = initializeFirestore(app, {
  // Optional fields left `undefined` are dropped instead of failing the whole write.
  ignoreUndefinedProperties: true,
  // No IndexedDB (jsdom unit tests, Node) or localStorage that throws (blocked site data): in-memory cache.
  localCache:
    chooseLocalCache({ hasIndexedDb: typeof indexedDB !== 'undefined', storageWritable: storageWritable() }) === 'persistent'
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
})

if (useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080)
