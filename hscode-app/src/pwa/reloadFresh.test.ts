import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reloadFresh, RELOAD_FALLBACK_MS } from './reloadFresh'

const reload = vi.fn()
const realLocation = window.location

type Listener = () => void
function fakeWorker(state: ServiceWorkerState = 'installed') {
  const listeners: Listener[] = []
  return {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((_: string, l: Listener) => void listeners.push(l)),
    fire(next: ServiceWorkerState) {
      this.state = next
      for (const l of listeners) l()
    },
  }
}
function fakeContainer(reg: unknown) {
  const listeners: Listener[] = []
  return {
    getRegistration: vi.fn(async () => reg),
    addEventListener: vi.fn((type: string, l: Listener) => {
      if (type === 'controllerchange') listeners.push(l)
    }),
    controllerchange: () => listeners.forEach((l) => l()),
  }
}
function setSw(value: unknown) {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value })
}

beforeEach(() => {
  reload.mockReset()
  Object.defineProperty(window, 'location', { value: { ...realLocation, reload }, configurable: true })
})
afterEach(() => {
  Object.defineProperty(window, 'location', { value: realLocation, configurable: true })
  delete (navigator as { serviceWorker?: unknown }).serviceWorker
  vi.useRealTimers()
})

describe('reloadFresh', () => {
  it('with an update already known (needRefresh), activates it through update() and does not reload by itself', async () => {
    vi.useFakeTimers()
    const update = vi.fn()
    await reloadFresh({ needRefresh: true, update })
    expect(update).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    // update() reloads once the new worker controls; if that never happens, a plain reload after ~3 s.
    vi.advanceTimersByTime(RELOAD_FALLBACK_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('without service worker support, reloads plainly', async () => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
    await reloadFresh()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('with no registration, reloads plainly', async () => {
    setSw(fakeContainer(undefined))
    await reloadFresh()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('checks for an update; with nothing waiting, reloads plainly', async () => {
    const reg = { update: vi.fn(async () => undefined), waiting: null, installing: null }
    setSw(fakeContainer(reg))
    await reloadFresh()
    expect(reg.update).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a worker waiting after update(): posts SKIP_WAITING and reloads on controllerchange, once', async () => {
    const waiting = fakeWorker('installed')
    const reg = { update: vi.fn(async () => undefined), waiting: null as unknown, installing: null }
    reg.update.mockImplementation(async () => {
      reg.waiting = waiting // found by this update() call
    })
    const sw = fakeContainer(reg)
    setSw(sw)
    vi.useFakeTimers()
    await reloadFresh()
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
    sw.controllerchange()
    expect(reload).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(RELOAD_FALLBACK_MS) // the fallback does not reload a second time
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a worker still installing: posts SKIP_WAITING once it is installed', async () => {
    const installing = fakeWorker('installing')
    const reg = { update: vi.fn(async () => undefined), waiting: null, installing }
    const sw = fakeContainer(reg)
    setSw(sw)
    await reloadFresh()
    expect(installing.postMessage).not.toHaveBeenCalled()
    installing.fire('installed')
    expect(installing.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    sw.controllerchange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('falls back to a plain reload after ~3 s if the new worker never takes control', async () => {
    vi.useFakeTimers()
    const reg = { update: vi.fn(async () => undefined), waiting: fakeWorker('installed'), installing: null }
    setSw(fakeContainer(reg))
    await reloadFresh()
    expect(reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(RELOAD_FALLBACK_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a failing update() (offline) still uses a waiting worker, or reloads plainly', async () => {
    const reg = { update: vi.fn(async () => Promise.reject(new Error('offline'))), waiting: null, installing: null }
    setSw(fakeContainer(reg))
    await reloadFresh()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a throwing getRegistration reloads plainly', async () => {
    setSw({ getRegistration: vi.fn(async () => Promise.reject(new Error('blocked'))), addEventListener: vi.fn() })
    await reloadFresh()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a hanging getRegistration still reloads after ~3 s', async () => {
    vi.useFakeTimers()
    setSw({ getRegistration: vi.fn(() => new Promise(() => {})), addEventListener: vi.fn() })
    void reloadFresh()
    await vi.advanceTimersByTimeAsync(RELOAD_FALLBACK_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
