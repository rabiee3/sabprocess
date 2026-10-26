import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

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
 */
export function isIosSafari(ua: string, standalone = false): boolean {
  return /iPhone|iPad|iPod/.test(ua) && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) && !standalone
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

if (typeof window !== 'undefined') {
  // virtual:pwa-register is a no-op in dev and emulator builds (the plugin is disabled there).
  updateSW = registerSW({ immediate: true, onNeedRefresh: () => set({ needRefresh: true }) })
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
  isIosSafari(navigator.userAgent, (navigator as Navigator & { standalone?: boolean }).standalone === true)

export function usePwa(): Pwa {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { ...s, update, install, isIosSafari: iosSafari() }
}
