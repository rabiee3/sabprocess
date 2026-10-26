import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

const signInWithGoogle = vi.fn()
vi.mock('../auth/api', () => ({ signInWithGoogle: () => signInWithGoogle() }))
const auth = { user: null as { uid: string } | null }
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: auth.user }) }))
const loadContact = vi.fn()
vi.mock('./publicRepo', () => ({ loadContact: (...a: unknown[]) => loadContact(...a) }))

import { ContactsPanel } from './ContactsPanel'

describe('ContactsPanel sign-in', () => {
  beforeEach(() => {
    initI18n()
    signInWithGoogle.mockReset()
    auth.user = null
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

describe('ContactsPanel account switch', () => {
  beforeEach(() => {
    initI18n()
    loadContact.mockReset()
  })

  it("switching from account A to B never shows A's contact, even when A's read answers late", async () => {
    const reads: Record<string, (c: unknown) => void> = {}
    loadContact.mockImplementation(() => new Promise((r) => { reads[auth.user!.uid] = r }))
    auth.user = { uid: 'A' }
    const { rerender } = render(<ContactsPanel factoryId="f1" />)
    auth.user = { uid: 'B' }
    rerender(<ContactsPanel factoryId="f1" />)
    expect(screen.getByText(en.common.loading)).toBeInTheDocument()
    await act(async () => reads.B({ contactPerson: 'Person B' }))
    expect(screen.getByText('Person B')).toBeInTheDocument()
    await act(async () => reads.A({ contactPerson: 'Person A' }))
    expect(screen.queryByText('Person A')).toBeNull()
    expect(screen.getByText('Person B')).toBeInTheDocument()
  })

  it("after A's contact is shown, switching to B hides it at once while B's loads", async () => {
    loadContact.mockResolvedValueOnce({ contactPerson: 'Person A' }).mockReturnValueOnce(new Promise(() => {}))
    auth.user = { uid: 'A' }
    const { rerender } = render(<ContactsPanel factoryId="f1" />)
    expect(await screen.findByText('Person A')).toBeInTheDocument()
    auth.user = { uid: 'B' }
    rerender(<ContactsPanel factoryId="f1" />)
    expect(screen.queryByText('Person A')).toBeNull()
    expect(screen.getByText(en.common.loading)).toBeInTheDocument()
  })
})
