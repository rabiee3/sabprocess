import { useEffect } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Races while the lazily imported role watcher chunk is still loading. The chunk is held back through its
// Firestore dependency (../firebase/db), so every import() of it shares that one pending load, as in a browser.
type Snap = { data: () => unknown; metadata?: { hasPendingWrites: boolean } }

const h = vi.hoisted(() => ({
  authCb: null as null | ((u: unknown) => void),
  watched: [] as string[],
  ensureCalls: 0,
}))

vi.mock('../firebase/app', () => ({ auth: {} }))
vi.mock('./api', () => ({
  ensureUserDoc: async () => {
    h.ensureCalls++
  },
}))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => {
    h.authCb = cb
    return () => {}
  },
}))
vi.mock('firebase/firestore', () => ({
  doc: (_d: unknown, _c: string, uid: string) => ({ uid }),
  onSnapshot: (ref: { uid: string }, _opts: unknown, next: (s: Snap) => void) => {
    h.watched.push(ref.uid)
    // The doc is in the cache: its first snapshot arrives at once.
    next({ data: () => ({ role: 'surveyor', active: true }), metadata: { hasPendingWrites: false } })
    return () => {}
  },
}))

let release: () => void = () => {}
function holdChunk(fail = false) {
  const gate = new Promise<void>((r) => {
    release = r
  })
  vi.doMock('../firebase/db', async () => {
    await gate
    if (fail) throw new TypeError('Failed to fetch dynamically imported module')
    return { db: {} }
  })
}

type Auth = { user: { uid: string } | null; role: string; loading: boolean }
let latest: Auth

async function mount() {
  const { AuthProvider } = await import('./AuthProvider')
  const { useAuth } = await import('./useAuth')
  function Probe() {
    const auth = useAuth() as Auth
    useEffect(() => {
      latest = auth
    })
    return null
  }
  render(<AuthProvider><Probe /></AuthProvider>)
}
const fire = (u: unknown) => act(async () => { h.authCb!(u) })
// Lets the chunk arrive, then waits until the provider has acted on it (or a settle period passes).
const arrive = (done: () => boolean) =>
  act(async () => {
    release()
    await vi.waitFor(() => expect(done()).toBe(true), { timeout: 2000 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 20))
  })

beforeEach(() => {
  vi.resetModules()
  h.authCb = null
  h.watched.length = 0
  h.ensureCalls = 0
})
afterEach(() => {
  vi.doUnmock('../firebase/db')
})

describe('AuthProvider while the role watcher chunk loads', () => {
  it('a sign-out during the import leaves the role unset (visitor)', async () => {
    holdChunk()
    await mount()
    await fire({ uid: 'u1' })
    expect(latest).toMatchObject({ role: 'visitor', loading: true })
    await fire(null)
    await arrive(() => h.watched.length > 0)
    expect(h.ensureCalls).toBe(0)
    expect(h.watched).toEqual([])
    expect(latest).toMatchObject({ user: null, role: 'visitor', loading: false })
  })

  it('a uid change during the import: the last uid wins', async () => {
    holdChunk()
    await mount()
    await fire({ uid: 'A' })
    await fire({ uid: 'B' })
    await arrive(() => h.watched.includes('B'))
    expect(h.watched).toEqual(['B'])
    expect(latest.user).toMatchObject({ uid: 'B' })
    expect(latest).toMatchObject({ role: 'surveyor', loading: false })
  })

  it('an import failure still resolves loading (client view)', async () => {
    holdChunk(true)
    await mount()
    await fire({ uid: 'u1' })
    expect(latest.loading).toBe(true)
    await arrive(() => !latest.loading)
    expect(h.watched).toEqual([])
    expect(latest).toMatchObject({ user: { uid: 'u1' }, role: 'client', loading: false })
  })
})
