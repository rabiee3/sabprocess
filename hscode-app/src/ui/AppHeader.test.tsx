import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

const signInWithGoogle = vi.fn()
vi.mock('../auth/api', () => ({ signInWithGoogle: () => signInWithGoogle(), signOutUser: vi.fn() }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))

import { AppHeader } from './AppHeader'

describe('AppHeader sign-in', () => {
  beforeEach(() => {
    initI18n()
    signInWithGoogle.mockReset()
  })
  it('has the G and shows an error banner on failure', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/network-request-failed' })
    render(<MemoryRouter><AppHeader /></MemoryRouter>)
    const btn = screen.getByRole('button', { name: en.nav.signIn })
    expect(btn.querySelectorAll('svg path')).toHaveLength(4)
    await userEvent.click(btn)
    const msg = await screen.findByText(en.errors.generic)
    expect(msg).toBeInTheDocument()
    expect(msg.closest('.fixed')).not.toBeNull()
    expect(document.querySelector('.absolute.top-14')).toBeNull()
  })
  it('shows the surveyor portal brand linking to the client map', () => {
    render(<MemoryRouter><AppHeader areaLabel="surveyor" /></MemoryRouter>)
    const link = screen.getByRole('link', { name: en.nav.backToMap })
    expect(link).toHaveAttribute('href', '/')
    expect(link).toHaveTextContent(en.portal.surveyor)
  })
  it('shows only the portal tag, not a second role badge', () => {
    render(<MemoryRouter><AppHeader areaLabel="surveyor" /></MemoryRouter>)
    expect(screen.getAllByText(en.portal.surveyor)).toHaveLength(1)
  })
  it('falls back to a plain logo link for an area with no portal', () => {
    render(<MemoryRouter><AppHeader areaLabel="client" /></MemoryRouter>)
    const link = screen.getByRole('link', { name: en.nav.backToMap })
    expect(link).toHaveAttribute('href', '/')
    expect(link).not.toHaveTextContent(en.portal.surveyor)
  })
})
