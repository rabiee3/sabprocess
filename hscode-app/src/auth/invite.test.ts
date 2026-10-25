import { signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { normalizeInviteCode } from './invite'
import { signInWithGoogle } from './api'

vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<typeof import('firebase/auth')>()),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
}))

describe('normalizeInviteCode', () => {
  it('strips spaces', () => expect(normalizeInviteCode(' 012 345 ')).toBe('012345'))
  it('rejects short input', () => expect(normalizeInviteCode('12345')).toBeNull())
  it('rejects long input', () => expect(normalizeInviteCode('1234567')).toBeNull())
  it('converts Arabic-Indic digits', () => expect(normalizeInviteCode('١٢٣٤٥٦')).toBe('123456'))
  it('converts Persian digits', () => expect(normalizeInviteCode('۱۲۳۴۵۶')).toBe('123456'))
})

describe('signInWithGoogle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the popup when it works', async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({} as never)
    await signInWithGoogle()
    expect(signInWithRedirect).not.toHaveBeenCalled()
  })

  it.each(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'])(
    'falls back to redirect on %s',
    async (code) => {
      vi.mocked(signInWithPopup).mockRejectedValue({ code })
      vi.mocked(signInWithRedirect).mockResolvedValue(undefined as never)
      await signInWithGoogle()
      expect(signInWithRedirect).toHaveBeenCalledTimes(1)
    },
  )

  it('rethrows other errors', async () => {
    vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/network-request-failed' })
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'auth/network-request-failed' })
    expect(signInWithRedirect).not.toHaveBeenCalled()
  })
})
