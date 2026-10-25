import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { initI18n } from '../i18n'
import type { IndexEntry } from '../lib/types'

vi.mock('../firebase', () => ({ db: {}, auth: {} }))
const signInWithGoogle = vi.fn()
vi.mock('../auth/api', () => ({ signInWithGoogle: (...a: unknown[]) => signInWithGoogle(...a), signOutUser: vi.fn() }))
vi.mock('firebase/firestore', () => ({ doc: () => ({}), getDoc: vi.fn().mockResolvedValue({ exists: () => false }) }))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

const loadIndex = vi.fn()
vi.mock('../search/indexSource', () => ({ loadIndex: () => loadIndex() }))

const near = { status: 'idle' as string, pos: undefined as { lat: number; lng: number } | undefined, request: vi.fn() }
vi.mock('./useNearMe', () => ({ useNearMe: () => near }))

vi.mock('../map/ResultsMap', () => ({
  ResultsMap: ({ entries, onSelect, userPos }: { entries: IndexEntry[]; onSelect: (id: string) => void; userPos?: unknown }) => (
    <div data-testid="map" data-user={userPos ? 'yes' : 'no'}>
      {entries.map((e) => (
        <button key={e.id} type="button" data-testid={`pin-${e.id}`} onClick={() => onSelect(e.id)} />
      ))}
    </div>
  ),
}))

import { Component as MapHome } from './MapHome'

const entry = (id: string, en: string, lat: number, at: number, extra: Partial<IndexEntry> = {}): IndexEntry => ({
  id, n: { en }, lat, lng: 31, a: 'oct6-zone-1', m: [], d: [], at, ...extra,
})
const ENTRIES: IndexEntry[] = [
  entry('f1', 'Delta Feed Mill', 30.5, 300, { s: 'animal-feed', m: [{ n: { en: 'Poultry feed', ar: 'علف دواجن' }, h: '230990' }] }),
  entry('f2', 'Maize Growers', 30.0, 200, { s: 'food', m: [{ n: { en: 'Maize' }, h: '1005' }] }),
  entry('f3', 'Nile Fodder', 30.01, 100, { s: 'animal-feed', x: true, m: [{ n: { en: 'Fodder', ar: 'علف ماشية' }, h: '2309' }] }),
]

function Probe() {
  return <output data-testid="loc">{useLocation().search}</output>
}
function setup(url = '/map') {
  const router = createMemoryRouter(
    [{ path: '/map', element: (<><MapHome /><Probe /></>) }, { path: '*', element: <p>other</p> }],
    { initialEntries: [url] },
  )
  render(<RouterProvider router={router} />)
  return router
}
const names = () => screen.getAllByRole('article').map((a) => within(a).getByRole('heading', { level: 3 }).textContent)

beforeEach(() => {
  initI18n()
  loadIndex.mockReset()
  loadIndex.mockResolvedValue({ entries: ENTRIES, fromCache: false })
  near.status = 'idle'
  near.pos = undefined
  near.request.mockReset()
})

describe('MapHome', () => {
  it('has a search landmark, one h1 and a labelled combobox', async () => {
    setup()
    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('combobox', { name: 'Search factories' })).toBeInTheDocument()
    await screen.findAllByRole('article')
  })

  it('typing «علف» shows grouped suggestions as listbox/options', async () => {
    setup()
    await screen.findAllByRole('article')
    await userEvent.type(screen.getByRole('combobox'), 'علف')
    const list = await screen.findByRole('listbox')
    expect(within(list).getAllByRole('group').length).toBeGreaterThan(0)
    expect(await within(list).findByRole('option', { name: /Poultry feed/ })).toBeInTheDocument()
  })

  it('Enter runs the search: matching factories listed and q in the URL', async () => {
    setup()
    await screen.findAllByRole('article')
    await userEvent.type(screen.getByRole('combobox'), 'علف{Enter}')
    expect(screen.getByTestId('loc').textContent).toContain('q=')
    expect(names().sort()).toEqual(['Delta Feed Mill', 'Nile Fodder'])
  })

  it('the Sector chip filters', async () => {
    setup()
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: 'Sector' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Food and beverages' }))
    expect(names()).toEqual(['Maize Growers'])
    expect(screen.getByTestId('loc').textContent).toContain('sector=food')
  })

  it('Near me ok: distances shown and sorted ascending', async () => {
    near.status = 'ok'
    near.pos = { lat: 30, lng: 31 }
    setup()
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: /Near me/ }))
    expect(near.request).toHaveBeenCalled()
    expect(names()).toEqual(['Maize Growers', 'Nile Fodder', 'Delta Feed Mill'])
    expect(screen.getAllByText(/km$/).length).toBe(3)
    expect(screen.getByTestId('map')).toHaveAttribute('data-user', 'yes')
  })

  it('Near me denied: a message, toggled off, original order', async () => {
    near.status = 'denied'
    setup()
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: /Near me/ }))
    expect(await screen.findByText(/Location is blocked/)).toBeInTheDocument()
    expect(screen.getByTestId('loc').textContent).not.toContain('near')
    expect(names()).toEqual(['Delta Feed Mill', 'Maize Growers', 'Nile Fodder'])
  })

  it('selecting a card sets sel; View factory links to /f/<id>', async () => {
    setup()
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: /Maize Growers/ }))
    expect(screen.getByTestId('loc').textContent).toContain('sel=f2')
    const card = screen.getAllByRole('article').find((a) => within(a).queryByText('Maize Growers'))!
    expect(card).toHaveAttribute('aria-current', 'true')
    expect(within(card).getByRole('link', { name: 'View factory' })).toHaveAttribute('href', '/f/f2')
  })

  it('selecting a pin sets sel', async () => {
    setup()
    await userEvent.click(await screen.findByTestId('pin-f3'))
    expect(screen.getByTestId('loc').textContent).toContain('sel=f3')
  })

  it('index error: denied banner, Retry loads again', async () => {
    loadIndex.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'denied' }))
    setup()
    expect(await screen.findByText(/can't be reached/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(loadIndex).toHaveBeenCalledTimes(2)
    expect(await screen.findAllByRole('article')).toHaveLength(3)
  })

  it('empty results show the empty state', async () => {
    setup('/map?q=zzzzqq')
    expect(await screen.findByText('No factories found')).toBeInTheDocument()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('shows the Demo badge for sample factories and the saved-results note from cache', async () => {
    loadIndex.mockResolvedValue({ entries: ENTRIES, fromCache: true })
    setup()
    await screen.findAllByRole('article')
    expect(screen.getAllByText('Demo')).toHaveLength(1)
    expect(screen.getByText('Showing saved results')).toBeInTheDocument()
  })

  it('loads the index once and does not reload on typing', async () => {
    setup()
    await screen.findAllByRole('article')
    await userEvent.type(screen.getByRole('combobox'), 'ab')
    expect(loadIndex).toHaveBeenCalledTimes(1)
  })

  it('arriving with near=1 does not ask for location and drops the param', async () => {
    setup('/map?near=1')
    await screen.findAllByRole('article')
    expect(near.request).not.toHaveBeenCalled()
    expect(screen.getByTestId('loc').textContent).not.toContain('near')
  })

  it('Back steps through committed searches', async () => {
    const router = setup()
    await screen.findAllByRole('article')
    const box = screen.getByRole('combobox')
    await userEvent.type(box, 'maize{Enter}')
    await userEvent.clear(box)
    await userEvent.type(box, 'fodder{Enter}')
    expect(screen.getByTestId('loc').textContent).toContain('q=fodder')
    await act(() => router.navigate(-1))
    expect(screen.getByTestId('loc').textContent).toContain('q=maize')
  })

  it('selecting two cards then Back returns to the search without a selection', async () => {
    const router = setup()
    await screen.findAllByRole('article')
    await userEvent.type(screen.getByRole('combobox'), 'maize{Enter}')
    await userEvent.click(screen.getByTestId('pin-f2'))
    await userEvent.click(screen.getByTestId('pin-f2'))
    await act(() => router.navigate(-1))
    expect(screen.getByTestId('loc').textContent).toContain('q=maize')
    expect(screen.getByTestId('loc').textContent).not.toContain('sel')
  })

  it('an index error shows no count or empty state', async () => {
    loadIndex.mockRejectedValue(Object.assign(new Error('x'), { code: 'offline' }))
    setup()
    await screen.findByRole('button', { name: 'Retry' })
    expect(screen.queryByText('0 factories')).toBeNull()
    expect(screen.queryByText('No factories found')).toBeNull()
  })

  it('a failed sign-in shows an error, a closed popup does not', async () => {
    signInWithGoogle.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' }))
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await vi.waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/went wrong/)).toBeNull()
    signInWithGoogle.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/network-request-failed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/went wrong/)).toBeInTheDocument()
  })
})
