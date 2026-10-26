import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { initI18n } from '../i18n'
import { RouteError } from './RouteError'

const reload = vi.fn()
const realLocation = window.location
beforeEach(() => {
  initI18n()
  reload.mockReset()
  Object.defineProperty(window, 'location', { value: { ...realLocation, reload }, configurable: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  Object.defineProperty(window, 'location', { value: realLocation, configurable: true })
  vi.restoreAllMocks()
})

function Boom(): never {
  throw new Error('render exploded')
}

describe('RouteError', () => {
  it('shows a generic message and a Reload button that does a full reload', async () => {
    const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteError /> }])
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.queryByText(/render exploded/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a failed dynamic import (stale chunk) is handled by the same boundary', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        lazy: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /hscode/assets/x-OLD.js')),
        errorElement: <RouteError />,
      },
    ])
    render(<RouterProvider router={router} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
