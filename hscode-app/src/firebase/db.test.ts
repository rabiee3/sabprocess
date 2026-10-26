import { afterEach, describe, expect, it, vi } from 'vitest'

const persistentLocalCache = vi.fn(() => ({ kind: 'persistent' }))
const memoryLocalCache = vi.fn(() => ({ kind: 'memory' }))
const initializeFirestore = vi.fn((_app: unknown, settings: unknown) => ({ settings }))
vi.mock('firebase/firestore', () => ({
  connectFirestoreEmulator: vi.fn(),
  initializeFirestore: (a: unknown, s: unknown) => initializeFirestore(a, s),
  memoryLocalCache: () => memoryLocalCache(),
  persistentLocalCache: () => persistentLocalCache(),
  persistentMultipleTabManager: vi.fn(),
}))
vi.mock('./app', () => ({ app: {}, useEmulator: false }))

const writable = vi.fn<() => boolean>()
vi.mock('./localCache', async (orig) => ({
  ...(await orig<typeof import('./localCache')>()),
  storageWritable: () => writable(),
}))

async function cacheUsed(opts: { indexedDb: boolean; storage: boolean }) {
  vi.resetModules()
  initializeFirestore.mockClear()
  writable.mockReturnValue(opts.storage)
  if (opts.indexedDb) vi.stubGlobal('indexedDB', {})
  await import('./db')
  return (initializeFirestore.mock.calls[0][1] as { localCache: { kind: string } }).localCache.kind
}

describe('db local cache', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the persistent multi-tab cache when storage works', async () => {
    expect(await cacheUsed({ indexedDb: true, storage: true })).toBe('persistent')
  })
  it('falls back to memory when localStorage throws, so reads still work', async () => {
    expect(await cacheUsed({ indexedDb: true, storage: false })).toBe('memory')
  })
  it('uses memory without IndexedDB', async () => {
    expect(await cacheUsed({ indexedDb: false, storage: true })).toBe('memory')
  })
})
