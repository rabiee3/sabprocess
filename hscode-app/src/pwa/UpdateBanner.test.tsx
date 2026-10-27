import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n, setLanguage } from '../i18n'
import en from '../i18n/en.json'

const pwa = vi.hoisted(() => ({ needRefresh: false, update: vi.fn() }))
vi.mock('./usePwa', () => ({
  usePwa: () => ({ ...pwa, canInstall: false, install: vi.fn(), isIosSafari: false }),
}))

const signOut = vi.hoisted(() => ({ busy: false, kept: false }))
vi.mock('../auth/useSignOut', () => ({
  useSignOut: () => ({ ...signOut, signOut: vi.fn(), dismiss: vi.fn() }),
}))

import { UpdateBanner } from './UpdateBanner'

describe('UpdateBanner', () => {
  beforeEach(async () => {
    initI18n()
    await setLanguage('en')
    pwa.needRefresh = false
    pwa.update.mockReset()
    signOut.busy = false
  })

  it('is hidden by default', () => {
    const { container } = render(<UpdateBanner />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(en.pwa.updateTitle)).toBeNull()
  })

  it('when an update waits, shows the info banner; Reload calls update()', async () => {
    pwa.needRefresh = true
    render(<UpdateBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(en.pwa.updateTitle)
    expect(pwa.update).not.toHaveBeenCalled()
    const reload = screen.getByRole('button', { name: en.pwa.reload })
    expect(reload.className).toContain('min-h-touch')
    await userEvent.click(reload)
    expect(pwa.update).toHaveBeenCalledTimes(1)
  })

  it('while a sign-out is running, Reload is disabled, so a reload cannot skip the cache wipe', async () => {
    pwa.needRefresh = true
    signOut.busy = true
    const { rerender } = render(<UpdateBanner />)
    const reload = screen.getByRole('button', { name: en.pwa.reload })
    expect(reload).toBeDisabled()
    expect(reload).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(reload)
    expect(pwa.update).not.toHaveBeenCalled()
    signOut.busy = false
    rerender(<UpdateBanner />)
    expect(reload).toBeEnabled()
    await userEvent.click(reload)
    expect(pwa.update).toHaveBeenCalledTimes(1)
  })

  it('can be dismissed without reloading', async () => {
    pwa.needRefresh = true
    render(<UpdateBanner />)
    await userEvent.click(screen.getByRole('button', { name: en.common.close }))
    expect(screen.queryByText(en.pwa.updateTitle)).toBeNull()
    expect(pwa.update).not.toHaveBeenCalled()
  })

  it('has Arabic strings', async () => {
    pwa.needRefresh = true
    await setLanguage('ar')
    render(<UpdateBanner />)
    expect(screen.queryByText(en.pwa.updateTitle)).toBeNull()
    expect(screen.getAllByRole('button').length).toBe(2)
  })
})
