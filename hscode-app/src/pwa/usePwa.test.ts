import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const reg = vi.hoisted(() => ({
  options: undefined as undefined | { immediate?: boolean; onNeedRefresh?: () => void },
  updateSW: vi.fn(async () => {}),
  calls: 0,
}))
vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: typeof reg.options) => {
    reg.calls += 1
    reg.options = options
    return reg.updateSW
  },
}))

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

/** A fresh module per test: the registration and the captured prompt are module-level singletons. */
async function load() {
  vi.resetModules()
  return import('./usePwa')
}

function fireInstallPrompt() {
  const prompt = vi.fn(async () => {})
  const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  })
  act(() => {
    window.dispatchEvent(e)
  })
  return { prompt, e }
}

describe('usePwa', () => {
  beforeEach(() => {
    reg.options = undefined
    reg.calls = 0
    reg.updateSW.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('registers the service worker once, immediately, however many components use it', async () => {
    const { usePwa } = await load()
    renderHook(() => usePwa())
    renderHook(() => usePwa())
    expect(reg.calls).toBe(1)
    expect(reg.options?.immediate).toBe(true)
  })

  it('onNeedRefresh sets needRefresh; update() calls updateSW(true) and never reloads by itself', async () => {
    const { usePwa } = await load()
    const { result } = renderHook(() => usePwa())
    expect(result.current.needRefresh).toBe(false)
    act(() => reg.options?.onNeedRefresh?.())
    expect(result.current.needRefresh).toBe(true)
    expect(reg.updateSW).not.toHaveBeenCalled()
    act(() => result.current.update())
    expect(reg.updateSW).toHaveBeenCalledWith(true)
  })

  it('a beforeinstallprompt event sets canInstall; install() calls prompt() and then clears it', async () => {
    const { usePwa } = await load()
    const { result } = renderHook(() => usePwa())
    expect(result.current.canInstall).toBe(false)
    const { prompt, e } = fireInstallPrompt()
    expect(e.defaultPrevented).toBe(true)
    expect(result.current.canInstall).toBe(true)
    await act(() => result.current.install())
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(result.current.canInstall).toBe(false)
  })

  it('captures beforeinstallprompt fired before any component mounted', async () => {
    const { usePwa } = await load()
    fireInstallPrompt()
    const { result } = renderHook(() => usePwa())
    expect(result.current.canInstall).toBe(true)
  })

  it('appinstalled clears canInstall', async () => {
    const { usePwa } = await load()
    const { result } = renderHook(() => usePwa())
    fireInstallPrompt()
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current.canInstall).toBe(false)
  })

  it('once the service worker is ready, adds the lazy chunks this page already loaded to app-chunks', async () => {
    const added: string[] = []
    const cache = { add: vi.fn(async (u: string) => void added.push(u)) }
    const open = vi.fn(async () => cache)
    // The entry is precached already: caches.match finds it, so it is not added twice.
    const match = vi.fn(async (u: string) => (u.includes('/index-') ? new Response('') : undefined))
    vi.stubGlobal('caches', { open, match })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({}) } })
    const o = location.origin
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { name: `${o}/hscode/assets/index-AAA.js` },
      { name: `${o}/hscode/assets/MapHome-BBB.js` },
      { name: `${o}/hscode/assets/MapHome-CCC.css` },
      { name: `${o}/hscode/icons/icon-192.png` },
      { name: 'https://tile.openstreetmap.org/1/2/3.png' },
      { name: 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen' },
    ] as PerformanceEntry[])
    try {
      await load()
      await vi.waitFor(() => expect(added).toEqual([`${o}/hscode/assets/MapHome-BBB.js`, `${o}/hscode/assets/MapHome-CCC.css`]))
      expect(open).toHaveBeenCalledWith('app-chunks')
      // Hashed, immutable files: a Vary: Origin header must not hide a hit (module scripts send Origin).
      expect(match).toHaveBeenCalledWith(`${o}/hscode/assets/MapHome-BBB.js`, { ignoreVary: true })
    } finally {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker
      vi.unstubAllGlobals()
    }
  })

  it('isIosSafari is true for iPhone Safari and false for Chrome on iPhone or Android', async () => {
    const { isIosSafari } = await load()
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true)
    expect(isIosSafari(IPHONE_CHROME)).toBe(false)
    expect(isIosSafari(ANDROID_CHROME)).toBe(false)
  })

  it('the hook reports isIosSafari from the browser user agent', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_SAFARI)
    const { usePwa } = await load()
    expect(renderHook(() => usePwa()).result.current.isIosSafari).toBe(true)
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID_CHROME)
    const again = await load()
    expect(renderHook(() => again.usePwa()).result.current.isIosSafari).toBe(false)
  })
})
