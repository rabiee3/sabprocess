import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { initI18n } from '../i18n'
import type { IndexEntry } from '../lib/types'
import { safeStorage } from '../lib/safeStorage'

vi.mock('../firebase', () => ({ db: {}, auth: {} }))
const signInWithGoogle = vi.fn()
vi.mock('../auth/api', () => ({ signInWithGoogle: (...a: unknown[]) => signInWithGoogle(...a) }))
vi.mock('../auth/signOutAndWipe', () => ({ signOutAndWipe: vi.fn() }))
vi.mock('firebase/firestore', () => ({ doc: () => ({}), getDoc: vi.fn().mockResolvedValue({ exists: () => false }) }))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

const loadIndex = vi.fn()
vi.mock('../search/indexSource', () => ({ loadIndex: (...a: unknown[]) => loadIndex(...a) }))

// The HS table: who asks for it (SearchBar asks only once someone types).
const loadHsTable = vi.fn(() => new Promise(() => {}))
const hsWanted = vi.fn()
vi.mock('../hs/lazyTable', () => ({
  loadHsTable: () => loadHsTable(),
  useHsTable: (enabled = true) => {
    if (enabled) hsWanted()
    return { table: null, failed: false }
  },
}))

const near = { status: 'idle' as string, pos: undefined as { lat: number; lng: number } | undefined, request: vi.fn() }
vi.mock('./useNearMe', () => ({ useNearMe: () => near }))

const mapProps = vi.hoisted(() => ({ last: {} as Record<string, unknown> }))
vi.mock('../map/ResultsMap', () => ({
  ResultsMap: ({ entries, onSelect, userPos, ...rest }: { entries: IndexEntry[]; onSelect: (id: string) => void; userPos?: unknown }) => (
    (mapProps.last = rest),
    <div data-testid="map" data-user={userPos ? 'yes' : 'no'}>
      {entries.map((e) => (
        <button key={e.id} type="button" data-testid={`pin-${e.id}`} onClick={() => onSelect(e.id)} />
      ))}
    </div>
  ),
}))

const createEngineSpy = vi.fn()
vi.mock('minisearch', async (orig) => {
  const actual = await orig<typeof import('minisearch')>()
  class Counted extends actual.default {
    constructor(...a: ConstructorParameters<typeof actual.default>) {
      super(...a)
      createEngineSpy()
    }
  }
  return { ...actual, default: Counted }
})

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
function setup(url = '/') {
  const router = createMemoryRouter(
    [{ path: '/', element: (<><MapHome /><Probe /></>) }, { path: '*', element: <p>other</p> }],
    { initialEntries: [url] },
  )
  render(<RouterProvider router={router} />)
  return router
}
const names = () => screen.getAllByRole('article').map((a) => within(a).getByRole('heading', { level: 3 }).textContent)

beforeEach(() => {
  initI18n()
  safeStorage.set('hscode.introSeen', '1') // the first-visit intro has its own describe below
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
    setup('/?q=zzzzqq')
    expect(await screen.findByText('No factories found')).toBeInTheDocument()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('on a phone the map gets the sheet height and the search overlay to pad its fit; expanding the sheet grows it', async () => {
    setup()
    await screen.findAllByRole('article')
    expect(mapProps.last.desktop).toBe(false)
    const ref = mapProps.last.topOverlayRef as { current: HTMLElement | null }
    expect(ref.current).not.toBeNull()
    expect(within(ref.current!).getByRole('combobox')).toBeInTheDocument()
    const collapsed = mapProps.last.sheetPx as number
    expect(collapsed).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Expand or collapse results' }))
    await waitFor(() => expect(mapProps.last.sheetPx as number).toBeGreaterThan(collapsed))
  })

  it('shows the Demo badge for sample factories and the saved-results note from cache while offline', async () => {
    loadIndex.mockResolvedValue({ entries: ENTRIES, fromCache: true })
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      setup()
      await screen.findAllByRole('article')
      expect(screen.getAllByText('Demo')).toHaveLength(1)
      expect(screen.getByText('Showing saved results')).toBeInTheDocument()
    } finally {
      online.mockRestore()
    }
  })

  it('a cached index shown while online has no saved-results note (it is being revalidated)', async () => {
    loadIndex.mockResolvedValue({ entries: ENTRIES, fromCache: true })
    setup()
    await screen.findAllByRole('article')
    expect(screen.queryByText('Showing saved results')).toBeNull()
  })

  it('loads the index once and does not reload on typing', async () => {
    setup()
    await screen.findAllByRole('article')
    await userEvent.type(screen.getByRole('combobox'), 'ab')
    expect(loadIndex).toHaveBeenCalledTimes(1)
  })

  it('arriving with near=1 does not ask for location and drops the param', async () => {
    setup('/?near=1')
    await screen.findAllByRole('article')
    expect(near.request).not.toHaveBeenCalled()
    expect(screen.getByTestId('loc').textContent).not.toContain('near')
  })

  it('arriving with near=1 and a recent location fix keeps near and sorts by distance, without asking again', async () => {
    near.status = 'ok'
    near.pos = { lat: 30, lng: 31 }
    setup('/?near=1')
    await screen.findAllByRole('article')
    expect(near.request).not.toHaveBeenCalled()
    expect(screen.getByTestId('loc').textContent).toContain('near=1')
    expect(names()).toEqual(['Maize Growers', 'Nile Fodder', 'Delta Feed Mill'])
  })

  it('a quota error on the index shows the service-busy message with Retry', async () => {
    loadIndex.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'quota' }))
    setup()
    expect(await screen.findByText('The service is busy right now — please try again later')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('closing the Near me message hides it; a new failed request shows it again', async () => {
    near.status = 'denied'
    setup()
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: /Near me/ }))
    const msg = await screen.findByText(/Location is blocked/)
    await userEvent.click(within(msg.closest('[role="status"]') as HTMLElement).getByRole('button'))
    expect(screen.queryByText(/Location is blocked/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Near me/ }))
    expect(await screen.findByText(/Location is blocked/)).toBeInTheDocument()
  })

  it('a new result list starts again at the first page of cards', async () => {
    const many = Array.from({ length: 60 }, (_, i) => entry(`m${i}`, `Mill ${i}`, 30 + i / 100, i))
    loadIndex.mockResolvedValue({ entries: many, fromCache: false })
    setup()
    await screen.findAllByRole('article')
    expect(screen.getAllByRole('article')).toHaveLength(50)
    await userEvent.click(screen.getByRole('button', { name: /show more/i }))
    expect(screen.getAllByRole('article')).toHaveLength(60)
    await userEvent.type(screen.getByRole('combobox'), 'mill{Enter}')
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(50))
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
    // The search box follows at once.
    expect(box).toHaveValue('maize')
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
    // Let the rejection settle first: asserted at once, a wrongly shown error would not be on screen yet.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.queryByText(/went wrong/)).toBeNull()
    signInWithGoogle.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/network-request-failed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/went wrong/)).toBeInTheDocument()
  })

  it('two mounts with the same entries build the search engine once', async () => {
    const shared = [...ENTRIES]
    loadIndex.mockResolvedValue({ entries: shared, fromCache: false })
    createEngineSpy.mockClear()
    const a = render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <MapHome /> }], { initialEntries: ['/'] })} />)
    await screen.findAllByRole('article')
    // The engine is built when the browser is idle; wait for it before unmounting.
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Search a product, HS code, or industry…'))
    a.unmount()
    render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <MapHome /> }], { initialEntries: ['/'] })} />)
    await screen.findAllByRole('article')
    // Ready at once on the remount: no "Preparing search…" and no second build.
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Search a product, HS code, or industry…')
    expect(createEngineSpy).toHaveBeenCalledTimes(1)
  })

  it('never preloads the HS table on the map (only typing in search fetches it)', async () => {
    loadHsTable.mockClear()
    hsWanted.mockClear()
    setup()
    await screen.findAllByRole('article')
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Search a product, HS code, or industry…'))
    await new Promise((r) => setTimeout(r, 50))
    expect(loadHsTable).not.toHaveBeenCalled()
    expect(hsWanted).not.toHaveBeenCalled()
    await userEvent.type(screen.getByRole('combobox'), 'f')
    expect(hsWanted).toHaveBeenCalled()
  })

  it('renders pins and cards from the entries before the search engine is built', async () => {
    const w = window as unknown as { requestIdleCallback?: unknown; cancelIdleCallback?: unknown }
    w.requestIdleCallback = vi.fn(() => 1) // the browser never gets idle in this test
    w.cancelIdleCallback = vi.fn()
    try {
      loadIndex.mockResolvedValue({ entries: [...ENTRIES], fromCache: false })
      setup()
      expect(await screen.findByTestId('pin-f1')).toBeInTheDocument()
      expect(screen.getByTestId('pin-f3')).toBeInTheDocument()
      expect(screen.getAllByRole('article')).toHaveLength(3)
      expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Preparing search…')
    } finally {
      delete w.requestIdleCallback
      delete w.cancelIdleCallback
    }
  })

  it('while the engine for a newer index builds, the previous results stay (no blank map)', async () => {
    let onUpdate: ((l: { entries: IndexEntry[]; fromCache: boolean }) => void) | undefined
    loadIndex.mockImplementation((_fs: unknown, cb: typeof onUpdate) => {
      onUpdate = cb
      return Promise.resolve({ entries: [...ENTRIES], fromCache: true })
    })
    setup('/?q=feed&sel=f1')
    await waitFor(() => expect(names()).toContain('Delta Feed Mill'))
    const w = window as unknown as { requestIdleCallback?: unknown; cancelIdleCallback?: unknown }
    w.requestIdleCallback = vi.fn(() => 1) // the new engine never gets built in this test
    w.cancelIdleCallback = vi.fn()
    try {
      const fresh = [...ENTRIES, entry('f4', 'Cairo Feed Co', 30.2, 400, { m: [{ n: { en: 'Fish feed' }, h: '2309' }] })]
      await act(async () => onUpdate?.({ entries: fresh, fromCache: false }))
      expect(w.requestIdleCallback).toHaveBeenCalled()
      expect(names()).toContain('Delta Feed Mill')
      expect(screen.getByTestId('pin-f1')).toBeInTheDocument()
    } finally {
      delete w.requestIdleCallback
      delete w.cancelIdleCallback
    }
  })

  it('a newer index from the server replaces the cached one and keeps the search and selection', async () => {
    let onUpdate: ((l: { entries: IndexEntry[]; fromCache: boolean }) => void) | undefined
    loadIndex.mockImplementation((_fs: unknown, cb: typeof onUpdate) => {
      onUpdate = cb
      return Promise.resolve({ entries: [...ENTRIES], fromCache: true })
    })
    setup('/?q=feed&sel=f1')
    await screen.findAllByRole('article')
    const fresh = [...ENTRIES, entry('f4', 'Cairo Feed Co', 30.2, 400, { m: [{ n: { en: 'Fish feed' }, h: '2309' }] })]
    await act(async () => onUpdate?.({ entries: fresh, fromCache: false }))
    await waitFor(() => expect(names()).toContain('Cairo Feed Co'))
    expect(names()).not.toContain('Maize Growers')
    expect(screen.getByTestId('loc').textContent).toBe('?q=feed&sel=f1')
    expect(screen.getByRole('combobox')).toHaveValue('feed')
  })
})

describe('MapHome first-visit intro', () => {
  beforeEach(() => safeStorage.remove('hscode.introSeen'))

  it('shows the intro dialog on a first visit and makes the map inert', async () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Who makes what. Who needs what.' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('main')).toHaveAttribute('inert')
    expect(screen.getByRole('banner')).not.toHaveAttribute('inert')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('main')).not.toHaveAttribute('inert')
    expect(safeStorage.get('hscode.introSeen')).toBe('1')
    await screen.findAllByRole('article')
  })

  it('closing a first-visit intro puts focus on the map search, not <body>', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('combobox', { name: 'Search factories' })).toHaveFocus()
  })

  it('on a touch screen it focuses the map heading instead, so no keyboard pops up', async () => {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q === '(pointer: coarse)', media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    try {
      setup()
      await userEvent.keyboard('{Escape}')
      expect(screen.getByRole('heading', { level: 1, name: 'Factory map' })).toHaveFocus()
    } finally {
      window.matchMedia = mm
    }
  })

  it('never shows on a deep link with a query', async () => {
    setup('/?q=maize')
    await screen.findAllByRole('article')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a search from the intro closes it and puts q in the URL', async () => {
    setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search factories' }), 'maize{Enter}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('loc').textContent).toBe('?q=maize')
    expect(await screen.findAllByRole('article')).toHaveLength(1)
  })

  it('"About HSCode" in the menu reopens it; closing returns focus to the menu button and keeps the key', async () => {
    safeStorage.set('hscode.introSeen', '1')
    const set = vi.spyOn(safeStorage, 'set')
    setup()
    await screen.findAllByRole('article')
    expect(screen.queryByRole('dialog')).toBeNull()
    const menu = screen.getByRole('button', { name: 'Menu' })
    await userEvent.click(menu)
    await userEvent.click(screen.getByRole('menuitem', { name: 'About HSCode' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('inert')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(menu).toHaveFocus()
    expect(set).not.toHaveBeenCalled()
    set.mockRestore()
  })

  it('the page has one admin link while the intro is open, and none once it is closed or the menu is open', async () => {
    setup()
    expect(document.querySelectorAll('a[href*="/admin"]')).toHaveLength(1)
    await userEvent.keyboard('{Escape}')
    expect(document.querySelectorAll('a[href*="/admin"]')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(document.querySelectorAll('a[href*="/admin"]')).toHaveLength(0)
  })
})
