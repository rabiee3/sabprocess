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

const snap = (entries?: unknown[]) => ({ exists: () => !!entries, data: () => ({ entries }) });
const fsErr = (code: string, message = code) => Object.assign(new Error(message), { code });
const fs = {} as never;

beforeEach(() => {
  resetIndexCache();
  server.mockReset();
  cache.mockReset();
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

  it('does not memoise a cache-only result', async () => {
    server.mockRejectedValueOnce(fsErr('unavailable')).mockResolvedValueOnce(snap([{ id: 'b' }]));
    cache.mockResolvedValue(snap([{ id: 'a' }]));
    expect((await loadIndex(fs)).fromCache).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(await loadIndex(fs)).toEqual({ entries: [{ id: 'b' }], fromCache: false });
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
