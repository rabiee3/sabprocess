import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {} }));
const server = vi.fn();
const cache = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (_fs: unknown, path: string) => ({ path }),
  getDocFromServer: (...a: unknown[]) => server(...a),
  getDocFromCache: (...a: unknown[]) => cache(...a),
}));

import { IndexError, loadIndex, resetIndexCache } from './indexSource';

const snap = (entries?: unknown[], version = 1) => ({ exists: () => !!entries, data: () => ({ entries, version }) });
const fsErr = (code: string, message = code) => Object.assign(new Error(message), { code });
const fs = {} as never;

beforeEach(() => {
  resetIndexCache();
  server.mockReset();
  // Default: nothing in the persistent cache (getDocFromCache throws on a miss).
  cache.mockReset().mockRejectedValue(fsErr('unavailable', 'Failed to get document from cache'));
});

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('loadIndex, cache first (stale-while-revalidate)', () => {
  it('resolves from the cache before the server responds', async () => {
    const pending = deferred<unknown>();
    server.mockReturnValue(pending.promise);
    cache.mockResolvedValue(snap([{ id: 'a' }], 1));
    expect(await loadIndex(fs)).toEqual({ entries: [{ id: 'a' }], fromCache: true });
    expect(server).toHaveBeenCalledTimes(1);
    pending.resolve(snap([{ id: 'a' }], 1));
  });

  it('calls onUpdate once with the server entries when the version differs', async () => {
    const pending = deferred<unknown>();
    server.mockReturnValue(pending.promise);
    cache.mockResolvedValue(snap([{ id: 'a' }], 1));
    const onUpdate = vi.fn();
    await loadIndex(fs, onUpdate);
    expect(onUpdate).not.toHaveBeenCalled();
    pending.resolve(snap([{ id: 'a' }, { id: 'b' }], 2));
    await flush();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ entries: [{ id: 'a' }, { id: 'b' }], fromCache: false });
    // The memo now holds the fresh index: a remount gets it without another read.
    expect(await loadIndex(fs)).toEqual({ entries: [{ id: 'a' }, { id: 'b' }], fromCache: false });
    expect(server).toHaveBeenCalledTimes(1);
  });

  it('does not call onUpdate when the server has the same version', async () => {
    server.mockResolvedValue(snap([{ id: 'a' }], 3));
    cache.mockResolvedValue(snap([{ id: 'a' }], 3));
    const onUpdate = vi.fn();
    const first = await loadIndex(fs, onUpdate);
    await flush();
    expect(onUpdate).not.toHaveBeenCalled();
    // Revalidated: the same entries (same array, so the engine is reused), no longer flagged as cached.
    const again = await loadIndex(fs);
    expect(again.entries).toBe(first.entries);
    expect(again.fromCache).toBe(false);
  });

  it('falls back to the server on a cache miss (no doc in the cache)', async () => {
    cache.mockResolvedValue(snap());
    server.mockResolvedValue(snap([{ id: 'a' }]));
    expect(await loadIndex(fs)).toEqual({ entries: [{ id: 'a' }], fromCache: false });
  });

  it('makes exactly one server read per session', async () => {
    server.mockResolvedValue(snap([{ id: 'a' }], 2));
    cache.mockResolvedValue(snap([{ id: 'a' }], 1));
    const onUpdate = vi.fn();
    await loadIndex(fs, onUpdate);
    await loadIndex(fs, onUpdate);
    await flush();
    await loadIndex(fs, onUpdate);
    await flush();
    expect(server).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached index and retries on the next call when the background read fails', async () => {
    server.mockRejectedValueOnce(fsErr('unavailable')).mockResolvedValueOnce(snap([{ id: 'b' }], 2));
    cache.mockResolvedValue(snap([{ id: 'a' }], 1));
    const onUpdate = vi.fn();
    expect(await loadIndex(fs, onUpdate)).toEqual({ entries: [{ id: 'a' }], fromCache: true });
    await flush();
    expect(onUpdate).not.toHaveBeenCalled();
    expect((await loadIndex(fs)).fromCache).toBe(true);
    await flush();
    expect(server).toHaveBeenCalledTimes(2);
  });
});

describe('loadIndex', () => {
  it('reads shard-0 from the server', async () => {
    server.mockResolvedValue(snap([{ id: 'a' }]));
    expect(await loadIndex(fs)).toEqual({ entries: [{ id: 'a' }], fromCache: false });
    expect(server.mock.calls[0][0]).toEqual({ path: 'searchIndex/shard-0' });
  });

  it('falls back to the cache', async () => {
    server.mockRejectedValue(fsErr('unavailable'));
    cache.mockResolvedValue(snap([{ id: 'a' }]));
    expect(await loadIndex(fs)).toEqual({ entries: [{ id: 'a' }], fromCache: true });
  });

  it('treats a missing doc as empty', async () => {
    server.mockResolvedValue(snap());
    expect(await loadIndex(fs)).toEqual({ entries: [], fromCache: false });
  });

  it.each([
    ['permission-denied', 'denied'],
    ['unauthenticated', 'denied'],
    ['app-check/token-error', 'denied'],
    ['unavailable', 'offline'],
    ['resource-exhausted', 'quota'],
    ['internal', 'generic'],
  ])('maps %s to %s when cache also fails', async (code, expected) => {
    server.mockRejectedValue(fsErr(code));
    cache.mockRejectedValue(fsErr('unavailable'));
    const err = await loadIndex(fs).catch((e) => e);
    expect(err).toBeInstanceOf(IndexError);
    expect(err.code).toBe(expected);
  });

  it('maps an app-check failure message to denied', async () => {
    server.mockRejectedValue(new Error('Firebase: AppCheck app-check/fetch-status-error'));
    cache.mockRejectedValue(fsErr('unavailable'));
    expect((await loadIndex(fs).catch((e) => e)).code).toBe('denied');
  });

  it('throws the mapped error when the cache has no doc after a server failure', async () => {
    server.mockRejectedValue(fsErr('permission-denied'));
    cache.mockResolvedValue(snap());
    const err = await loadIndex(fs).catch((e) => e);
    expect(err).toBeInstanceOf(IndexError);
    expect(err.code).toBe('denied');
  });

  it('is memoised across calls', async () => {
    server.mockResolvedValue(snap([]));
    await loadIndex(fs);
    await loadIndex(fs);
    expect(server).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure', async () => {
    server.mockRejectedValueOnce(fsErr('permission-denied')).mockResolvedValueOnce(snap([]));
    cache.mockRejectedValue(fsErr('unavailable'));
    await expect(loadIndex(fs)).rejects.toBeInstanceOf(IndexError);
    await new Promise((r) => setTimeout(r, 0));
    expect((await loadIndex(fs)).fromCache).toBe(false);
  });
});
