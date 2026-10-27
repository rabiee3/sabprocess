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
    expect(mod.describeError(new Error('+20 1012345678'), 'r')).toBe('r: +[n]')
  })

  it.each([
    ['spaces', 'bad phone 010 1234 5678 here', 'r: bad phone [n] here'],
    ['dashes', 'bad phone 010-1234-5678 here', 'r: bad phone [n] here'],
    ['country code', 'bad phone +20 10 1234 5678', 'r: bad phone +[n]'],
    ['Arabic-Indic digits', 'رقم ٠١٠١٢٣٤٥٦٧٨ خطأ', 'r: رقم [n] خطأ'],
    ['Eastern Arabic-Indic digits', 'رقم ۰۱۰۱۲۳۴۵۶۷۸ خطأ', 'r: رقم [n] خطأ'],
    ['Arabic digits with spaces', 'رقم ٠١٠ ١٢٣٤ ٥٦٧٨', 'r: رقم [n]'],
  ])('strips phone numbers written with %s', (_, msg, out) => {
    expect(mod.describeError(new Error(msg), 'r')).toBe(out)
  })

  it('keeps HS headings and codes readable', () => {
    expect(mod.describeError(new Error('no heading 2309 in chapter 23 (code 39172)'), 'r')).toBe(
      'r: no heading 2309 in chapter 23 (code 39172)',
    )
  })

  it('strips Firestore document paths and long ids', () => {
    expect(mod.describeError(new Error('No document to update: factories/f1abc for users/u9'), 'r')).toBe(
      'r: No document to update: factories/[id] for users/[id]',
    )
    expect(mod.describeError(new Error('bad token AbCdEf0123456789XyZaBc end'), 'r')).toBe('r: bad token [id] end')
  })

  it('strips query strings on relative URLs too', () => {
    expect(mod.describeError(new Error('GET /hscode/assets/x.js?v=me&q=feed failed'), 'r')).toBe(
      'r: GET /hscode/assets/x.js failed',
    )
    expect(mod.describeError(new Error('at /?q=secret'), 'r')).toBe('r: at /')
  })

  it('strips a query that follows a path token', () => {
    expect(mod.describeError(new Error('/hscode/f/abc?x=1'), 'r')).toBe('r: /hscode/f/abc')
  })

  it('leaves a plain "and/or?" alone', () => {
    expect(mod.describeError(new Error('and/or? maybe'), 'r')).toBe('r: and/or? maybe')
  })

  it('stays fast on a pathological message (no catastrophic backtracking)', () => {
    const msg = 'a/'.repeat(2500)
    const t0 = performance.now()
    mod.describeError(new Error(msg), 'r')
    mod.describeError(new Error(`${msg}?`), 'r')
    expect(performance.now() - t0).toBeLessThan(50)
  })

  it('treats long tokens with dashes and underscores as ids', () => {
    expect(mod.describeError(new Error('key ab_cd-ef_gh-ij_kl-mn_op end'), 'r')).toBe('r: key [id] end')
  })

  it('describes router error responses and other objects usefully, never [object Object]', () => {
    expect(mod.describeError({ status: 404, statusText: 'Not Found', internal: true, data: 'x' }, 'route')).toBe(
      'route: 404 Not Found',
    )
    expect(mod.describeError({ foo: 1 }, 'promise')).not.toContain('[object')
    expect(mod.describeError(Object.assign(new Error(''), { name: 'TypeError' }), 'w')).toBe('w: TypeError')
  })

  it('strips URL query strings', () => {
    expect(mod.describeError(new Error('GET https://x.example/a/b?token=abc&u=me failed'), 'r')).toBe(
      'r: GET https://x.example/a/b failed',
    )
  })

  it('truncates to 100 characters', () => {
    const d = mod.describeError(new Error('xx '.repeat(100)), 'route')
    expect(d).toHaveLength(100)
    expect(d.startsWith('route: xx xx')).toBe(true)
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
