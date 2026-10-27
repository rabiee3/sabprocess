import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

const signInWithGoogle = vi.fn()
vi.mock('../auth/api', () => ({ signInWithGoogle: () => signInWithGoogle() }))
const auth = { user: null as null | { displayName: string; email: string } }
const signOutAndWipe = vi.hoisted(() => vi.fn())
vi.mock('../auth/signOutAndWipe', () => ({ signOutAndWipe: () => signOutAndWipe() }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => auth }))
const pwa = vi.hoisted(() => ({ canInstall: false, install: vi.fn(async () => {}) }))
vi.mock('../pwa/usePwa', () => ({
  usePwa: () => ({ ...pwa, needRefresh: false, update: vi.fn(), isIosSafari: false }),
}))

import { ClientHeader } from './ClientHeader'

describe('ClientHeader sign-in', () => {
  beforeEach(() => {
    initI18n()
    signInWithGoogle.mockReset()
    auth.user = null
    pwa.canInstall = false
    pwa.install.mockClear()
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
  it('signed in: Sign out never wraps and collapses to an icon on phones, keeping its name', () => {
    auth.user = { displayName: 'Mona', email: 'm@example.com' }
    render(<MemoryRouter><ClientHeader /></MemoryRouter>)
    const out = screen.getByRole('button', { name: en.nav.signOut })
    expect(out.className).toContain('whitespace-nowrap')
    expect(out.className).toContain('min-w-11')
    expect(screen.getByText(en.nav.signOut)).toHaveClass('max-sm:sr-only')
  })

  it('the ☰ menu offers Install app only when the browser can install; it calls install()', async () => {
    const { unmount } = render(<MemoryRouter><ClientHeader /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: en.menu.open }))
    expect(screen.queryByRole('menuitem', { name: en.menu.install })).toBeNull()
    unmount()

    pwa.canInstall = true
    render(<MemoryRouter><ClientHeader /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: en.menu.open }))
    await userEvent.click(screen.getByRole('menuitem', { name: en.menu.install }))
    expect(pwa.install).toHaveBeenCalledTimes(1)
  })
  it('Sign out wipes the cache; when survey writes are still pending it says the data was kept (fixed info banner)', async () => {
    signOutAndWipe.mockResolvedValue('kept')
    auth.user = { displayName: 'Mona', email: 'm@example.com' }
    render(<MemoryRouter><ClientHeader /></MemoryRouter>)
    expect(screen.queryByText(en.nav.signOutKeptData)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: en.nav.signOut }))
    expect(signOutAndWipe).toHaveBeenCalledTimes(1)
    const msg = await screen.findByText(en.nav.signOutKeptData)
    expect(msg.closest('[role="status"]')).not.toBeNull()
    expect(msg.closest('.fixed')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: en.common.close }))
    expect(screen.queryByText(en.nav.signOutKeptData)).toBeNull()
  })
  it('while signing out the button is disabled and busy, labelled Signing out…', async () => {
    let done: (v: string) => void = () => {}
    signOutAndWipe.mockImplementation(() => new Promise((r) => { done = r }))
    auth.user = { displayName: 'Mona', email: 'm@example.com' }
    render(<MemoryRouter><ClientHeader /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: en.nav.signOut }))
    const btn = screen.getByRole('button', { name: en.nav.signingOut })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    await act(async () => done('wiped'))
    expect(screen.getByRole('button', { name: en.nav.signOut })).toBeEnabled()
  })
})
