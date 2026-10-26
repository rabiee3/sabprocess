import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

const signInWithGoogle = vi.fn()
vi.mock('../auth/api', () => ({ signInWithGoogle: () => signInWithGoogle(), signOutUser: vi.fn() }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: null }) }))

import { ClientHeader } from './ClientHeader'

describe('ClientHeader sign-in', () => {
  beforeEach(() => {
    initI18n()
    signInWithGoogle.mockReset()
  })
  it('has the G and shows an error banner on failure', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/network-request-failed' })
    render(<MemoryRouter><ClientHeader /></MemoryRouter>)
    const btn = screen.getByRole('button', { name: en.nav.signIn })
    expect(btn.querySelectorAll('svg path')).toHaveLength(4)
    await userEvent.click(btn)
    const msg = await screen.findByText(en.errors.generic)
    expect(msg).toBeInTheDocument()
    expect(msg.closest('.fixed')).not.toBeNull()
    expect(document.querySelector('.absolute.top-14')).toBeNull()
  })
  it('fits 360px: the sign-in button collapses to the G on phones; ☰ comes last', () => {
    render(<MemoryRouter><ClientHeader /></MemoryRouter>)
    expect(screen.getByText(en.nav.signIn)).toHaveClass('max-sm:sr-only')
    const controls = screen.getByRole('banner').querySelectorAll('button')
    expect(controls[controls.length - 1]).toHaveAccessibleName(en.menu.open)
  })
})
