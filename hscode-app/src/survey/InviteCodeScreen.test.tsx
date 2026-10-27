import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

const claimInvite = vi.fn()
let online = true
let role = 'client'
vi.mock('../auth/api', () => ({ claimInvite: (...a: unknown[]) => claimInvite(...a), signInWithGoogle: vi.fn() }))
vi.mock('../ui/useOnline', () => ({ useOnline: () => online }))
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'a@b.com', displayName: 'A' }, role, active: false, loading: false }),
}))

import { InviteCodeScreen } from './InviteCodeScreen'

async function enter(code: string) {
  await userEvent.click(screen.getAllByRole('textbox')[0])
  await userEvent.paste(code)
}
const unlock = () => screen.getByRole('button', { name: en.survey.invite.unlock })

describe('InviteCodeScreen', () => {
  beforeEach(() => {
    initI18n()
    claimInvite.mockReset()
    online = true
    role = 'client'
  })
  afterEach(() => vi.useRealTimers())

  it('shows who is signed in and disables the button until 6 digits', async () => {
    render(<InviteCodeScreen />)
    expect(screen.getByText('Signed in as a@b.com')).toBeInTheDocument()
    expect(unlock()).toBeDisabled()
    await enter('012345')
    expect(unlock()).toBeEnabled()
  })

  it('invalid shows the single invalid message', async () => {
    claimInvite.mockResolvedValue('invalid')
    render(<InviteCodeScreen />)
    await enter('012345')
    await userEvent.click(unlock())
    expect(await screen.findByText(en.survey.invite.invalid)).toBeInTheDocument()
  })

  it('ok claims with the string code (leading zero, Arabic digits normalized) and shows no error', async () => {
    claimInvite.mockResolvedValue('ok')
    render(<InviteCodeScreen />)
    await enter('٠١٢٣٤٥')
    await userEvent.click(unlock())
    expect(claimInvite).toHaveBeenCalledTimes(1)
    expect(claimInvite).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1' }), '012345')
    expect(screen.queryByText(en.survey.invite.invalid)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a thrown error shows the generic error', async () => {
    claimInvite.mockRejectedValue(new Error('boom'))
    render(<InviteCodeScreen />)
    await enter('012345')
    await userEvent.click(unlock())
    expect(await screen.findByText(en.errors.generic)).toBeInTheDocument()
  })

  it('offline: banner, disabled button, no claim', async () => {
    online = false
    render(<InviteCodeScreen />)
    await enter('012345')
    expect(screen.getByText(en.errors.offline)).toBeInTheDocument()
    expect(unlock()).toBeDisabled()
    await userEvent.click(unlock())
    expect(claimInvite).not.toHaveBeenCalled()
  })

  describe('unlock fallback', () => {
    async function claimOk() {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      claimInvite.mockResolvedValue('ok')
      const view = render(<InviteCodeScreen />)
      await enter('012345')
      await userEvent.click(unlock())
      expect(await screen.findByText(en.survey.invite.unlocking)).toBeInTheDocument()
      return view
    }

    it('after 15 s still unlocking shows the slow banner and Reload, claim stays locked', async () => {
      await claimOk()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000)
      })
      expect(screen.getByText(en.survey.invite.unlockSlow)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: en.common.reload })).toBeInTheDocument()
      expect(unlock()).toBeDisabled()
    })

    it('a role flip before 15 s shows no slow banner', async () => {
      const view = await claimOk()
      role = 'surveyor'
      view.rerender(<InviteCodeScreen />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000)
      })
      expect(screen.queryByText(en.survey.invite.unlockSlow)).toBeNull()
    })
  })

  it('a claim that has not settled after 15 s stops spinning and shows the offline message; a late ok still unlocks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let settle: (v: 'ok') => void = () => {}
    claimInvite.mockImplementation(() => new Promise((r) => (settle = r)))
    render(<InviteCodeScreen />)
    await enter('012345')
    await userEvent.click(unlock())
    expect(unlock()).toBeDisabled()
    expect(screen.queryByText(en.errors.offline)).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(screen.getByText(en.errors.offline)).toBeInTheDocument()
    expect(unlock()).toBeEnabled()
    await act(async () => settle('ok'))
    expect(screen.getByText(en.survey.invite.unlocking)).toBeInTheDocument()
    expect(claimInvite).toHaveBeenCalledTimes(1)
  })
})

