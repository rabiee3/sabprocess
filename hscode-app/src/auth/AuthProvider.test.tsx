import { useEffect } from 'react'
import { act, render } from '@testing-library/react'
import { ADMIN_UID } from '../firebase/config'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import { ensureUserDoc } from './api'

type AuthCb = (u: unknown) => void
type SnapCb = (s: { data: () => unknown; metadata?: { hasPendingWrites: boolean } }) => void

const h = vi.hoisted(() => ({
  authCb: null as null | ((u: unknown) => void),
  authUnsub: vi.fn(),
  snaps: [] as { uid: string; ok: SnapCb; unsub: ReturnType<typeof vi.fn> }[],
}))

vi.mock('../firebase', () => ({ auth: {}, db: {} }))
vi.mock('./api', () => ({ ensureUserDoc: vi.fn() }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, cb: AuthCb) => {
    h.authCb = cb
    return h.authUnsub
  },
}))
vi.mock('firebase/firestore', () => ({
  doc: (_d: unknown, _c: string, uid: string) => ({ uid }),
  onSnapshot: (ref: { uid: string }, _opts: unknown, ok: SnapCb) => {
    const unsub = vi.fn()
    h.snaps.push({ uid: ref.uid, ok, unsub })
    return unsub
  },
}))

let latest: ReturnType<typeof useAuth>
function Probe() {
  const auth = useAuth()
  useEffect(() => {
    latest = auth
  })
  return null
}
const mount = () => render(<AuthProvider><Probe /></AuthProvider>)
const fire = (u: unknown) => act(async () => { h.authCb!(u) })
const flush = () => act(async () => { await Promise.resolve() })
const snap = (data: unknown, hasPendingWrites = false) => ({ data: () => data, metadata: { hasPendingWrites } })

beforeEach(() => {
  h.authCb = null
  h.snaps.length = 0
  h.authUnsub.mockClear()
  vi.mocked(ensureUserDoc).mockReset().mockResolvedValue(undefined)
})

describe('AuthProvider', () => {
  it('starts loading, then resolves a visitor', async () => {
    mount()
    expect(latest.loading).toBe(true)
    await fire(null)
    expect(latest).toMatchObject({ user: null, role: 'visitor', active: false, loading: false })
  })

  it('(a) visitor -> user stays loading until the snapshot, then uses the doc role', async () => {
    mount()
    await fire(null)
    await fire({ uid: 'u1' })
    expect(latest).toMatchObject({ role: 'visitor', loading: true })
    await flush()
    expect(h.snaps).toHaveLength(1)
    expect(latest.loading).toBe(true)
    act(() => h.snaps[0].ok(snap({ role: 'surveyor', active: true })))
    expect(latest).toMatchObject({ role: 'surveyor', active: true, loading: false })
  })

  it('ignores an optimistic local surveyor promotion until the server confirms it', async () => {
    mount()
    await fire({ uid: 'u1' })
    await flush()
    act(() => h.snaps[0].ok(snap({ role: 'client', active: true })))
    act(() => h.snaps[0].ok(snap({ role: 'surveyor', active: true }, true)))
    expect(latest).toMatchObject({ role: 'client' })
    act(() => h.snaps[0].ok(snap({ role: 'surveyor', active: true })))
    expect(latest).toMatchObject({ role: 'surveyor' })
  })

  it('(b) re-fire before ensureUserDoc resolves does not attach the stale listener', async () => {
    let release!: () => void
    vi.mocked(ensureUserDoc).mockImplementationOnce(() => new Promise<void>((r) => { release = r }))
    mount()
    await fire({ uid: 'A' })
    await fire({ uid: 'B' })
    await act(async () => { release(); await Promise.resolve() })
    await flush()
    expect(h.snaps.map((s) => s.uid)).toEqual(['B'])
    act(() => h.snaps[0].ok(snap({ role: 'client', active: true })))
    expect(latest.user).toMatchObject({ uid: 'B' })
    expect(latest.loading).toBe(false)
  })

  it('switching users unsubscribes the previous snapshot', async () => {
    mount()
    await fire({ uid: 'A' })
    await flush()
    await fire({ uid: 'B' })
    expect(h.snaps[0].unsub).toHaveBeenCalled()
    expect(latest).toMatchObject({ role: 'visitor', loading: true })
    await flush()
    act(() => h.snaps[1].ok(snap({ role: 'client', active: true })))
    expect(latest.user).toMatchObject({ uid: 'B' })
  })

  it('(c) ensureUserDoc rejection still ends with loading false', async () => {
    vi.mocked(ensureUserDoc).mockRejectedValue(new Error('offline'))
    mount()
    await fire({ uid: 'u1' })
    await flush()
    await flush()
    act(() => h.snaps[0].ok(snap({ role: 'client', active: true })))
    expect(latest.loading).toBe(false)
  })

  it('(d) admin uid resolves to admin without ensureUserDoc', async () => {
    mount()
    await fire({ uid: ADMIN_UID })
    expect(latest).toMatchObject({ role: 'admin', active: true, loading: false })
    expect(ensureUserDoc).not.toHaveBeenCalled()
    expect(h.snaps).toHaveLength(0)
  })

  it("(f) a users doc claiming role 'admin' resolves to client (admin comes only from the UID)", async () => {
    mount()
    await fire({ uid: 'u1' })
    await flush()
    act(() => h.snaps[0].ok(snap({ role: 'admin', active: true })))
    expect(latest).toMatchObject({ role: 'client', active: true, loading: false })
  })

  it('(e) unmount unsubscribes auth and snapshot', async () => {
    const { unmount } = mount()
    await fire({ uid: 'u1' })
    await flush()
    unmount()
    expect(h.authUnsub).toHaveBeenCalled()
    expect(h.snaps[0].unsub).toHaveBeenCalled()
  })
})
