import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'
import type { Factory } from '../lib/types'
import { emptyDraft, loadDraft, saveDraft, type Draft } from './draft'
import { outbox } from './outbox'

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }))
let online = true
vi.mock('../ui/useOnline', () => ({ useOnline: () => online }))
vi.mock('./repo', async (orig) => ({
  ...(await orig<typeof import('./repo')>()),
  newFactoryId: vi.fn(() => 'fnew'),
  submitFactory: vi.fn(() => Promise.resolve()),
  resubmitFactory: vi.fn(() => Promise.resolve()),
  loadFactoryForEdit: vi.fn(),
}))
const pickerProps: { current: { value?: unknown } } = { current: {} }
let pickerStatus = 'ok'
let pickerMoved = true
vi.mock('../map/LocationPicker', () => ({
  LocationPicker: (props: { value?: unknown; onChange: (l: unknown, s: string) => void }) => {
    pickerProps.current = props
    return (
      <button
        type="button"
        onClick={() => props.onChange({ lat: 30, lng: 31, accuracyM: 10, pinMoved: pickerMoved }, pickerStatus)}
      >
        set-pin
      </button>
    )
  },
}))
vi.mock('../photos/PhotoPicker', () => ({
  PhotoPicker: ({ onChange }: { onChange: (p: unknown, t?: string | null) => void }) => (
    <button type="button" onClick={() => onChange([{ id: 'p1', data: 'data:x' }], 'thumb')}>
      add-photo
    </button>
  ),
}))
vi.mock('../hs/HsPicker', () => ({
  HsPicker: ({ open, onUse }: { open: boolean; onUse: (h: unknown) => void }) =>
    open ? (
      <button type="button" onClick={() => onUse({ heading: '7301' })}>
        use-hs
      </button>
    ) : null,
}))

import * as repo from './repo'
import { FactoryStepper } from './FactoryStepper'

const user = userEvent.setup()
function renderAt(path: string, mode: 'new' | 'edit' = 'new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/survey" element={<div>LIST</div>} />
        <Route path="/survey/new" element={<FactoryStepper mode="new" />} />
        <Route path="/survey/edit/:fid" element={<FactoryStepper mode={mode} />} />
      </Routes>
    </MemoryRouter>,
  )
}
const next = () => user.click(screen.getByRole('button', { name: en.survey.step.next }))

function fullDraft(over: Partial<Draft> = {}): Draft {
  return {
    ...emptyDraft('fnew'),
    location: { lat: 30, lng: 31, accuracyM: 10, pinMoved: true },
    gpsStatus: 'ok',
    name: { en: 'Acme', ar: '' },
    area: 'oct6-zone-1',
    ...over,
  }
}

describe('FactoryStepper', () => {
  beforeEach(() => {
    initI18n()
    localStorage.clear()
    online = true
    pickerStatus = 'ok'
    pickerMoved = true
    pickerProps.current = {}
    vi.clearAllMocks()
    vi.mocked(repo.submitFactory).mockImplementation(() => Promise.resolve())
  })

  it('Next on location without a pin shows the error and stays on step 1', async () => {
    renderAt('/survey/new')
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument()
    expect(screen.queryByText(en.survey.location.required)).not.toBeInTheDocument()
    await next()
    expect(screen.getByText(en.survey.location.required)).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument()
  })

  it('happy path submits without awaiting, queues the outbox, clears the draft and goes to the list', async () => {
    renderAt('/survey/new')
    await user.click(screen.getByText('set-pin'))
    await next()
    await user.type(screen.getByLabelText(en.survey.basics.nameEn), 'Acme')
    await user.selectOptions(screen.getByLabelText(en.survey.basics.area), 'oct6-zone-1')
    await next()
    await user.click(screen.getAllByRole('button', { name: en.survey.products.add })[0])
    await user.type(screen.getByLabelText(en.survey.products.nameEn), 'Pipe')
    await user.click(screen.getByRole('button', { name: en.survey.products.hsOptional }))
    await user.click(screen.getByText('use-hs'))
    await next()
    await next()
    await user.click(screen.getByText('add-photo'))
    await next()
    expect(screen.getByText(en.survey.review.title)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
    expect(repo.submitFactory).toHaveBeenCalledTimes(1)
    const [uid, fid, input] = vi.mocked(repo.submitFactory).mock.calls[0]
    expect(uid).toBe('u1')
    expect(fid).toBe('fnew')
    expect(input).toMatchObject({
      name: { en: 'Acme' },
      area: 'oct6-zone-1',
      productsMade: [{ name: { en: 'Pipe' }, hs: { heading: '7301' } }],
      photos: [{ id: 'p1', data: 'data:x' }],
      thumb: 'thumb',
    })
    expect(outbox.list().map((e) => e.fid)).toEqual(['fnew'])
    expect(loadDraft('fnew')).toBeNull()
    expect(screen.getByText('LIST')).toBeInTheDocument()
  })

  it('offline shows Save on this phone and still submits', async () => {
    online = false
    saveDraft(fullDraft())
    renderAt('/survey/new?step=review')
    expect(screen.getByText(en.survey.review.offlineBanner)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en.survey.review.saveOnPhone }))
    expect(repo.submitFactory).toHaveBeenCalledTimes(1)
    expect(screen.getByText('LIST')).toBeInTheDocument()
  })

  it('review warns when the pin was not moved or GPS was weak', () => {
    saveDraft(fullDraft({ location: { lat: 30, lng: 31, accuracyM: 80, pinMoved: false } }))
    renderAt('/survey/new?step=review')
    expect(screen.getByText(en.survey.review.pinNotMoved)).toBeInTheDocument()
    expect(screen.getByText(en.survey.review.weakGps)).toBeInTheDocument()
  })

  it('editing a rejected factory resubmits with the previous photo ids', async () => {
    const factory = {
      id: 'f9',
      name: { en: 'Old' },
      area: 'obour',
      location: { lat: 30, lng: 31, accuracyM: null, pinMoved: true },
      productsMade: [],
      productsNeeded: [],
      photoCount: 2,
      status: 'rejected',
      rejectReason: 'bad',
      createdBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Factory
    vi.mocked(repo.loadFactoryForEdit).mockResolvedValue({
      factory,
      contact: {},
      photos: [
        { id: 'p1', data: 'a' },
        { id: 'p2', data: 'b' },
      ],
    })
    renderAt('/survey/edit/f9?step=review', 'edit')
    await user.click(await screen.findByRole('button', { name: en.survey.review.submit }))
    expect(repo.resubmitFactory).toHaveBeenCalledTimes(1)
    const call = vi.mocked(repo.resubmitFactory).mock.calls[0]
    expect(call[0]).toBe('u1')
    expect(call[1]).toBe('f9')
    expect(call[3]).toEqual(['p1', 'p2'])
    expect(repo.submitFactory).not.toHaveBeenCalled()
    expect(screen.getByText('LIST')).toBeInTheDocument()
  })

  it('edit of a missing factory shows not-found with a link back', async () => {
    vi.mocked(repo.loadFactoryForEdit).mockResolvedValue(null)
    renderAt('/survey/edit/nope', 'edit')
    expect(await screen.findByText(en.survey.edit.notFound)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: en.survey.edit.back })).toHaveAttribute('href', '/survey')
  })

  it('edit offline cache miss shows the offline error', async () => {
    vi.mocked(repo.loadFactoryForEdit).mockRejectedValue({ code: 'unavailable' })
    renderAt('/survey/edit/f9', 'edit')
    expect(await screen.findByText(en.errors.offline)).toBeInTheDocument()
  })

  it('a permission-denied commit marks the outbox entry accessOff', async () => {
    vi.mocked(repo.submitFactory).mockImplementation(() => Promise.reject({ code: 'permission-denied' }))
    saveDraft(fullDraft())
    renderAt('/survey/new?step=review')
    await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
    await waitFor(() => expect(outbox.list()).toMatchObject([{ fid: 'fnew', state: 'failed', error: 'accessOff' }]))
  })

  it('a synchronous throw while online keeps the form and shows the error', async () => {
    vi.mocked(repo.submitFactory).mockImplementation(() => {
      throw { code: 'permission-denied' }
    })
    saveDraft(fullDraft())
    renderAt('/survey/new?step=review')
    await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
    expect(screen.getByText(en.errors.accessOff)).toBeInTheDocument()
    expect(outbox.list()).toEqual([])
    expect(loadDraft('fnew')).not.toBeNull()
  })

  it('restores the entered name from the saved draft after a remount', async () => {
    const first = renderAt('/survey/new?step=basics')
    await user.type(screen.getByLabelText(en.survey.basics.nameEn), 'Zed')
    first.unmount()
    renderAt('/survey/new?step=basics')
    expect(screen.getByLabelText(en.survey.basics.nameEn)).toHaveValue('Zed')
  })

  it('new mode: an unmoved stored pin is not passed as a fixed value, a moved one is', () => {
    saveDraft(fullDraft({ location: { lat: 30, lng: 31, accuracyM: 10, pinMoved: false } }))
    const a = renderAt('/survey/new')
    expect(pickerProps.current.value).toBeUndefined()
    a.unmount()
    saveDraft(fullDraft())
    renderAt('/survey/new')
    expect(pickerProps.current.value).toMatchObject({ pinMoved: true })
  })

  it('edit mode: a stored unmoved pin with GPS denied does not block Next', async () => {
    pickerStatus = 'denied'
    pickerMoved = false
    vi.mocked(repo.loadFactoryForEdit).mockResolvedValue({
      factory: {
        id: 'f9',
        name: { en: 'Old' },
        area: 'obour',
        location: { lat: 30, lng: 31, accuracyM: null, pinMoved: false },
        productsMade: [],
        productsNeeded: [],
        photoCount: 0,
        status: 'rejected',
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Factory,
      contact: {},
      photos: [],
    })
    renderAt('/survey/edit/f9', 'edit')
    await screen.findByText('set-pin')
    expect(pickerProps.current.value).toMatchObject({ pinMoved: false })
    await user.click(screen.getByText('set-pin'))
    await next()
    expect(screen.getByText('Step 2 of 6')).toBeInTheDocument()
  })

  it('two fast submit clicks call submitFactory once', async () => {
    saveDraft(fullDraft())
    renderAt('/survey/new?step=review')
    await user.dblClick(screen.getByRole('button', { name: en.survey.review.submit }))
    expect(repo.submitFactory).toHaveBeenCalledTimes(1)
  })

  it('an invalid step param falls back to location', () => {
    renderAt('/survey/new?step=bogus')
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument()
  })
})
