import { doc, getDocFromCache, getDocFromServer, type Firestore } from 'firebase/firestore';
import { db } from '../firebase';
import type { IndexEntry } from '../lib/types';
import { classifyFirestoreError, type FirestoreErrorKind } from '../lib/firestoreErrors';

export type IndexLoad = { entries: IndexEntry[]; fromCache: boolean };
export type IndexErrorCode = FirestoreErrorKind;

export class IndexError extends Error {
  code: IndexErrorCode;
  constructor(code: IndexErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'IndexError';
    this.code = code;
  }
}

type Shard = { entries?: IndexEntry[]; version?: unknown };
type Snap = { exists(): boolean; data(): unknown };

let memo: Promise<IndexLoad> | null = null;
// Callers waiting for the background revalidation of a cached index; each is told at most once.
let listeners = new Set<(load: IndexLoad) => void>();
// True once the memo holds a server-confirmed index: nothing left to update.
let settled = false;

export function resetIndexCache(): void {
  memo = null;
  listeners = new Set();
  settled = false;
}

const shardOf = (snap: Snap): Shard | undefined => (snap.exists() ? (snap.data() as Shard) : undefined);

// The only place that knows the index lives in a single shard.
async function readCache(fs: Firestore): Promise<Shard | undefined> {
  try {
    return shardOf(await getDocFromCache(doc(fs, 'searchIndex/shard-0')));
  } catch {
    return undefined; // not in the persistent cache (or no cache at all)
  }
}

async function readServer(fs: Firestore): Promise<Shard | undefined> {
  try {
    return shardOf(await getDocFromServer(doc(fs, 'searchIndex/shard-0')));
  } catch (err) {
    throw new IndexError(classifyFirestoreError(err), (err as Error)?.message);
  }
}

/**
 * Cache first (spec §8): a cached shard resolves at once, and the one server read of the session runs in the
 * background; when it brings a different `version`, `onUpdate` gets the fresh index. A cache miss reads the server.
 */
async function fetchIndex(fs: Firestore, self: () => boolean): Promise<IndexLoad> {
  const cached = await readCache(fs);
  if (!cached) {
    const fresh = await readServer(fs);
    return { entries: fresh?.entries ?? [], fromCache: false };
  }
  const stale: IndexLoad = { entries: cached.entries ?? [], fromCache: true };
  readServer(fs).then(
    (fresh) => {
      if (!self()) return;
      const changed = fresh?.version !== cached.version;
      const load: IndexLoad = changed ? { entries: fresh?.entries ?? [], fromCache: false } : { ...stale, fromCache: false };
      memo = Promise.resolve(load);
      settled = true;
      const notify = listeners;
      listeners = new Set();
      if (changed) notify.forEach((fn) => fn(load));
    },
    () => {
      // Offline or refused: keep showing the cached index; the next call retries the server.
      if (!self()) return;
      memo = null;
      listeners = new Set();
    },
  );
  return stale;
}

export function loadIndex(fs: Firestore = db, onUpdate?: (load: IndexLoad) => void): Promise<IndexLoad> {
  if (!memo) {
    settled = false;
    listeners = new Set();
    const p: Promise<IndexLoad> = fetchIndex(fs, () => memo === p).then((r) => {
      // Straight from the server: already fresh, no update will follow.
      if (!r.fromCache && memo === p) {
        settled = true;
        listeners = new Set();
      }
      return r;
    });
    memo = p;
    // A failure must not stick: let the next call retry.
    p.catch(() => {
      if (memo === p) memo = null;
    });
  }
  if (onUpdate && !settled) listeners.add(onUpdate);
  return memo;
}
