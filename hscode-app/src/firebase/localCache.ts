import { safeStorage } from '../lib/safeStorage'

const PROBE_KEY = 'hscode.storageProbe'

/**
 * Can this page write localStorage? Firestore's multi-tab manager writes it without a try/catch and does
 * not fall back on SecurityError (Safari with site data blocked, enterprise policies), so every read would fail.
 */
export function storageWritable(): boolean {
  const ok = safeStorage.set(PROBE_KEY, '1')
  safeStorage.remove(PROBE_KEY)
  return ok
}

/** Persistent multi-tab cache only when both IndexedDB and localStorage work; memory is always safe. */
export function chooseLocalCache(env: { hasIndexedDb: boolean; storageWritable: boolean }): 'persistent' | 'memory' {
  return env.hasIndexedDb && env.storageWritable ? 'persistent' : 'memory'
}
