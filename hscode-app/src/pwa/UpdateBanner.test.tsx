import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n, setLanguage } from '../i18n'
import en from '../i18n/en.json'

const pwa = vi.hoisted(() => ({ needRefresh: false, update: vi.fn() }))
vi.mock('./usePwa', () => ({
  usePwa: () => ({ ...pwa, canInstall: false, install: vi.fn(), isIosSafari: false }),
}))

import { UpdateBanner } from './UpdateBanner'

describe('UpdateBanner', () => {
  beforeEach(async () => {
    initI18n()
    await setLanguage('en')
    pwa.needRefresh = false
    pwa.update.mockReset()
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

  it('sits at the top under the header, like the other banners, so it never covers the surveyor Add button', () => {
    pwa.needRefresh = true
    render(<UpdateBanner />)
    const box = screen.getByRole('status').parentElement!
    expect(box.className).toContain('fixed')
    expect(box.className).toContain('top-14')
    expect(box.className).toContain('z-[1300]')
    expect(box.className).not.toMatch(/bottom-/)
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
