import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { initI18n, setLanguage } from '../i18n'
import type { Factory } from '../lib/types'
import { AdminContext } from './AdminContext'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Circle: () => null,
  useMap: () => ({ setView: vi.fn(), getZoom: () => 16 }),
  useMapEvents: () => ({}),
  Marker: () => null,
}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('../map/useGeolocation', () => ({ useGeolocation: () => ({ status: 'unavailable', retry: vi.fn() }) }))
vi.mock('../firebase', () => ({ db: {} }))

const loadForReview = vi.fn()
const saveEdits = vi.fn()
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
    loadForReview: (...a: unknown[]) => loadForReview(...a),
    saveEdits: (...a: unknown[]) => saveEdits(...a),
    hideFactory: (...a: unknown[]) => hideFactory(...a),
    unhideFactory: (...a: unknown[]) => unhideFactory(...a),
    deleteFactory: (...a: unknown[]) => deleteFactory(...a),
  }
})

import { AdminError } from './repo'
import { FactoryAdminPage } from './FactoryAdminDetail'

const base: Factory = {
  id: 'f1',
  name: { en: 'Alpha Steel' },
  area: 'oct6-zone-1',
  location: { lat: 29.92, lng: 30.91, accuracyM: 10, pinMoved: true },
  productsMade: [{ name: { en: 'Pipes' } }],
  productsNeeded: [],
  photoCount: 0,
  status: 'approved',
  createdBy: 'u1',
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 2),
}
const openedAt = { isEqual: () => true }
const refreshPending = vi.fn()

function serve(over: Partial<Factory> = {}) {
  loadForReview.mockImplementation(async () => ({
    factory: { ...base, ...over },
    openedAt,
    contact: {},
    photos: [],
  }))
}

function setup() {
  render(
    <AdminContext.Provider value={{ pending: 0, refreshPending }}>
      <MemoryRouter initialEntries={['/admin/factories/f1']}>
        <Routes>
          <Route path="/admin/factories/:fid" element={<FactoryAdminPage />} />
          <Route path="/admin/factories" element={<p>list page</p>} />
        </Routes>
      </MemoryRouter>
    </AdminContext.Provider>,
  )
}

beforeEach(async () => {
  await initI18n()
  await setLanguage('en')
  for (const m of [loadForReview, saveEdits, hideFactory, unhideFactory, deleteFactory, refreshPending]) m.mockReset()
  for (const m of [saveEdits, hideFactory, unhideFactory, deleteFactory]) m.mockResolvedValue(undefined)
  serve()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
})

describe('FactoryAdminDetail', () => {
  it('saves edits with the opened timestamp', async () => {
    const user = userEvent.setup()
    setup()
    await screen.findByRole('heading', { name: 'Alpha Steel', level: 2 })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveEdits).toHaveBeenCalledTimes(1))
    expect(saveEdits.mock.calls[0]?.[0]).toBe('f1')
    expect(saveEdits.mock.calls[0]?.[1]).toBe(openedAt)
    expect(await screen.findByText('Changes to Alpha Steel were saved.')).toBeInTheDocument()
  })

  it('shows a stale banner with Reload', async () => {
    const user = userEvent.setup()
    saveEdits.mockRejectedValue(new AdminError('stale'))
    setup()
    await screen.findByRole('button', { name: 'Save changes' })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/just updated/)).toBeInTheDocument()
    const calls = loadForReview.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(loadForReview.mock.calls.length).toBe(calls + 1))
  })

  it('maps indexFull to errors.indexFull', async () => {
    const user = userEvent.setup()
    saveEdits.mockRejectedValue(new AdminError('indexFull'))
    setup()
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Search index is full/)).toBeInTheDocument()
  })

  it('hides an approved factory', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'Hide' }))
    expect(hideFactory).toHaveBeenCalledWith('f1')
    expect(await screen.findByText('Alpha Steel is now hidden from the public map.')).toBeInTheDocument()
  })

  it('disables Hide while the form has unsaved edits, with a hint', async () => {
    const user = userEvent.setup()
    setup()
    const hide = await screen.findByRole('button', { name: 'Hide' })
    expect(hide).toBeEnabled()
    expect(screen.queryByText('Save or discard your changes first')).toBeNull()
    await user.type(screen.getByLabelText('Factory name (English)'), 'X')
    expect(screen.getByRole('button', { name: 'Hide' })).toBeDisabled()
    expect(screen.getByText('Save or discard your changes first')).toBeInTheDocument()
  })

  it('disables Unhide while the form has unsaved edits', async () => {
    const user = userEvent.setup()
    serve({ status: 'hidden' })
    setup()
    expect(await screen.findByRole('button', { name: 'Unhide' })).toBeEnabled()
    await user.type(screen.getByLabelText('Factory name (English)'), 'X')
    expect(screen.getByRole('button', { name: 'Unhide' })).toBeDisabled()
  })

  it('hidden: banner and Unhide', async () => {
    const user = userEvent.setup()
    serve({ status: 'hidden' })
    setup()
    expect(await screen.findByText('Hidden from the public map')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unhide' }))
    expect(unhideFactory).toHaveBeenCalledWith('f1')
  })

  it('rejected: shows the stored reason read-only', async () => {
    serve({ status: 'rejected', rejectReason: 'Photos are blurry' })
    setup()
    expect(await screen.findByText('Photos are blurry')).toBeInTheDocument()
  })

  it('pending: links to the review flow', async () => {
    serve({ status: 'pending' })
    setup()
    const link = await screen.findByRole('link', { name: 'Open in the review queue' })
    expect(link).toHaveAttribute('href', '/admin/review/f1')
  })

  it('delete needs the typed name, then returns to the list', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox'), 'ALPHA STEEL')
    await user.click(confirm)
    expect(deleteFactory).toHaveBeenCalledWith('f1')
    expect(await screen.findByText('list page')).toBeInTheDocument()
  })

  it('has no h1', async () => {
    setup()
    await screen.findByRole('heading', { name: 'Alpha Steel', level: 2 })
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })
})
