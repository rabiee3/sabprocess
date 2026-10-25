import { doc, getDocFromCache, getDocFromServer, type Firestore } from 'firebase/firestore';
import { db } from '../firebase';
import type { IndexEntry } from '../lib/types';

export type IndexLoad = { entries: IndexEntry[]; fromCache: boolean };
export type IndexErrorCode = 'offline' | 'denied' | 'quota' | 'generic';

export class IndexError extends Error {
  code: IndexErrorCode;
  constructor(code: IndexErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'IndexError';
    this.code = code;
  }
}

export function classifyError(err: unknown): IndexErrorCode {
  const code = String((err as { code?: unknown })?.code ?? '');
  const msg = String((err as { message?: unknown })?.message ?? '');
  if (code === 'resource-exhausted') return 'quota';
  if (
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    code.startsWith('app-check') ||
    /app-check/i.test(msg)
  ) {
    return 'denied';
  }
  if (code === 'unavailable' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return 'offline';
  }
  return 'generic';
}

let memo: Promise<IndexLoad> | null = null;

export function resetIndexCache(): void {
  memo = null;
}

// The only place that knows the index lives in a single shard.
async function fetchIndex(fs: Firestore): Promise<IndexLoad> {
  const ref = doc(fs, 'searchIndex/shard-0');
  let fromCache = false;
  let snap;
  try {
    snap = await getDocFromServer(ref);
  } catch (serverErr) {
    try {
      snap = await getDocFromCache(ref);
      fromCache = true;
    } catch {
      throw new IndexError(classifyError(serverErr), (serverErr as Error)?.message);
    }
  }
  const data = snap.exists() ? (snap.data() as { entries?: IndexEntry[] }) : undefined;
  return { entries: data?.entries ?? [], fromCache };
}

export function loadIndex(fs: Firestore = db): Promise<IndexLoad> {
  if (!memo) {
    const p = fetchIndex(fs);
    memo = p;
    // A failure must not stick: let the next call retry.
    p.catch(() => {
      if (memo === p) memo = null;
    });
  }
  return memo;
}
