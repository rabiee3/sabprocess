import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { ReactNode } from 'react'
import { initI18n, setLanguage } from '../i18n'
import type { Factory } from '../lib/types'

vi.mock('../firebase', () => ({ db: {}, auth: {} }))
const signInWithGoogle = vi.fn().mockResolvedValue(undefined)
vi.mock('../auth/api', () => ({ signInWithGoogle: (...a: unknown[]) => signInWithGoogle(...a), signOutUser: vi.fn() }))
const auth = { user: null as unknown }
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: auth.user, role: 'visitor', active: false, loading: false }) }))
vi.mock('leaflet/dist/leaflet.css', () => ({}))
const mapProps: Record<string, unknown>[] = []
vi.mock('react-leaflet', () => ({
  MapContainer: (p: Record<string, unknown> & { children?: ReactNode }) => {
    mapProps.push(p)
    return <div data-testid="map">{p.children}</div>
  },
  TileLayer: () => null,
  Marker: () => <div data-testid="pin" />,
}))
const loadPublicFactory = vi.fn()
const loadPhotos = vi.fn()
const loadContact = vi.fn()
vi.mock('./publicRepo', () => ({
  loadPublicFactory: (...a: unknown[]) => loadPublicFactory(...a),
  loadPhotos: (...a: unknown[]) => loadPhotos(...a),
  loadContact: (...a: unknown[]) => loadContact(...a),
}))

import { Component as FactoryPage } from './FactoryPage'

const IMG = 'data:image/png;base64,AAAA'
const factory: Factory = {
  id: 'f1', name: { en: 'Al-Nour Feed Mills', ar: 'مطاحن النور' }, area: 'oct6-zone-1', sector: 'animal-feed',
  location: { lat: 30.1, lng: 31.2, accuracyM: null, pinMoved: true },
  productsMade: [{ name: { en: 'Poultry feed', ar: 'علف دواجن' }, hs: { heading: '2309', sub: '230990' } }],
  productsNeeded: [{ name: { en: 'Maize' }, hs: { heading: '1005' } }, { name: { en: 'Soy hulls', ar: 'قشر الصويا' } }],
  photoCount: 2, status: 'approved', createdBy: 'u', createdAt: new Date(), updatedAt: new Date(),
  approvedAt: new Date('2026-10-05T12:00:00Z'),
}

function setup(entry: string | { pathname: string; state?: unknown } = '/f/f1') {
  const router = createMemoryRouter(
    [{ path: '/f/:id', element: <FactoryPage /> }, { path: '/map', element: <p>map page</p> }],
    { initialEntries: [entry] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  initI18n()
  setLanguage('en')
  auth.user = null
  mapProps.length = 0
  signInWithGoogle.mockClear()
  loadPublicFactory.mockReset().mockResolvedValue(factory)
  loadPhotos.mockReset().mockResolvedValue([{ id: 'p1', data: IMG }, { id: 'p2', data: IMG }])
  loadContact.mockReset().mockResolvedValue({ phone: '0100 123 4567', whatsapp: '01001234567', website: 'example.com', facebook: 'javascript:alert(1)', contactPerson: 'Hassan' })
})

describe('FactoryPage', () => {
  it('renders one h1 with the name, the other name, lists and HS badges', async () => {
    setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'Al-Nour Feed Mills' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('مطاحن النور')).toHaveAttribute('lang', 'ar')
    expect(screen.getByText('Poultry feed')).toBeInTheDocument()
    expect(screen.getByText('2309.90')).toBeInTheDocument()
    expect(screen.getByText('1005')).toBeInTheDocument()
    expect(screen.getByText(/Verified on site · Oct 5, 2026/)).toBeInTheDocument()
  })

  it('"Who supplies this?" links by hs, else by name', async () => {
    setup()
    await screen.findByRole('heading', { level: 1 })
    const links = screen.getAllByRole('link', { name: /Who supplies this/ })
    expect(links[0]).toHaveAttribute('href', '/map?hs=1005')
    expect(links[1]).toHaveAttribute('href', '/map?q=Soy+hulls')
  })

  it('signed out: locked contacts with no data, Google button, no contact read', async () => {
    setup()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('Sign in to see contacts')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(signInWithGoogle).toHaveBeenCalled()
    expect(loadContact).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Hassan')
  })

  it('signed in: contact links normalized, unsafe facebook not linked', async () => {
    auth.user = { uid: 'u1' }
    setup()
    expect(await screen.findByText('Hassan')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: 'Contacts' })
    expect(within(section).getByRole('link', { name: /0100 123 4567/ })).toHaveAttribute('href', 'tel:01001234567')
    expect(within(section).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/201001234567')
    expect(within(section).getByRole('link', { name: /example\.com/ })).toHaveAttribute('href', 'https://example.com/')
    expect(within(section).queryByRole('link', { name: /Facebook/ })).toBeNull()
  })

  it('contact load error shows a banner with retry; empty shows the empty text', async () => {
    auth.user = { uid: 'u1' }
    loadContact.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({})
    setup()
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No contact details shared')).toBeInTheDocument()
  })

  it('missing or denied factory is a friendly not found with a map link', async () => {
    loadPublicFactory.mockResolvedValue(null)
    setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'Factory not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the map' })).toHaveAttribute('href', '/map')
  })

  it('shows the Demo badge for sample factories', async () => {
    loadPublicFactory.mockResolvedValue({ ...factory, sample: true })
    setup()
    expect(await screen.findByText('Demo')).toBeInTheDocument()
  })

  it('Directions opens Google Maps safely', async () => {
    setup()
    const a = await screen.findByRole('link', { name: 'Directions' })
    expect(a).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=30.1,31.2')
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('mini map is static with one pin', async () => {
    setup()
    await screen.findByTestId('map')
    expect(mapProps[0]).toMatchObject({ dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, keyboard: false })
    expect(screen.getAllByTestId('pin')).toHaveLength(1)
  })

  it('photos carry alt text and the carousel navigates', async () => {
    setup()
    expect(await screen.findByAltText('Photo 1 of 2 — Al-Nour Feed Mills')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByAltText('Photo 2 of 2 — Al-Nour Feed Mills')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to photo 2' })).toHaveAttribute('aria-current', 'true')
  })

  it('shows placeholder art when there are no photos', async () => {
    loadPhotos.mockResolvedValue([])
    setup()
    await screen.findByRole('heading', { level: 1 })
    expect(await screen.findByAltText('No photos yet')).toBeInTheDocument()
  })

  it('back link returns to the previous map url, else /map', async () => {
    setup({ pathname: '/f/f1', state: { from: '/map?q=feed' } })
    expect(await screen.findByRole('link', { name: 'Back to the map' })).toHaveAttribute('href', '/map?q=feed')
  })

  it('back link defaults to /map', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('link', { name: 'Back to the map' })).toHaveAttribute('href', '/map'))
  })
  it('signed in but contact read denied: neutral message, no sign-in prompt', async () => {
    auth.user = { uid: 'u1' }
    loadContact.mockResolvedValue(null)
    setup()
    expect(await screen.findByText("Contact details aren't available to your account.")).toBeInTheDocument()
    expect(screen.queryByText('Sign in to see contacts')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
  })

  it('signing out removes the previous contact data from the DOM', async () => {
    auth.user = { uid: 'u1' }
    const router = setup()
    expect(await screen.findByText('Hassan')).toBeInTheDocument()
    auth.user = null
    await act(() => router.navigate('/f/f1?r=1'))
    expect(screen.queryByText('Hassan')).toBeNull()
    expect(screen.getByText('Sign in to see contacts')).toBeInTheDocument()
  })

  it('no "No photos yet" text while photos load', async () => {
    loadPhotos.mockReturnValue(new Promise(() => {}))
    setup()
    await screen.findByRole('heading', { level: 1, name: 'Al-Nour Feed Mills' })
    expect(screen.queryByAltText('No photos yet')).toBeNull()
  })

  it('loading and error states each have one h1; error retries', async () => {
    loadPublicFactory.mockRejectedValueOnce(new Error('x'))
    setup()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Al-Nour Feed Mills' })).toBeInTheDocument()
  })

  it('a late response for the old id does not overwrite the new one', async () => {
    let resolveOld: (f: Factory) => void = () => {}
    loadPublicFactory.mockImplementation((id: string) =>
      id === 'f1' ? new Promise((r) => { resolveOld = r }) : Promise.resolve({ ...factory, id: 'f2', name: { en: 'Second Mill' } }),
    )
    const router = setup()
    await act(() => router.navigate('/f/f2'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Second Mill' })).toBeInTheDocument()
    await act(async () => resolveOld(factory))
    expect(screen.getByRole('heading', { level: 1, name: 'Second Mill' })).toBeInTheDocument()
  })
})
