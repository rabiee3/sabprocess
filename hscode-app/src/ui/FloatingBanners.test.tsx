import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { initI18n, setLanguage } from '../i18n'
import en from '../i18n/en.json'

const pwa = vi.hoisted(() => ({ needRefresh: false, update: vi.fn() }))
vi.mock('../pwa/usePwa', () => ({
  usePwa: () => ({ ...pwa, canInstall: false, install: vi.fn(), isIosSafari: false }),
}))
const signOut = vi.hoisted(() => ({ busy: false, kept: false }))
vi.mock('../auth/useSignOut', () => ({
  useSignOut: () => ({ ...signOut, signOut: vi.fn(), dismiss: vi.fn() }),
}))

import { FloatingBanners } from './FloatingBanners'

describe('FloatingBanners', () => {
  beforeEach(async () => {
    initI18n()
    await setLanguage('en')
    pwa.needRefresh = false
    signOut.kept = false
  })

  it('renders nothing visible when no banner is due', () => {
    const { container } = render(<FloatingBanners />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(container.querySelectorAll('.fixed')).toHaveLength(1)
  })

  it('stacks the update banner and the "data kept" note in one fixed column, update first, never overlapping', () => {
    pwa.needRefresh = true
    signOut.kept = true
    const { container } = render(<FloatingBanners />)
    const update = screen.getByText(en.pwa.updateTitle)
    const kept = screen.getByText(en.nav.signOutKeptData)
    // One positioned container only: the banners themselves are in its flow, not each fixed at top-14.
    const fixed = container.querySelectorAll('.fixed')
    expect(fixed).toHaveLength(1)
    const stack = fixed[0] as HTMLElement
    for (const c of ['top-14', 'flex', 'flex-col', 'gap-2', 'z-[1300]']) expect(stack.className.split(/\s+/)).toContain(c)
    expect(stack.contains(update) && stack.contains(kept)).toBe(true)
    expect(update.compareDocumentPosition(kept) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(stack.className).not.toMatch(/bottom-/)
  })
})
