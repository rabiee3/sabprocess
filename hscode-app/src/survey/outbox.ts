import { safeStorage } from '../lib/safeStorage'
import type { SurveyErrorCode } from './repo'

const KEY = 'hscode.outbox'

export type OutboxEntry = { fid: string; savedAt: number; state: 'saved' | 'failed'; error?: SurveyErrorCode }

function read(): OutboxEntry[] {
  try {
    const parsed: unknown = JSON.parse(safeStorage.get(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is OutboxEntry =>
        !!e && typeof e.fid === 'string' && typeof e.savedAt === 'number' && (e.state === 'saved' || e.state === 'failed'),
    )
  } catch {
    return []
  }
}

const write = (list: OutboxEntry[]) => safeStorage.set(KEY, JSON.stringify(list))

export const outbox = {
  list: read,
  add(fid: string): void {
    write([...read().filter((e) => e.fid !== fid), { fid, savedAt: Date.now(), state: 'saved' }])
  },
  markFailed(fid: string, error: SurveyErrorCode): void {
    write(read().map((e): OutboxEntry => (e.fid === fid ? { ...e, state: 'failed', error } : e)))
  },
  remove(fid: string): void {
    write(read().filter((e) => e.fid !== fid))
  },
}
