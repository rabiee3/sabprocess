import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n, setLanguage } from '../i18n'
import type { Factory, FactoryLocation } from '../lib/types'

vi.mock('../firebase', () => ({ db: {} }))
type PickerProps = { onChange: (loc: FactoryLocation, gps: string) => void }
const pickers = vi.hoisted(() => [] as PickerProps[])
vi.mock('../map/LocationPicker', () => ({
  LocationPicker: (p: PickerProps) => {
    pickers.push(p)
    return null
  },
}))

const location = { lat: 29.92, lng: 30.91, accuracyM: 85, pinMoved: true }
const f1: Factory = {
  id: 'f1',
  name: { en: 'Factory f1' },
  area: 'oct6-zone-1',
  location,
  productsMade: [{ name: { en: 'Pipes' } }],
  productsNeeded: [],
  photoCount: 0,
  status: 'pending',
  createdBy: 'u1',
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
}
vi.mock('./repo', () => ({
  AdminError: class extends Error {},
  loadForReview: async () => ({ factory: f1, openedAt: {}, contact: {}, photos: [] }),
  approveFactory: vi.fn(),
  rejectFactory: vi.fn(),
}))

import { ReviewDetail } from './ReviewDetail'

beforeEach(async () => {
  pickers.length = 0
  await initI18n()
  await setLanguage('en')
})

describe('ReviewDetail edits', () => {
  // Root cause of the ReviewQueue "mid-edit" flake: the location picker's mount effect emits its value through
  // the onChange of its first render. Applied to that render's draft, a late emit wiped the admin's edits.
  it('a late location emit from an earlier render keeps the edits made since', async () => {
    const user = userEvent.setup()
    render(<ReviewDetail fid="f1" onDone={vi.fn()} />)
    const name = await screen.findByLabelText('Factory name (English)')
    const first = pickers[0]
    await user.clear(name)
    await user.type(name, 'Half done')
    act(() => first.onChange(location, 'unavailable'))
    expect(name).toHaveValue('Half done')
  })
})
