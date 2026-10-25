import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

const claimInvite = vi.fn()
let online = true
vi.mock('../auth/api', () => ({ claimInvite: (...a: unknown[]) => claimInvite(...a), signInWithGoogle: vi.fn(), signOutUser: vi.fn() }))
vi.mock('../ui/useOnline', () => ({ useOnline: () => online }))
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'a@b.com', displayName: 'A' }, role: 'client', active: false, loading: false }),
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
  })

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
})
