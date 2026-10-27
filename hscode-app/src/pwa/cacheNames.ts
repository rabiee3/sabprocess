/**
 * The runtime cache for lazy route chunks and their assets under /hscode/assets/ (StaleWhileRevalidate in
 * the service worker; see vite.config.ts). The page fills it too, with the chunks it loaded before the
 * service worker took over (usePwa), so the first visit's route opens offline.
 */
export const APP_CHUNKS_CACHE = 'app-chunks'
export const APP_CHUNKS_MAX = 60

/**
 * Whether a response may be cached under an /hscode/assets/ URL: a 200 whose content-type fits the file
 * (JavaScript for .js, CSS for .css) and is never HTML. An SPA rewrite answering a missing chunk with
 * index.html must not land in the cache. The service worker's cacheWillUpdate plugin (vite.config.ts)
 * repeats this check inline, because Workbox serialises it into sw.js.
 */
export function isCacheableAsset(pathname: string, status: number, contentType: string | null): boolean {
  const ct = (contentType ?? '').toLowerCase()
  if (status !== 200 || ct.includes('text/html')) return false
  if (pathname.endsWith('.js')) return ct.includes('javascript')
  if (pathname.endsWith('.css')) return ct.includes('text/css')
  return true
}
