/**
 * The runtime cache for lazy route chunks and their assets under /hscode/assets/ (StaleWhileRevalidate in
 * the service worker; see vite.config.ts). The page fills it too, with the chunks it loaded before the
 * service worker took over (usePwa), so the first visit's route opens offline.
 */
export const APP_CHUNKS_CACHE = 'app-chunks'
