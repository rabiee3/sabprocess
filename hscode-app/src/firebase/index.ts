import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { EMULATOR_PROJECT_ID, firebaseConfig } from './config'

export const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'

export const app = initializeApp(
  useEmulator ? { ...firebaseConfig, projectId: EMULATOR_PROJECT_ID } : firebaseConfig,
)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

export const auth = getAuth(app)

if (useEmulator) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
} else if (typeof window !== 'undefined') {
  // Analytics is lazy and never runs in emulator mode or unsupported environments (e.g. jsdom).
  void import('firebase/analytics').then(async ({ getAnalytics, isSupported }) => {
    if (await isSupported()) getAnalytics(app)
  })
}
