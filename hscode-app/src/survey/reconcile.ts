import { clearDraft, loadDraft } from './draft'
import { outbox, type OutboxEntry } from './outbox'
import type { SubmissionItem } from './repo'

/** How far the device clock may run ahead of the server before a confirmed write looks stale. */
export const SKEW_MS = 5 * 60 * 1000

/**
 * Matches this user's outbox against a My-submissions snapshot and returns the updated entries.
 * - New factory whose doc the server confirmed (no pending write): entry done, its draft dropped. No clock comparison.
 * - Edit: same, but only when the doc's updatedAt is at or after the submit (within SKEW_MS).
 * - Edit confirmed but older than the submit: the write never landed (e.g. rejected while the app was closed) → failed 'rejected'.
 * - Doc missing from a server snapshot: the create never landed → failed 'generic'. Cache-only snapshots prove nothing.
 * Drafts of approved factories are dropped too (they can't be edited any more).
 */
export function reconcile(uid: string, items: SubmissionItem[], fromCache: boolean): OutboxEntry[] {
  const byId = new Map(items.map((i) => [i.factory.id, i]))
  for (const e of outbox.list(uid)) {
    const hit = byId.get(e.fid)
    // Entries from before kinds existed may be edits: the stored draft says which.
    const kind = e.kind ?? (loadDraft(uid, e.fid)?.mode === 'edit' ? 'edit' : 'new')
    if (hit && !hit.pendingWrite) {
      // A new factory is proven by its doc alone (no clock involved); only an edit needs the clock check.
      // A failed new entry is never auto-confirmed: its doc is an earlier, rejected attempt, and the user
      // still has a draft to resume.
      if (kind === 'new' && e.state === 'failed') continue
      if (kind === 'new' || hit.factory.updatedAt.getTime() >= e.submittedAt - SKEW_MS) {
        outbox.remove(uid, e.fid)
        clearDraft(uid, e.fid)
      } else if (e.state === 'saved') {
        outbox.markFailed(uid, e.fid, 'rejected')
      }
    } else if (!hit && !fromCache && e.state === 'saved') {
      outbox.markFailed(uid, e.fid, 'generic')
    }
  }
  for (const { factory, pendingWrite } of items) {
    if (!pendingWrite && factory.status === 'approved') clearDraft(uid, factory.id)
  }
  return outbox.list(uid)
}
