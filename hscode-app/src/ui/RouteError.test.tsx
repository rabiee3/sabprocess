import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { initI18n } from '../i18n'
import { RouteError } from './RouteError'

const reportError = vi.fn()
vi.mock('../telemetry/reportError', () => ({ reportError: (...a: unknown[]) => reportError(...a) }))

const pwa = vi.hoisted(() => ({ needRefresh: false, update: vi.fn() }))
vi.mock('../pwa/usePwa', () => ({
  usePwa: () => ({ ...pwa, canInstall: false, install: vi.fn(), isIosSafari: false }),
}))

const reload = vi.fn()
const realLocation = window.location
beforeEach(() => {
  initI18n()
  reload.mockReset()
  reportError.mockReset()
  pwa.needRefresh = false
  pwa.update.mockReset()
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

  it('reports the error to Analytics as a route error, once', async () => {
    const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteError /> }])
    render(<RouterProvider router={router} />)
    await screen.findByRole('button', { name: 'Reload' })
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'render exploded' }), 'route')
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

  it('after a deploy, Reload activates the waiting service worker instead of reloading the stale shell', async () => {
    pwa.needRefresh = true
    const router = createMemoryRouter([
      {
        path: '/',
        lazy: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /hscode/assets/x-OLD.js')),
        errorElement: <RouteError />,
      },
    ])
    render(<RouterProvider router={router} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reload' }))
    expect(pwa.update).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
  })

  it('a waiting worker found only now (update not yet known) gets SKIP_WAITING, then the page reloads', async () => {
    const listeners: (() => void)[] = []
    const waiting = { state: 'installed', postMessage: vi.fn(), addEventListener: vi.fn() }
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: async () => ({ update: async () => undefined, waiting, installing: null }),
        addEventListener: (type: string, l: () => void) => type === 'controllerchange' && listeners.push(l),
      },
    })
    try {
      const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteError /> }])
      render(<RouterProvider router={router} />)
      await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
      await vi.waitFor(() => expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
      expect(reload).not.toHaveBeenCalled()
      listeners.forEach((l) => l())
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker
    }
  })
})
