import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

const signInWithGoogle = vi.fn()
vi.mock('../auth/api', () => ({ signInWithGoogle: () => signInWithGoogle() }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('./publicRepo', () => ({ loadContact: vi.fn() }))

import { ContactsPanel } from './ContactsPanel'

describe('ContactsPanel sign-in', () => {
  beforeEach(() => {
    initI18n()
    signInWithGoogle.mockReset()
  })
  it('shows the Google G on the button', () => {
    render(<ContactsPanel factoryId="f1" />)
    expect(screen.getByRole('button', { name: en.auth.continueWithGoogle }).querySelectorAll('svg path')).toHaveLength(4)
  })
  it('a network failure shows the generic banner', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/network-request-failed' })
    render(<ContactsPanel factoryId="f1" />)
    await userEvent.click(screen.getByRole('button', { name: en.auth.continueWithGoogle }))
    expect(await screen.findByText(en.errors.generic)).toBeInTheDocument()
  })
})
