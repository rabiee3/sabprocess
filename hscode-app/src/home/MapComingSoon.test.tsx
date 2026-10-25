import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { initI18n, setLanguage } from '../i18n'

vi.mock('../firebase', () => ({ db: {} }))
const getDoc = vi.fn()
vi.mock('firebase/firestore', () => ({ doc: () => ({}), getDoc: (...a: unknown[]) => getDoc(...a) }))

import { Component as MapComingSoon } from './MapComingSoon'

function setup(url = '/map') {
  render(<RouterProvider router={createMemoryRouter([{ path: '/map', element: <MapComingSoon /> }, { path: '/', element: <p>home</p> }], { initialEntries: [url] })} />)
}

describe('MapComingSoon', () => {
  beforeEach(() => {
    initI18n()
    getDoc.mockReset()
  })

  it('shows the heading, the factory count and the query', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ entries: [{}, {}, {}] }) })
    setup('/map?q=%D8%B9%D9%84%D9%81')
    expect(screen.getByRole('heading', { level: 1, name: 'The map is opening soon' })).toBeInTheDocument()
    expect(await screen.findByText('3 factories mapped so far')).toBeInTheDocument()
    expect(screen.getByText('علف').tagName).toBe('BDI')
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/')
  })

  it('hides the counter on error', async () => {
    getDoc.mockRejectedValue(new Error('x'))
    setup()
    await vi.waitFor(() => expect(getDoc).toHaveBeenCalled())
    expect(screen.queryByText(/factories mapped/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hides the counter when the shard is missing', async () => {
    getDoc.mockResolvedValue({ exists: () => false })
    setup()
    await vi.waitFor(() => expect(getDoc).toHaveBeenCalled())
    expect(screen.queryByText(/factories mapped/)).toBeNull()
  })

  it.each([
    ['en', 1, '1 factory mapped so far'],
    ['en', 3, '3 factories mapped so far'],
    ['ar', 1, 'مصنع واحد على الخريطة حتى الآن'],
    ['ar', 2, 'مصنعان على الخريطة حتى الآن'],
    ['ar', 5, '5 مصانع على الخريطة حتى الآن'],
    ['ar', 11, '11 مصنعًا على الخريطة حتى الآن'],
  ] as const)('pluralises correctly (%s, %i)', async (lang, n, text) => {
    setLanguage(lang)
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ entries: Array.from({ length: n }, () => ({})) }) })
    setup()
    expect(await screen.findByText(text)).toBeInTheDocument()
    setLanguage('en')
  })
})
