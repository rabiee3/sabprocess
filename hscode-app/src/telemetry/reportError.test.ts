import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const appState = { useEmulator: false }
const log = vi.fn()
const loadAnalytics = vi.fn(async () => log)
vi.mock('../firebase/app', () => ({
  get useEmulator() {
    return appState.useEmulator
  },
  loadAnalytics: () => loadAnalytics(),
}))

type Mod = typeof import('./reportError')
let mod: Mod

beforeEach(async () => {
  appState.useEmulator = false
  log.mockReset()
  loadAnalytics.mockClear()
  vi.resetModules()
  mod = await import('./reportError')
})

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('describeError', () => {
  it('prefixes the place and keeps a plain message', () => {
    expect(mod.describeError(new Error('Map failed'), 'route')).toBe('route: Map failed')
    expect(mod.describeError('just text', 'window')).toBe('window: just text')
    expect(mod.describeError({ message: 'obj' }, 'promise')).toBe('promise: obj')
    expect(mod.describeError(undefined, 'promise')).toBe('promise: unknown')
  })

  it('strips emails', () => {
    expect(mod.describeError(new Error('no user someone.x+1@mail.example.com here'), 'r')).toBe('r: no user [email] here')
  })

  it('strips digit runs of 6 or more (phone numbers) but keeps HS codes of 4 or 5 digits', () => {
    expect(mod.describeError(new Error('call 01012345678 about 8471 and 39172'), 'r')).toBe('r: call [n] about 8471 and 39172')
    expect(mod.describeError(new Error('+20 1012345678'), 'r')).toBe('r: +20 [n]')
  })

  it('strips URL query strings', () => {
    expect(mod.describeError(new Error('GET https://x.example/a/b?token=abc&u=me failed'), 'r')).toBe(
      'r: GET https://x.example/a/b failed',
    )
  })

  it('truncates to 100 characters', () => {
    const d = mod.describeError(new Error('x'.repeat(300)), 'route')
    expect(d).toHaveLength(100)
    expect(d.startsWith('route: xxx')).toBe(true)
  })
})

describe('reportError', () => {
  it('logs an Analytics exception, not fatal', async () => {
    mod.reportError(new Error('Boom 01012345678'), 'route')
    await flush()
    expect(log).toHaveBeenCalledWith('exception', { description: 'route: Boom [n]', fatal: false })
  })

  it('never runs in the emulator', async () => {
    appState.useEmulator = true
    mod.reportError(new Error('Boom'), 'route')
    await flush()
    expect(loadAnalytics).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('sends an identical message once per session', async () => {
    mod.reportError(new Error('same'), 'route')
    mod.reportError(new Error('same'), 'route')
    await flush()
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('caps the session at 10 reports so a render loop cannot spam Analytics', async () => {
    for (let i = 0; i < 25; i++) mod.reportError(new Error(`e${String.fromCharCode(97 + i)}`), 'route')
    await flush()
    expect(log).toHaveBeenCalledTimes(10)
  })

  it('never throws, even when Analytics fails to load', async () => {
    loadAnalytics.mockRejectedValueOnce(new Error('blocked'))
    expect(() => mod.reportError(new Error('x'), 'route')).not.toThrow()
    await flush()
  })
})

describe('installErrorReporting', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reports window errors and unhandled rejections, installed once', async () => {
    const target = new EventTarget()
    const add = vi.spyOn(target, 'addEventListener')
    mod.installErrorReporting(target)
    mod.installErrorReporting(target)
    expect(add).toHaveBeenCalledTimes(2)
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('win boom'), message: 'win boom' }))
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('lost promise') }))
    await flush()
    expect(log).toHaveBeenCalledWith('exception', { description: 'window: win boom', fatal: false })
    expect(log).toHaveBeenCalledWith('exception', { description: 'promise: lost promise', fatal: false })
  })

  it('installs nothing in the emulator', () => {
    appState.useEmulator = true
    const target = new EventTarget()
    const add = vi.spyOn(target, 'addEventListener')
    mod.installErrorReporting(target)
    expect(add).not.toHaveBeenCalled()
  })
})
