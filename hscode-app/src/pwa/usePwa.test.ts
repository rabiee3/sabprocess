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
const IPAD_DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const IPAD_DESKTOP_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Safari/605.1.15'
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

  /** A Cache Storage stand-in: insertion-ordered keys, like the real one. */
  function fakeCache(seed: string[] = []) {
    const store = [...seed]
    return {
      store,
      put: vi.fn(async (u: string) => void store.push(u)),
      keys: vi.fn(async () => store.map((u) => new Request(u))),
      delete: vi.fn(async (r: Request) => {
        const i = store.indexOf(r.url)
        if (i >= 0) store.splice(i, 1)
        return i >= 0
      }),
    }
  }
  const TYPES: Record<string, string> = { js: 'text/javascript', css: 'text/css' }
  async function warm(cache: ReturnType<typeof fakeCache>, loaded: string[], fetchType = (u: string) => TYPES[u.split('.').pop()!]) {
    const open = vi.fn(async () => cache)
    // The entry is precached already: caches.match finds it, so it is not fetched again.
    const match = vi.fn(async (u: string) => (u.includes('/index-') ? new Response('') : undefined))
    const fetchMock = vi.fn(async (u: string) => new Response('x', { status: 200, headers: { 'content-type': fetchType(u) } }))
    vi.stubGlobal('caches', { open, match })
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({}) } })
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue(loaded.map((name) => ({ name })) as PerformanceEntry[])
    await load()
    return { open, match, fetchMock }
  }
  const cleanup = () => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
    vi.unstubAllGlobals()
  }
  const o = location.origin

  it('once the service worker is ready, adds the lazy chunks this page already loaded to app-chunks', async () => {
    const cache = fakeCache()
    try {
      const { open, match } = await warm(cache, [
        `${o}/hscode/assets/index-AAA.js`,
        `${o}/hscode/assets/MapHome-BBB.js`,
        `${o}/hscode/assets/MapHome-CCC.css`,
        `${o}/hscode/icons/icon-192.png`,
        'https://tile.openstreetmap.org/1/2/3.png',
        'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen',
      ])
      await vi.waitFor(() => expect(cache.store).toEqual([`${o}/hscode/assets/MapHome-BBB.js`, `${o}/hscode/assets/MapHome-CCC.css`]))
      expect(open).toHaveBeenCalledWith('app-chunks')
      // Hashed, immutable files: a Vary: Origin header must not hide a hit (module scripts send Origin).
      expect(match).toHaveBeenCalledWith(`${o}/hscode/assets/MapHome-BBB.js`, { ignoreVary: true })
    } finally {
      cleanup()
    }
  })

  it('never stores HTML under a chunk URL (an SPA rewrite answering a missing chunk with index.html)', async () => {
    const cache = fakeCache()
    try {
      const { fetchMock } = await warm(cache, [`${o}/hscode/assets/Gone-OLD.js`, `${o}/hscode/assets/MapHome-BBB.js`], (u) =>
        u.includes('Gone-') ? 'text/html; charset=utf-8' : 'application/javascript',
      )
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      await vi.waitFor(() => expect(cache.store).toEqual([`${o}/hscode/assets/MapHome-BBB.js`]))
    } finally {
      cleanup()
    }
  })

  it('keeps app-chunks within its 60-entry limit after warming, dropping the oldest entries', async () => {
    const old = Array.from({ length: 59 }, (_, i) => `${o}/hscode/assets/old-${i}.js`)
    const cache = fakeCache(old)
    try {
      await warm(cache, [`${o}/hscode/assets/A-1.js`, `${o}/hscode/assets/B-2.js`, `${o}/hscode/assets/C-3.js`])
      await vi.waitFor(() => expect(cache.store).toHaveLength(60))
      await vi.waitFor(() => expect(cache.store.slice(-3)).toEqual([`${o}/hscode/assets/A-1.js`, `${o}/hscode/assets/B-2.js`, `${o}/hscode/assets/C-3.js`]))
      expect(cache.store).not.toContain(old[0])
      expect(cache.store).not.toContain(old[1])
      expect(cache.store).toContain(old[2])
    } finally {
      cleanup()
    }
  })

  it('isIosSafari is true for iPhone Safari and false for Chrome on iPhone or Android', async () => {
    const { isIosSafari } = await load()
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true)
    expect(isIosSafari(IPHONE_CHROME)).toBe(false)
    expect(isIosSafari(ANDROID_CHROME)).toBe(false)
  })

  it('isIosSafari detects iPadOS Safari, which sends a desktop Mac UA, by MacIntel plus touch points', async () => {
    const { isIosSafari } = await load()
    expect(isIosSafari(IPAD_DESKTOP_SAFARI, false, 'MacIntel', 5)).toBe(true)
    // A real Mac (no touch) is not iOS.
    expect(isIosSafari(IPAD_DESKTOP_SAFARI, false, 'MacIntel', 0)).toBe(false)
    // Chrome on iPad with a desktop UA is not Safari.
    expect(isIosSafari(IPAD_DESKTOP_CHROME, false, 'MacIntel', 5)).toBe(false)
  })

  it('isIosSafari is false once installed (standalone), on iPhone or iPad', async () => {
    const { isIosSafari } = await load()
    expect(isIosSafari(IPHONE_SAFARI, true)).toBe(false)
    expect(isIosSafari(IPAD_DESKTOP_SAFARI, true, 'MacIntel', 5)).toBe(false)
  })

  it('the hook reports iPadOS Safari from navigator.platform and maxTouchPoints', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPAD_DESKTOP_SAFARI)
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 })
    try {
      const { usePwa } = await load()
      expect(renderHook(() => usePwa()).result.current.isIosSafari).toBe(true)
    } finally {
      delete (navigator as { maxTouchPoints?: number }).maxTouchPoints
    }
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
