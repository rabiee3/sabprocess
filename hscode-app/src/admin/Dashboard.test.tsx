import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
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
vi.mock('./surveyors', () => ({
  subscribeSurveyors: (cb: (r: Surveyor[]) => void) => {
    push = cb
    return () => {}
  },
  countSubmissions: (...a: unknown[]) => countSubmissions(...a),
}))

import { Dashboard } from './Dashboard'

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
})
