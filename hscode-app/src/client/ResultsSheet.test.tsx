import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { initI18n, setLanguage } from '../i18n'
import en from '../i18n/en.json'
import ar from '../i18n/ar.json'
import { MemoryRouter } from 'react-router'
import { ResultsSheet } from './ResultsSheet'

function renderEmpty(lang: 'en' | 'ar', desktop = false) {
  return render(
    <ResultsSheet entries={[]} loading={false} lang={lang} desktop={desktop} onSelect={vi.fn()} onTry={vi.fn()} />,
  )
}

describe('ResultsSheet empty state', () => {
  beforeEach(() => initI18n())
  afterEach(() => setLanguage('en'))

  it.each([false, true])('in Arabic the "no factories" title appears once (desktop=%s)', (desktop) => {
    setLanguage('ar')
    renderEmpty('ar', desktop)
    expect(screen.getAllByText(ar.map.emptyTitle)).toHaveLength(1)
    // The h2 is the count, as in English ("0 factories"), not a second copy of the empty title.
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(ar.map.emptyTitle)
  })

  it('in English the title appears once and the h2 is the count', () => {
    setLanguage('en')
    renderEmpty('en')
    expect(screen.getAllByText(en.map.emptyTitle)).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('0 factories')
  })

  it('the English suggestion chips are English: no Arabic text', () => {
    setLanguage('en')
    renderEmpty('en')
    const chips = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(chips).toContain(en.home.chipHs)
    expect(chips).toContain(en.home.chipFeed)
    for (const c of chips) expect(c).not.toMatch(/[؀-ۿ]/)
  })

  it('the Arabic suggestion chips are Arabic', () => {
    setLanguage('ar')
    renderEmpty('ar')
    const chips = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(chips).toContain(ar.home.chipFeed)
    expect(ar.home.chipFeed).toMatch(/[؀-ۿ]/)
  })
})

describe('ResultsSheet scroll cue (phone)', () => {
  beforeEach(() => initI18n())

  const entry = (i: number) => ({ id: `f${i}`, n: { en: `Factory ${i}` }, lat: 30, lng: 31, a: 'oct6-zone-1', m: [], d: [] })
  const list = () => screen.getByTestId('sheet-list')
  // jsdom has no layout: give the list a size, then fire a scroll.
  const layout = (el: HTMLElement, scrollHeight: number, clientHeight: number, scrollTop = 0) => {
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
    el.scrollTop = scrollTop
    fireEvent.scroll(el)
  }

  it('the phone list carries the amber scrollbar; the desktop column does not', () => {
    const { unmount } = render(<MemoryRouter><ResultsSheet entries={[entry(1)]} loading={false} lang="en" desktop={false} onSelect={vi.fn()} onTry={vi.fn()} /></MemoryRouter>)
    expect(list()).toHaveClass('sheet-scroll')
    unmount()
    render(<MemoryRouter><ResultsSheet entries={[entry(1)]} loading={false} lang="en" desktop onSelect={vi.fn()} onTry={vi.fn()} /></MemoryRouter>)
    expect(list()).not.toHaveClass('sheet-scroll')
  })

  it('shows a bottom fade while more cards are below, and hides it at the end', () => {
    render(<MemoryRouter><ResultsSheet entries={[1, 2, 3, 4, 5].map(entry)} loading={false} lang="en" desktop={false} onSelect={vi.fn()} onTry={vi.fn()} /></MemoryRouter>)
    expect(screen.queryByTestId('sheet-more')).toBeNull()
    layout(list(), 900, 300, 0)
    expect(screen.getByTestId('sheet-more')).toBeInTheDocument()
    layout(list(), 900, 300, 600)
    expect(screen.queryByTestId('sheet-more')).toBeNull()
  })

  it('shows no fade when everything fits', () => {
    render(<MemoryRouter><ResultsSheet entries={[entry(1)]} loading={false} lang="en" desktop={false} onSelect={vi.fn()} onTry={vi.fn()} /></MemoryRouter>)
    layout(list(), 300, 300, 0)
    expect(screen.queryByTestId('sheet-more')).toBeNull()
  })

  it('draws an amber scroll thumb sized to the visible share and moved by scrolling', () => {
    render(<MemoryRouter><ResultsSheet entries={[1, 2, 3, 4, 5].map(entry)} loading={false} lang="en" desktop={false} onSelect={vi.fn()} onTry={vi.fn()} /></MemoryRouter>)
    layout(list(), 1000, 250, 0)
    const thumb = screen.getByTestId('sheet-thumb')
    // Track = the list height minus 8px of inset: 242px; thumb = 25% of it.
    expect(thumb.style.height).toBe('60.5px')
    expect(thumb.style.transform).toBe('translateY(0px)')
    layout(list(), 1000, 250, 750)
    expect(thumb.style.transform).toBe('translateY(181.5px)')
  })

  it('draws no thumb when everything fits, and none on desktop', () => {
    const { unmount } = render(<MemoryRouter><ResultsSheet entries={[entry(1)]} loading={false} lang="en" desktop={false} onSelect={vi.fn()} onTry={vi.fn()} /></MemoryRouter>)
    layout(list(), 300, 300, 0)
    expect(screen.queryByTestId('sheet-thumb')).toBeNull()
    unmount()
    render(<MemoryRouter><ResultsSheet entries={[1, 2, 3].map(entry)} loading={false} lang="en" desktop onSelect={vi.fn()} onTry={vi.fn()} /></MemoryRouter>)
    layout(list(), 1000, 250, 0)
    expect(screen.queryByTestId('sheet-thumb')).toBeNull()
  })
})
