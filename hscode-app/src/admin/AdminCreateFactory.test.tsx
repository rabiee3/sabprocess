import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { initI18n, setLanguage } from '../i18n'
import { AdminContext } from './AdminContext'

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('../map/LocationPicker', () => ({
  LocationPicker: (p: { gps?: boolean; value?: unknown; onChange: (l: unknown, s: string) => void }) => (
    <button
      type="button"
      data-gps={String(p.gps)}
      data-has-value={String(p.value !== undefined)}
      onClick={() => p.onChange({ lat: 29.9301, lng: 30.9102, accuracyM: null, pinMoved: true }, 'unavailable')}
    >
      Place pin
    </button>
  ),
}))

const adminCreateFactory = vi.fn()
vi.mock('./repo', () => {
  class AdminError extends Error {
    readonly code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  }
  return { AdminError, adminCreateFactory: (...a: unknown[]) => adminCreateFactory(...a) }
})

import { AdminError } from './repo'
import { AdminCreateFactory } from './AdminCreateFactory'

const refreshPending = vi.fn()

function setup() {
  render(
    <AdminContext.Provider value={{ pending: 0, refreshPending }}>
      <MemoryRouter initialEntries={['/admin/factories/new']}>
        <Routes>
          <Route path="/admin/factories/new" element={<AdminCreateFactory />} />
          <Route path="/admin/factories/:fid" element={<p>detail page</p>} />
        </Routes>
      </MemoryRouter>
    </AdminContext.Provider>,
  )
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Factory name (English)'), '  Alpha Steel ')
  await user.selectOptions(screen.getByLabelText('Industrial area'), 'oct6-zone-1')
  await user.click(screen.getByRole('button', { name: 'Place pin' }))
}

beforeEach(async () => {
  await initI18n()
  await setLanguage('en')
  adminCreateFactory.mockReset()
  adminCreateFactory.mockResolvedValue('new1')
  refreshPending.mockReset()
})

describe('AdminCreateFactory', () => {
  it('has no h1 and starts the picker without GPS or a stored value', () => {
    setup()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    const picker = screen.getByRole('button', { name: 'Place pin' })
    expect(picker).toHaveAttribute('data-gps', 'false')
    expect(picker).toHaveAttribute('data-has-value', 'false')
  })

  it('creates with sample: true when ticked and goes to the new detail page', async () => {
    const user = userEvent.setup()
    setup()
    await fillValid(user)
    await user.click(screen.getByRole('checkbox', { name: /Sample \(demo\) factory/ }))
    await user.click(screen.getByRole('button', { name: 'Add factory' }))
    await waitFor(() => expect(adminCreateFactory).toHaveBeenCalledTimes(1))
    const [input, opts] = adminCreateFactory.mock.calls[0] as [Record<string, unknown>, { sample: boolean }]
    expect(opts).toEqual({ sample: true })
    expect(input).toMatchObject({
      name: { en: 'Alpha Steel' },
      area: 'oct6-zone-1',
      location: { lat: 29.9301, lng: 30.9102, accuracyM: null, pinMoved: true },
      productsMade: [],
      productsNeeded: [],
      photos: [],
      contact: {},
    })
    expect(await screen.findByText('detail page')).toBeInTheDocument()
  })

  it('creates with sample: false by default', async () => {
    const user = userEvent.setup()
    setup()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Add factory' }))
    await waitFor(() => expect(adminCreateFactory).toHaveBeenCalledTimes(1))
    expect(adminCreateFactory.mock.calls[0]?.[1]).toEqual({ sample: false })
  })

  it('blocks a missing name', async () => {
    const user = userEvent.setup()
    setup()
    await user.selectOptions(screen.getByLabelText('Industrial area'), 'oct6-zone-1')
    await user.click(screen.getByRole('button', { name: 'Place pin' }))
    await user.click(screen.getByRole('button', { name: 'Add factory' }))
    expect(await screen.findByText('At least one name is required.')).toBeInTheDocument()
    expect(adminCreateFactory).not.toHaveBeenCalled()
  })

  it('blocks a missing location', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Factory name (English)'), 'Alpha')
    await user.selectOptions(screen.getByLabelText('Industrial area'), 'oct6-zone-1')
    await user.click(screen.getByRole('button', { name: 'Add factory' }))
    expect(await screen.findByText('Place the pin on the factory inside Egypt.')).toBeInTheDocument()
    expect(adminCreateFactory).not.toHaveBeenCalled()
  })

  it('a double click makes one call', async () => {
    const user = userEvent.setup()
    let release: (id: string) => void = () => {}
    adminCreateFactory.mockReturnValue(new Promise<string>((r) => (release = r)))
    setup()
    await fillValid(user)
    const save = screen.getByRole('button', { name: 'Add factory' })
    await user.dblClick(save)
    expect(adminCreateFactory).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled()
    release('new1')
    expect(await screen.findByText('detail page')).toBeInTheDocument()
  })

  it.each([
    ['indexFull', /Search index is full/],
    ['invalid', /Something went wrong/],
  ])('maps %s to its message and re-enables Save', async (code, text) => {
    const user = userEvent.setup()
    adminCreateFactory.mockRejectedValue(new AdminError(code as 'indexFull'))
    setup()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Add factory' }))
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add factory' })).toBeEnabled()
  })

  it('shows the offline message when the browser is offline', async () => {
    const user = userEvent.setup()
    adminCreateFactory.mockRejectedValue(new Error('network'))
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    setup()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Add factory' }))
    expect(await screen.findByText(/You're offline/)).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
