import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

// The subheading chunk can't load (offline, chunk not cached).
vi.mock('../data', async (orig) => ({
  ...(await orig<typeof import('../data')>()),
  loadSubheadings: () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
}))

import { HsPicker } from './HsPicker'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
initI18n()

describe('HsPicker without a connection', () => {
  it('says more detail needs a connection instead of an empty list, and the heading is still usable', async () => {
    const onUse = vi.fn()
    render(<HsPicker open productLabel="Feed" onUse={onUse} onClose={vi.fn()} />)
    await userEvent.type(screen.getByRole('searchbox'), 'feed')
    await userEvent.click(await screen.findByRole('button', { name: /2309/ }))
    expect(await screen.findByText(en.hs.needsConnection)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Use 2309' }))
    expect(onUse).toHaveBeenCalledWith({ heading: '2309' })
  })
})
