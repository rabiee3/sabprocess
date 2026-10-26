import type { PhotoData } from '../survey/types'
import type { loadPublicFactory } from './publicRepo'

/** What loadPublicFactory returns for a factory the reader can see: `{ factory, isPublic }`. */
export type LoadedFactory = NonNullable<Awaited<ReturnType<typeof loadPublicFactory>>>
/** `photos` is null until they have loaded once. */
export type CachedFactory = { load: LoadedFactory; photos: PhotoData[] | null }

// Session cache for factory pages (spec §8, P4 M5): in memory only, so a reload starts fresh. A missing factory
// or a failed photo read is never stored, and contacts never come here (they are read from the server each time).
const cache = new Map<string, CachedFactory>()

export function getCached(id: string): CachedFactory | undefined {
  return cache.get(id)
}

export function setCached(id: string, entry: CachedFactory): void {
  cache.set(id, entry)
}

export function clearFactoryCache(): void {
  cache.clear()
}
