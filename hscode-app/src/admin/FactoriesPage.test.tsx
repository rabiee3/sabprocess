import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { initI18n, setLanguage } from '../i18n'
import type { Factory } from '../lib/types'
import { AdminContext } from './AdminContext'

vi.mock('../firebase', () => ({ db: {} }))

const fetchPage = vi.fn()
vi.mock('./factoriesQuery', () => ({ fetchFactoriesPage: (...a: unknown[]) => fetchPage(...a) }))

const hideFactory = vi.fn()
const unhideFactory = vi.fn()
const deleteFactory = vi.fn()
vi.mock('./repo', () => {
  class AdminError extends Error {
    readonly code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  }
  return {
    AdminError,
    hideFactory: (...a: unknown[]) => hideFactory(...a),
    unhideFactory: (...a: unknown[]) => unhideFactory(...a),
    deleteFactory: (...a: unknown[]) => deleteFactory(...a),
  }
})

import { AdminError } from './repo'
import { FactoriesPage } from './FactoriesPage'

const fac = (id: string, over: Partial<Factory> = {}): Factory => ({
  id,
  name: { en: `Factory ${id}` },
  area: 'oct6-zone-1',
  location: { lat: 29.92, lng: 30.91, accuracyM: 10, pinMoved: true },
  productsMade: [{ name: { en: 'Pipes' } }],
  productsNeeded: [],
  photoCount: 1,
  status: 'approved',
  createdBy: 'u1',
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 2),
  ...over,
})
const alpha = fac('a', { name: { en: 'Alpha Steel', ar: 'ألفا للصلب' }, thumb: 'data:image/png;base64,AAAA' })
const beta = fac('b', { name: { en: 'Beta Plastics' }, thumb: 'https://evil.example/x.png' })
const cursor1 = { id: 'cursor-1' }
const refreshPending = vi.fn()

function setup() {
  render(
    <AdminContext.Provider value={{ pending: 0, refreshPending }}>
      <MemoryRouter initialEntries={['/admin/factories']}>
        <Routes>
          <Route path="/admin/factories" element={<FactoriesPage />} />
          <Route path="/admin/factories/new" element={<p>new page</p>} />
        </Routes>
      </MemoryRouter>
    </AdminContext.Provider>,
  )
}

beforeEach(async () => {
  await initI18n()
  await setLanguage('en')
  for (const m of [fetchPage, hideFactory, unhideFactory, deleteFactory, refreshPending]) m.mockReset()
  fetchPage.mockResolvedValue({ rows: [alpha, beta], cursor: cursor1, hasMore: false })
  hideFactory.mockResolvedValue(undefined)
  unhideFactory.mockResolvedValue(undefined)
  deleteFactory.mockResolvedValue(undefined)
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
})

describe('FactoriesPage', () => {
  it('loads Approved first and switches the query status per tab', async () => {
    const user = userEvent.setup()
    setup()
    expect(await screen.findByText('Alpha Steel')).toBeInTheDocument()
    expect(fetchPage).toHaveBeenLastCalledWith('approved', null)
    expect(screen.getByRole('tab', { name: 'Approved' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Hidden' }))
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith('hidden', null))
    expect(screen.getByRole('tab', { name: 'Hidden' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Rejected' }))
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith('rejected', null))
  })

  it('searches names in English and Arabic (normalised)', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByText('Alpha Steel')
    await user.type(screen.getByRole('searchbox'), 'beta')
    expect(screen.queryByText('Alpha Steel')).not.toBeInTheDocument()
    expect(screen.getByText('Beta Plastics')).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'الفا')
    expect(screen.getByText('Alpha Steel')).toBeInTheDocument()
    expect(screen.queryByText('Beta Plastics')).not.toBeInTheDocument()
  })

  it('loads more with the last cursor and appends', async () => {
    const user = userEvent.setup()
    const cursor2 = { id: 'cursor-2' }
    fetchPage.mockResolvedValueOnce({ rows: [alpha], cursor: cursor1, hasMore: true })
    fetchPage.mockResolvedValueOnce({ rows: [beta], cursor: cursor2, hasMore: false })
    setup()
    await screen.findByText('Alpha Steel')
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('Beta Plastics')).toBeInTheDocument()
    expect(fetchPage).toHaveBeenLastCalledWith('approved', cursor1)
    expect(screen.getByText('Alpha Steel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('only renders data: image thumbnails', async () => {
    setup()
    await screen.findByText('Alpha Steel')
    const imgs = document.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]?.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('hides a factory, removes the row and shows a success banner', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByText('Alpha Steel')
    await user.click(screen.getByRole('button', { name: 'Hide Alpha Steel' }))
    expect(hideFactory).toHaveBeenCalledWith('a')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Open Alpha Steel' })).not.toBeInTheDocument())
    expect(screen.getByText('Alpha Steel is now hidden from the public map.')).toBeInTheDocument()
  })

  it('unhides from the Hidden tab', async () => {
    const user = userEvent.setup()
    fetchPage.mockResolvedValue({ rows: [{ ...alpha, status: 'hidden' }], cursor: cursor1, hasMore: false })
    setup()
    await user.click(await screen.findByRole('tab', { name: 'Hidden' }))
    await user.click(await screen.findByRole('button', { name: 'Unhide Alpha Steel' }))
    expect(unhideFactory).toHaveBeenCalledWith('a')
  })

  it('delete needs the typed name, then calls deleteFactory', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByText('Alpha Steel')
    await user.click(screen.getByRole('button', { name: 'Delete Alpha Steel' }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox'), 'alpha stee')
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox'), 'l  ')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(deleteFactory).toHaveBeenCalledWith('a')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Open Alpha Steel' })).not.toBeInTheDocument())
    expect(screen.getByText('Alpha Steel was deleted.')).toBeInTheDocument()
  })

  it('on an error shows the message and refetches the page', async () => {
    const user = userEvent.setup()
    hideFactory.mockRejectedValue(new AdminError('invalid'))
    setup()
    await screen.findByText('Alpha Steel')
    const calls = fetchPage.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Hide Alpha Steel' }))
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    await waitFor(() => expect(fetchPage.mock.calls.length).toBe(calls + 1))
    expect(screen.getByText('Alpha Steel')).toBeInTheDocument()
  })

  it('pending rows link to the review flow; add links to factories/new', async () => {
    const user = userEvent.setup()
    fetchPage.mockResolvedValue({ rows: [{ ...alpha, status: 'pending' }], cursor: null, hasMore: false })
    setup()
    await user.click(await screen.findByRole('tab', { name: 'Pending' }))
    const link = await screen.findByRole('link', { name: 'Review Alpha Steel' })
    expect(link).toHaveAttribute('href', '/admin/review/a')
    await user.click(screen.getByRole('link', { name: '+ Add factory' }))
    expect(screen.getByText('new page')).toBeInTheDocument()
  })

  it('has no h1', async () => {
    setup()
    await screen.findByText('Alpha Steel')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })
})
