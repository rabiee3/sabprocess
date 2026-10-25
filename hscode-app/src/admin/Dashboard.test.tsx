import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import type { Surveyor } from './types'

vi.mock('../firebase', () => ({ db: {} }))
const loadStats = vi.fn()
const countSubmissions = vi.fn()
let push: (r: Surveyor[]) => void
vi.mock('./stats', async (orig) => ({
  ...(await orig<typeof import('./stats')>()),
  loadStats: (...a: unknown[]) => loadStats(...a),
}))
const loadDemoFactories = vi.fn()
const removeDemoFactories = vi.fn()
vi.mock('./demo', () => ({
  loadDemoFactories: (...a: unknown[]) => loadDemoFactories(...a),
  removeDemoFactories: (...a: unknown[]) => removeDemoFactories(...a),
}))
const rebuildSearchIndex = vi.fn()
vi.mock('./rebuildIndex', () => ({ rebuildSearchIndex: (...a: unknown[]) => rebuildSearchIndex(...a) }))
vi.mock('./repo', () => {
  class AdminError extends Error {
    readonly code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  }
  return { AdminError }
})
vi.mock('./surveyors', () => ({
  subscribeSurveyors: (cb: (r: Surveyor[]) => void) => {
    push = cb
    return () => {}
  },
  countSubmissions: (...a: unknown[]) => countSubmissions(...a),
}))

import { Dashboard } from './Dashboard'
import { AdminError } from './repo'

const d = new Date('2026-10-20')
const surveyors: Surveyor[] = [
  { uid: 'u1', name: 'Mona Adel', email: 'm@x.com', active: true, createdAt: d },
  { uid: 'u2', name: 'Karim', email: 'k@x.com', active: true, createdAt: d },
]
const stats = (fill: number | null) => ({
  byStatus: { pending: 4, approved: 120, rejected: 3, hidden: null },
  byArea: [
    { area: 'oct6-zone-1', approved: 60, pending: 2 },
    { area: 'other', approved: null, pending: 1 },
  ],
  indexFill: fill,
})

beforeEach(async () => {
  await initI18n()
  loadStats.mockReset().mockResolvedValue(stats(0.5))
  loadDemoFactories.mockReset().mockResolvedValue({ added: 8, skipped: 2 })
  rebuildSearchIndex.mockReset().mockResolvedValue({ count: 7 })
  removeDemoFactories.mockReset().mockResolvedValue({ removed: 5 })
  countSubmissions.mockReset().mockImplementation(async (uid: string) => {
    if (uid === 'u1') return { pending: 1, approved: 5, rejected: 2 }
    throw new Error('x')
  })
})

async function setup() {
  render(<Dashboard />)
  act(() => push(surveyors))
  await screen.findByText('120')
}

describe('Dashboard', () => {
  it('shows status tiles, area and surveyor tables, dashes for failures; no h1', async () => {
    await setup()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(await screen.findByText('Mona Adel')).toBeInTheDocument()
    const row = (await screen.findByText('Mona Adel')).closest('tr')!
    await within(row).findByText('5')
    expect(within(row).getByText('2')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })

  it('shows the index fill as a meter without a warning below 80%', async () => {
    await setup()
    const m = screen.getByRole('meter')
    expect(m).toHaveAttribute('aria-valuenow', '50')
    expect(m).toHaveAttribute('aria-valuemin', '0')
    expect(m).toHaveAttribute('aria-valuemax', '100')
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.queryByText(/split/i)).toBeNull()
  })

  it('warns at fill 0.85', async () => {
    loadStats.mockResolvedValue(stats(0.85))
    await setup()
    expect(screen.getByRole('status')).toHaveTextContent(/split/i)
    expect(screen.getByRole('status')).toHaveTextContent('85%')
  })

  it('uses the danger tone at the index limit', async () => {
    loadStats.mockResolvedValue(stats(0.98))
    await setup()
    expect(screen.getByRole('alert')).toHaveTextContent(/split/i)
  })

  it('refresh reloads the counts', async () => {
    await setup()
    loadStats.mockResolvedValue({ ...stats(0.5), byStatus: { pending: 9, approved: 121, rejected: 3, hidden: 0 } })
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('121')).toBeInTheDocument()
    expect(loadStats).toHaveBeenCalledTimes(2)
  })

  it('has no export or download control of any kind', async () => {
    const { container } = render(<Dashboard />)
    act(() => push(surveyors))
    await screen.findByText('120')
    const re = /export|download|csv/i
    expect(screen.queryByRole('button', { name: re })).toBeNull()
    expect(screen.queryByRole('link', { name: re })).toBeNull()
    expect(screen.queryByText(re)).toBeNull()
    expect(container.querySelector('a[download]')).toBeNull()
    expect(within(container).queryAllByRole('link')).toHaveLength(0)
  })

  describe('rebuild search index', () => {
    it('confirms, rebuilds and shows the count', async () => {
      await setup()
      await userEvent.click(screen.getByRole('button', { name: 'Rebuild search index' }))
      expect(rebuildSearchIndex).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: 'Rebuild now' }))
      expect(await screen.findByText('Rebuilt: 7 factories')).toBeInTheDocument()
      expect(rebuildSearchIndex).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(loadStats).toHaveBeenCalledTimes(2))
    })
    it('shows the index-full error', async () => {
      rebuildSearchIndex.mockRejectedValue(new AdminError('indexFull'))
      await setup()
      await userEvent.click(screen.getByRole('button', { name: 'Rebuild search index' }))
      await userEvent.click(screen.getByRole('button', { name: 'Rebuild now' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })
  })

  describe('demo data', () => {
    it('loads the demo factories, shows the result and refreshes the counts', async () => {
      await setup()
      await userEvent.click(screen.getByRole('button', { name: 'Load demo factories' }))
      expect(await screen.findByText('Added 8, skipped 2.')).toBeInTheDocument()
      expect(loadDemoFactories).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(loadStats).toHaveBeenCalledTimes(2))
    })
    it('disables both buttons while running and shows progress', async () => {
      await setup()
      let release!: () => void
      loadDemoFactories.mockImplementation(
        (_d: unknown, onProgress: (n: number, t: number) => void) =>
          new Promise((res) => {
            onProgress(3, 10)
            release = () => res({ added: 10, skipped: 0 })
          }),
      )
      await userEvent.click(screen.getByRole('button', { name: 'Load demo factories' }))
      expect(await screen.findByText('Working: 3 of 10…')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Load demo factories' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Remove all demo factories' })).toBeDisabled()
      await act(async () => release())
      expect(await screen.findByText('Added 10, skipped 0.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Load demo factories' })).toBeEnabled()
    })
    it('maps errors: index full, generic and offline', async () => {
      await setup()
      loadDemoFactories.mockRejectedValueOnce(new AdminError('indexFull'))
      await userEvent.click(screen.getByRole('button', { name: 'Load demo factories' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/Search index is full/)
      loadDemoFactories.mockRejectedValueOnce(new Error('x'))
      await userEvent.click(screen.getByRole('button', { name: 'Load demo factories' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/)
      const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      loadDemoFactories.mockRejectedValueOnce(new Error('x'))
      await userEvent.click(screen.getByRole('button', { name: 'Load demo factories' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/offline/)
      online.mockRestore()
    })
    it('removal needs confirmation, then removes and reports', async () => {
      await setup()
      await userEvent.click(screen.getByRole('button', { name: 'Remove all demo factories' }))
      const dialog = await screen.findByRole('dialog')
      expect(removeDemoFactories).not.toHaveBeenCalled()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(removeDemoFactories).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: 'Remove all demo factories' }))
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove permanently' }))
      expect(await screen.findByText('Removed 5 demo factories.')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(removeDemoFactories).toHaveBeenCalledTimes(1)
    })
    it('shows a mapped error when removal fails', async () => {
      removeDemoFactories.mockRejectedValue(new Error('x'))
      await setup()
      await userEvent.click(screen.getByRole('button', { name: 'Remove all demo factories' }))
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove permanently' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/)
    })
  })
})
