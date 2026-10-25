import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

const signInAdmin = vi.fn()
vi.mock('../auth/api', () => ({ signInAdmin: (...a: unknown[]) => signInAdmin(...a) }))

import { AdminSignIn } from './AdminSignIn'

async function submit() {
  const u = userEvent.setup()
  render(<AdminSignIn />)
  await u.type(screen.getByLabelText(en.admin.signIn.email), 'a@b.com')
  await u.type(screen.getByLabelText(en.admin.signIn.password), 'pw')
  await u.click(screen.getByRole('button', { name: en.admin.signIn.submit }))
}

describe('AdminSignIn', () => {
  beforeEach(() => {
    initI18n()
    signInAdmin.mockReset()
  })

  it('has autocomplete hints and an email input', () => {
    render(<AdminSignIn />)
    const email = screen.getByLabelText(en.admin.signIn.email)
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText(en.admin.signIn.password)).toHaveAttribute('autocomplete', 'current-password')
  })
  it('submits the credentials', async () => {
    signInAdmin.mockResolvedValue(undefined)
    await submit()
    expect(signInAdmin).toHaveBeenCalledWith('a@b.com', 'pw')
  })
  it.each(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'])(
    '%s shows the same invalid message',
    async (code) => {
      signInAdmin.mockRejectedValue({ code })
      await submit()
      expect(await screen.findByRole('alert')).toHaveTextContent(en.admin.signIn.invalid)
    },
  )
  it('too many attempts', async () => {
    signInAdmin.mockRejectedValue({ code: 'auth/too-many-requests' })
    await submit()
    expect(await screen.findByText(en.admin.signIn.tooMany)).toBeInTheDocument()
  })
  it('offline', async () => {
    signInAdmin.mockRejectedValue({ code: 'auth/network-request-failed' })
    await submit()
    expect(await screen.findByText(en.errors.offline)).toBeInTheDocument()
  })
  it('anything else is generic', async () => {
    signInAdmin.mockRejectedValue(new Error('boom'))
    await submit()
    expect(await screen.findByText(en.errors.generic)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: en.admin.signIn.submit })).toBeEnabled())
  })
})
