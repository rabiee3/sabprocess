import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { APP_CHUNKS_CACHE, APP_CHUNKS_MAX, isCacheableAsset } from './cacheNames'

/** Chromium's install prompt event (not in lib.dom). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type PwaState = { needRefresh: boolean; canInstall: boolean }

export type Pwa = PwaState & {
  /** Activates the waiting service worker; the page reloads once it controls. Never automatic. */
  update: () => void
  install: () => Promise<void>
  isIosSafari: boolean
}

/**
 * iPhone/iPad Safari, where "Add to Home Screen" is manual (no beforeinstallprompt). Other iOS browsers
 * (Chrome, Firefox, Edge) cannot add web apps the same way, so they get no hint; nor does the installed app.
 * iPadOS 13+ Safari sends a desktop Mac UA: it is told apart from a Mac by platform MacIntel plus touch.
 */
export function isIosSafari(ua: string, standalone = false, platform = '', maxTouchPoints = 0): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)
  return ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) && !standalone
}

// Module-level singleton: one registration and one captured install prompt, shared by every caller
// (UpdateBanner, the ☰ menu, the surveyor home).
let state: PwaState = { needRefresh: false, canInstall: false }
let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function set(next: Partial<PwaState>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

let updateSW: (reloadPage?: boolean) => Promise<void> = async () => {}

/**
 * The first visit loads its route chunks before the service worker exists, so the runtime route never saw
 * them. Once it is ready, put what this page already loaded from /hscode/assets/ (and is not precached)
 * into the runtime cache, so the visited route opens offline too.
 */
async function cacheLoadedChunks() {
  const prefix = `${location.origin}/hscode/assets/`
  const urls = [...new Set(performance.getEntriesByType('resource').map((e) => e.name))].filter((u) => u.startsWith(prefix))
  const cache = await caches.open(APP_CHUNKS_CACHE)
  for (const url of urls) {
    if (await caches.match(url, { ignoreVary: true })) continue
    try {
      const res = await fetch(url)
      // Never HTML under a chunk URL (an SPA rewrite of a missing chunk), only the right type.
      if (isCacheableAsset(new URL(url).pathname, res.status, res.headers.get('content-type'))) await cache.put(url, res)
    } catch {
      // offline or blocked: the next visit fills it through the service worker
    }
  }
  // These writes bypass the service worker's ExpirationPlugin: keep the same 60-entry bound here,
  // dropping the oldest (Cache Storage keys are in insertion order).
  const keys = await cache.keys()
  for (const old of keys.slice(0, Math.max(0, keys.length - APP_CHUNKS_MAX))) await cache.delete(old)
}

if (typeof window !== 'undefined') {
  // virtual:pwa-register is a no-op in dev and emulator builds (the plugin is disabled there).
  updateSW = registerSW({ immediate: true, onNeedRefresh: () => set({ needRefresh: true }) })
  // Never resolves in dev or emulator builds: no service worker is registered there.
  if ('serviceWorker' in navigator && 'caches' in window) {
    navigator.serviceWorker.ready.then(cacheLoadedChunks).catch(() => undefined)
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // keep it for our own Install button instead of the mini-infobar
    deferred = e as InstallPromptEvent
    set({ canInstall: true })
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    set({ canInstall: false })
  })
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
const getSnapshot = () => state

function update() {
  void updateSW(true)
}

async function install() {
  const e = deferred
  if (!e) return
  // The event can be prompted only once, whatever the outcome.
  deferred = null
  set({ canInstall: false })
  await e.prompt()
  await e.userChoice.catch(() => undefined)
}

const iosSafari = () =>
  typeof navigator !== 'undefined' &&
  isIosSafari(
    navigator.userAgent,
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
    navigator.platform,
    navigator.maxTouchPoints ?? 0,
  )

export function usePwa(): Pwa {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { ...s, update, install, isIosSafari: iosSafari() }
}
