import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'

vi.mock('../client/MapHome', () => ({ Component: () => <p>map home</p> }))

import { BASENAME, routes, withBaseSlash } from './router'

describe('routes', () => {
  it('renders the client map at /', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('map home')).toBeInTheDocument()
  })

  it('redirects /map to / keeping the query and hash, replacing history', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/map?q=x&near=1#h'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('map home')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toBe('?q=x&near=1')
    expect(router.state.location.hash).toBe('#h')
    expect(router.state.historyAction).toBe('REPLACE')
  })
})

describe('basename', () => {
  // The service worker and manifest scope is /hscode/: the root map must live at /hscode/, never /hscode
  // (outside the scope, and a reload there is not the app on the Vite dev/preview server).
  it('links the root map to /hscode/ and keeps the other paths under it', async () => {
    const router = createMemoryRouter(
      [{ path: '/', element: <><Link to="/?q=feed">root</Link><Link to="/f/a">factory</Link></> }],
      { basename: BASENAME, initialEntries: ['/hscode/'] },
    )
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('link', { name: 'root' })).toHaveAttribute('href', '/hscode/?q=feed')
    expect(screen.getByRole('link', { name: 'factory' })).toHaveAttribute('href', '/hscode/f/a')
  })

  it('maps a hard load of /hscode (no slash) to /hscode/, keeping the query and hash', () => {
    expect(withBaseSlash({ pathname: '/hscode', search: '?q=feed&near=1', hash: '#h' })).toBe('/hscode/?q=feed&near=1#h')
    expect(withBaseSlash({ pathname: '/hscode/', search: '?q=x', hash: '' })).toBeNull()
    expect(withBaseSlash({ pathname: '/hscode/f/a', search: '', hash: '' })).toBeNull()
  })
})
