import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { initI18n, setLanguage } from '../i18n'
import type { IndexEntry } from '../lib/types'

vi.mock('../firebase', () => ({ db: {} }))
const getDoc = vi.fn()
vi.mock('firebase/firestore', () => ({ doc: () => ({}), getDoc: (...a: unknown[]) => getDoc(...a) }))

import { FactoryCard } from './FactoryCard'

const base: IndexEntry = {
  id: 'c1', n: { ar: 'مصنع الدلتا' }, lat: 30, lng: 31, a: 'oct6-zone-1', s: 'animal-feed',
  m: [1, 2, 3, 4].map((i) => ({ n: { en: `Made ${i}` } })),
  d: [{ n: { en: 'Maize' }, h: '1005' }],
}
const show = (e: IndexEntry, p: Partial<React.ComponentProps<typeof FactoryCard>> = {}) =>
  render(<MemoryRouter><FactoryCard entry={e} lang="en" onSelect={() => {}} {...p} /></MemoryRouter>)

beforeEach(() => {
  initI18n()
  setLanguage('en')
  getDoc.mockReset()
  getDoc.mockResolvedValue({ exists: () => false })
})

describe('FactoryCard', () => {
  it('falls back to the other language name inside bdi', () => {
    show(base)
    expect(screen.getByText('مصنع الدلتا').tagName).toBe('BDI')
  })

  it('shows the top 3 made products only, area and sector labels', () => {
    show(base)
    expect(screen.getByText(/Made 3/)).toBeInTheDocument()
    expect(screen.queryByText(/Made 4/)).toBeNull()
    expect(screen.getByText(/Animal feed/)).toBeInTheDocument()
  })

  it('needed products only when showNeeds', () => {
    const { unmount } = show(base)
    expect(screen.queryByText('1005')).toBeNull()
    unmount()
    show(base, { showNeeds: true })
    expect(screen.getByText('1005')).toBeInTheDocument()
  })

  it('Demo badge only for samples', () => {
    const { unmount } = show(base)
    expect(screen.queryByText('Demo')).toBeNull()
    unmount()
    show({ ...base, x: true })
    expect(screen.getByText('Demo')).toBeInTheDocument()
  })

  it('formats distance per locale and omits it when unknown', () => {
    const { unmount } = show(base, { distanceKm: 2.44 })
    expect(screen.getByText('2.4 km')).toBeInTheDocument()
    unmount()
    setLanguage('ar')
    show(base, { distanceKm: 2.44, lang: 'ar' })
    expect(screen.getByText(/كم$/)).toBeInTheDocument()
  })

  it('renders a safe thumb, rejects an unsafe one, reads each id once', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ thumb: 'data:image/png;base64,AAAA' }) })
    const { unmount } = show({ ...base, id: 'safe1' })
    const img = await screen.findByAltText('')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    unmount()
    show({ ...base, id: 'safe1' })
    await screen.findByAltText('')
    expect(getDoc).toHaveBeenCalledTimes(1)

    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ thumb: 'https://evil/x.png' }) })
    show({ ...base, id: 'unsafe1' })
    await vi.waitFor(() => expect(getDoc).toHaveBeenCalledTimes(2))
    expect(document.querySelector('img[src^="https://evil"]')).toBeNull()
  })
})
