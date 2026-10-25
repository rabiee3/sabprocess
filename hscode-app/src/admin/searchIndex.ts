import type { IndexEntry } from '../lib/types'

/** Refuse an approve that would push the single index shard past this share of 1 MiB. */
export const INDEX_LIMIT = 0.97

export function upsertEntry(entries: IndexEntry[], e: IndexEntry): IndexEntry[] {
  return entries.some((x) => x.id === e.id) ? entries.map((x) => (x.id === e.id ? e : x)) : [...entries, e]
}

export const removeEntry = (entries: IndexEntry[], id: string): IndexEntry[] => entries.filter((x) => x.id !== id)

/** 0–1 share of the 1 MiB document limit used by the entries. */
export const indexFill = (entries: IndexEntry[]): number => JSON.stringify(entries).length / 1_048_576
