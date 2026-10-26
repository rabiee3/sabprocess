import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { initI18n, setLanguage } from '../i18n'
import type { Factory } from '../lib/types'
import { AdminContext } from './AdminContext'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Circle: ({ radius }: { radius: number }) => <div data-testid="circle" data-radius={radius} />,
  useMap: () => ({ setView: vi.fn(), getZoom: () => 16 }),
  useMapEvents: () => ({}),
  Marker: ({ position, title }: { position: [number, number]; title?: string }) => (
    <div data-testid="marker" data-lat={position[0]} data-title={title} />
  ),
}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('../map/useGeolocation', () => ({ useGeolocation: () => ({ status: 'unavailable', retry: vi.fn() }) }))
vi.mock('../firebase', () => ({ db: {} }))

let pushQueue: (r: Factory[]) => void
vi.mock('./queue', () => ({
  subscribeQueue: (cb: (r: Factory[]) => void) => {
    pushQueue = cb
    return () => {}
  },
}))
vi.mock('./surveyors', () => ({
  subscribeSurveyors: (cb: (r: unknown[]) => void) => {
    cb([{ uid: 'u1', name: 'Mona Adel', email: 'm@x.com', active: true, createdAt: new Date(0) }])
    return () => {}
  },
}))

const loadForReview = vi.fn()
const approveFactory = vi.fn()
const rejectFactory = vi.fn()
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
    approveFactory: (...a: unknown[]) => approveFactory(...a),
    rejectFactory: (...a: unknown[]) => rejectFactory(...a),
  }
})

import { AdminError } from './repo'
import { ReviewQueue } from './ReviewQueue'

const fac = (id: string, day: number, over: Partial<Factory> = {}): Factory => ({
  id,
  name: { en: `Factory ${id}` },
  area: 'oct6-zone-1',
  location: { lat: 29.92, lng: 30.91, accuracyM: 10, pinMoved: true },
  productsMade: [{ name: { en: 'Pipes' } }],
  productsNeeded: [],
  photoCount: 1,
  status: 'pending',
  createdBy: 'u1',
  createdAt: new Date(2026, 9, day),
  updatedAt: new Date(2026, 9, day),
  ...over,
})
const f1 = fac('f1', 1, { location: { lat: 29.92, lng: 30.91, accuracyM: 85, pinMoved: true } })
const f2 = fac('f2', 2, { location: { lat: 29.93, lng: 30.92, accuracyM: null, pinMoved: false } })
const openedAt = { isEqual: () => true }

const refreshPending = vi.fn()

function setup(path = '/admin/review') {
  render(
    <AdminContext.Provider value={{ pending: 2, refreshPending }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/review/:fid?" element={<ReviewQueue />} />
        </Routes>
      </MemoryRouter>
    </AdminContext.Provider>,
  )
}

beforeEach(async () => {
  await initI18n()
  await setLanguage('en')
  for (const m of [loadForReview, approveFactory, rejectFactory, refreshPending]) m.mockReset()
  loadForReview.mockImplementation(async (fid: string) => ({
    factory: fid === 'f1' ? f1 : f2,
    openedAt,
    contact: { phone: '01012345678', website: 'javascript:alert(1)' },
    photos: [{ id: 'p1', data: 'data:image/jpeg;base64,AAAA' }],
  }))
  approveFactory.mockResolvedValue(undefined)
  rejectFactory.mockResolvedValue(undefined)
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
})

describe('ReviewQueue', () => {
  it('lists pending submissions oldest first with flag chips and surveyor', async () => {
    setup()
    act(() => pushQueue([f2, f1]))
    const cards = await screen.findAllByRole('link', { name: /Factory f/ })
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining('Factory f1'),
      expect.stringContaining('Factory f2'),
    ])
    expect(within(cards[0]).getByText('Low GPS accuracy')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Placed by hand')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Pin never moved')).toBeInTheDocument()
    expect(within(cards[0]).getByText(/Mona Adel/)).toBeInTheDocument()
    expect(screen.getAllByTestId('marker')).toHaveLength(2)
  })

  it('shows the empty state', async () => {
    setup()
    act(() => pushQueue([]))
    expect(await screen.findByText('No submissions waiting for review.')).toBeInTheDocument()
  })

  it('detail: warning per flag, no h1, h2 name, approve with the edited name', async () => {
    const user = userEvent.setup()
    setup('/admin/review/f1')
    act(() => pushQueue([f1, f2]))
    expect(await screen.findByRole('heading', { level: 2, name: 'Factory f1' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByText(/GPS accuracy was ±85 m/)).toBeInTheDocument()
    const name = screen.getByLabelText('Factory name (English)')
    await user.clear(name)
    // Under load this once read the old name: a late location-picker emit was applied to the first render's
    // draft and undid the clear. Fixed in the app (edits reduce onto the latest draft; see ReviewDetail.test).
    await waitFor(() => expect(name).toHaveValue(''))
    await user.type(name, 'Nile Pipes')
    await waitFor(() => expect(name).toHaveValue('Nile Pipes'))
    await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
    await waitFor(() => expect(approveFactory).toHaveBeenCalled())
    const [fid, opened, edit] = approveFactory.mock.calls[0]
    expect(fid).toBe('f1')
    expect(opened).toBe(openedAt)
    expect(edit).toMatchObject({ name: { en: 'Nile Pipes' }, area: 'oct6-zone-1' })
    expect(refreshPending).toHaveBeenCalled()
  })

  it('a new queue snapshot mid-edit does not wipe the edits, and loads the factory once', async () => {
    const user = userEvent.setup()
    setup('/admin/review/f1')
    act(() => pushQueue([f1, f2]))
    const name = await screen.findByLabelText('Factory name (English)')
    await user.clear(name)
    await user.type(name, 'Half done')
    act(() => pushQueue([{ ...f1 }, { ...f2 }, fac('f3', 3)]))
    act(() => pushQueue([{ ...f1, updatedAt: new Date() }, fac('f3', 3)]))
    expect(screen.getByLabelText('Factory name (English)')).toHaveValue('Half done')
    expect(loadForReview).toHaveBeenCalledTimes(1)
  })

  it('after approve the banner names the published (edited) name', async () => {
    const user = userEvent.setup()
    setup('/admin/review/f1')
    act(() => pushQueue([f1, f2]))
    const name = await screen.findByLabelText('Factory name (English)')
    await user.clear(name)
    await user.type(name, 'Nile Pipes')
    await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
    expect(await screen.findByText('Nile Pipes was approved and published.')).toBeInTheDocument()
  })

  it('after approve it opens the next pending item and shows a status banner', async () => {
    const user = userEvent.setup()
    setup('/admin/review/f1')
    act(() => pushQueue([f1, f2]))
    await user.click(await screen.findByRole('button', { name: 'Approve & publish' }))
    await waitFor(() => expect(loadForReview).toHaveBeenCalledWith('f2'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Factory f2' })).toBeInTheDocument()
    expect(screen.getByText('Factory f1 was approved and published.')).toBeInTheDocument()
  })

  it('reject requires a reason', async () => {
    const user = userEvent.setup()
    setup('/admin/review/f1')
    act(() => pushQueue([f1, f2]))
    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Reject submission' }))
    expect(rejectFactory).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Write a reason')
    await user.type(within(dialog).getByRole('textbox'), '   ')
    await user.click(within(dialog).getByRole('button', { name: 'Reject submission' }))
    expect(rejectFactory).not.toHaveBeenCalled()
    await user.type(within(dialog).getByRole('textbox'), 'Wrong place')
    await user.click(within(dialog).getByRole('button', { name: 'Reject submission' }))
    await waitFor(() => expect(rejectFactory).toHaveBeenCalledWith('f1', openedAt, 'Wrong place'))
    expect(refreshPending).toHaveBeenCalled()
  })

  it('stale error shows the banner and Reload reloads the item', async () => {
    const user = userEvent.setup()
    approveFactory.mockRejectedValueOnce(new AdminError('stale'))
    setup('/admin/review/f1')
    act(() => pushQueue([f1, f2]))
    await user.click(await screen.findByRole('button', { name: 'Approve & publish' }))
    expect(await screen.findByText(/just updated/)).toBeInTheDocument()
    expect(loadForReview).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(loadForReview).toHaveBeenCalledTimes(2))
  })

  it('indexFull shows its own message', async () => {
    const user = userEvent.setup()
    approveFactory.mockRejectedValueOnce(new AdminError('indexFull'))
    setup('/admin/review/f1')
    act(() => pushQueue([f1]))
    await user.click(await screen.findByRole('button', { name: 'Approve & publish' }))
    expect(await screen.findByText(/search index is full/i)).toBeInTheDocument()
  })

  it('blocks approve while the form is invalid', async () => {
    const user = userEvent.setup()
    setup('/admin/review/f1')
    act(() => pushQueue([f1]))
    const name = await screen.findByLabelText('Factory name (English)')
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Approve & publish' }))
    expect(approveFactory).not.toHaveBeenCalled()
    expect(screen.getAllByText('At least one name is required.').length).toBeGreaterThan(0)
  })

  it('contact links are safe and photos open larger', async () => {
    const user = userEvent.setup()
    setup('/admin/review/f1')
    act(() => pushQueue([f1]))
    const tel = await screen.findByRole('link', { name: '01012345678' })
    expect(tel).toHaveAttribute('href', 'tel:01012345678')
    expect(screen.queryByRole('link', { name: /javascript/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Open photo 1' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('img', { name: 'Factory photo 1' })).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA')
  })

  it('outline: factory name h2, sections h3, no h1; no GPS controls on the review map', async () => {
    setup('/admin/review/f1')
    act(() => pushQueue([f1]))
    await screen.findByRole('heading', { level: 2, name: 'Factory f1' })
    expect(screen.getByRole('heading', { level: 3, name: 'Products made' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'My location' })).toBeNull()
    expect(screen.getByTestId('circle')).toHaveAttribute('data-radius', '85')
  })

  it('only data:image sources are rendered; Arabic-digit phones link with ASCII digits', async () => {
    loadForReview.mockResolvedValue({
      factory: { ...f1, thumb: 'https://evil.example/x.png' },
      openedAt,
      contact: { phone: '٠١٠١٢٣٤٥٦٧٨' },
      photos: [{ id: 'p1', data: 'https://evil.example/p.jpg' }],
    })
    setup('/admin/review/f1')
    act(() => pushQueue([{ ...f1, thumb: 'https://evil.example/x.png' }]))
    await screen.findByRole('heading', { level: 2, name: 'Factory f1' })
    expect(document.querySelector('img[src^="https"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open photo 1' })).toBeDisabled()
    expect(screen.getByRole('link', { name: '٠١٠١٢٣٤٥٦٧٨' })).toHaveAttribute('href', 'tel:01012345678')
  })
})
