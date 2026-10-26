import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'

vi.mock('../client/MapHome', () => ({ Component: () => <p>map home</p> }))

import { routes } from './router'

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
