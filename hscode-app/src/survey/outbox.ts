import { safeStorage } from '../lib/safeStorage'
import type { SurveyErrorCode } from './repo'

/** Pre-scoping key (one outbox for every account on the phone); dropped on first read. */
const LEGACY_KEY = 'hscode.outbox'
const keyOf = (uid: string) => `${LEGACY_KEY}.${uid}`

/** submittedAt: device time of the submit tap; reconcile compares it with the server's updatedAt. */
export type OutboxEntry = { fid: string; savedAt: number; submittedAt: number; state: 'saved' | 'failed'; error?: SurveyErrorCode }

function read(uid: string): OutboxEntry[] {
  if (safeStorage.get(LEGACY_KEY) !== null) safeStorage.remove(LEGACY_KEY)
  try {
    const parsed: unknown = JSON.parse(safeStorage.get(keyOf(uid)) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (e): e is OutboxEntry =>
          !!e && typeof e.fid === 'string' && typeof e.savedAt === 'number' && (e.state === 'saved' || e.state === 'failed'),
      )
      .map((e) => (typeof e.submittedAt === 'number' ? e : { ...e, submittedAt: e.savedAt }))
  } catch {
    return []
  }
}

const write = (uid: string, list: OutboxEntry[]): boolean => safeStorage.set(keyOf(uid), JSON.stringify(list))

/** One outbox per signed-in user. Writes return false when storage did not accept them. */
export const outbox = {
  list: read,
  add(uid: string, fid: string): boolean {
    const now = Date.now()
    return write(uid, [...read(uid).filter((e) => e.fid !== fid), { fid, savedAt: now, submittedAt: now, state: 'saved' }])
  },
  markFailed(uid: string, fid: string, error: SurveyErrorCode): boolean {
    return write(uid, read(uid).map((e): OutboxEntry => (e.fid === fid ? { ...e, state: 'failed', error } : e)))
  },
  remove(uid: string, fid: string): boolean {
    return write(uid, read(uid).filter((e) => e.fid !== fid))
  },
}
