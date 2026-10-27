import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

// The HS table chunk still loading, or failed (offline and not cached).
const tableState = { table: null, failed: false }
vi.mock('./lazyTable', () => ({
  useHsTable: () => tableState,
  loadHsTable: () => new Promise(() => {}),
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

describe('HsPicker before the HS table is loaded', () => {
  it('shows a loading state and keeps the search box and Skip usable', () => {
    tableState.failed = false
    render(<HsPicker open productLabel="Feed" onUse={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(en.common.loading)
    expect(screen.getByRole('searchbox')).toBeEnabled()
    expect(screen.getByRole('button', { name: en.hs.skip })).toBeEnabled()
  })

  it('says the list needs a connection when the chunk cannot be fetched', () => {
    tableState.failed = true
    render(<HsPicker open productLabel="Feed" onUse={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(en.hs.listNeedsConnection)
  })
})
