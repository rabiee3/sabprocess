import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
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
  factoryDocExists: vi.fn(() => Promise.resolve(false)),
  submitFactory: vi.fn(() => Promise.resolve()),
  resubmitFactory: vi.fn(() => Promise.resolve()),
  loadFactoryForEdit: vi.fn(),
  classifySubmitError: vi.fn(() => Promise.resolve('rejected')),
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

function ListStub() {
  const state = useLocation().state as { storageFull?: boolean } | null
  return <div>LIST{state?.storageFull ? ' storageFull' : ''}</div>
}

const user = userEvent.setup({ delay: null }) // no per-action timer: the long flows stay fast under load
function renderAt(path: string, mode: 'new' | 'edit' = 'new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/survey" element={<ListStub />} />
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
    vi.mocked(repo.newFactoryId).mockReturnValue('fnew')
    vi.mocked(repo.factoryDocExists).mockResolvedValue(false)
  })

  it('Next on location without a pin shows the error and stays on step 1', async () => {
    renderAt('/survey/new')
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument()
    expect(screen.queryByText(en.survey.location.required)).not.toBeInTheDocument()
    await next()
    expect(screen.getByText(en.survey.location.required)).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument()
  })

  it('happy path submits without awaiting, queues the outbox, clears the draft once the commit lands', async () => {
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
    expect(outbox.list('u1').map((e) => e.fid)).toEqual(['fnew'])
    expect(screen.getByText(/^LIST/)).toBeInTheDocument()
    await waitFor(() => expect(loadDraft('u1', 'fnew')).toBeNull())
  })

  it('offline shows Save on this phone and still submits', async () => {
    online = false
    saveDraft('u1', fullDraft())
    renderAt('/survey/new?step=review')
    expect(screen.getByText(en.survey.review.offlineBanner)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en.survey.review.saveOnPhone }))
    expect(repo.submitFactory).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/^LIST/)).toBeInTheDocument()
  })

  it('review warns when the pin was not moved or GPS was weak', () => {
    saveDraft('u1', fullDraft({ location: { lat: 30, lng: 31, accuracyM: 80, pinMoved: false } }))
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
    expect(screen.getByText(/^LIST/)).toBeInTheDocument()
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

  it('a rejected commit is classified by classifySubmitError and marks the outbox entry', async () => {
    const denied = { code: 'permission-denied' }
    vi.mocked(repo.submitFactory).mockImplementation(() => Promise.reject(denied))
    vi.mocked(repo.classifySubmitError).mockResolvedValue('rejected')
    saveDraft('u1', fullDraft())
    renderAt('/survey/new?step=review')
    await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
    await waitFor(() => expect(outbox.list('u1')).toMatchObject([{ fid: 'fnew', state: 'failed', error: 'rejected' }]))
    expect(repo.classifySubmitError).toHaveBeenCalledWith(denied, 'u1')
  })

  it('a synchronous throw while online keeps the form and shows the error', async () => {
    vi.mocked(repo.submitFactory).mockImplementation(() => {
      throw { code: 'permission-denied' }
    })
    saveDraft('u1', fullDraft())
    renderAt('/survey/new?step=review')
    await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
    expect(screen.getByText(en.errors.accessOff)).toBeInTheDocument()
    expect(outbox.list('u1')).toEqual([])
    expect(loadDraft('u1', 'fnew')).not.toBeNull()
  })

  it('a quota error on submit shows the service-busy message', async () => {
    vi.mocked(repo.submitFactory).mockImplementation(() => {
      throw { code: 'resource-exhausted' }
    })
    saveDraft('u1', fullDraft())
    renderAt('/survey/new?step=review')
    await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
    expect(screen.getByText('The service is busy right now — please try again later')).toBeInTheDocument()
  })

  it('restores the entered name from the saved draft after a remount', async () => {
    const first = renderAt('/survey/new?step=basics')
    await user.type(screen.getByLabelText(en.survey.basics.nameEn), 'Zed')
    first.unmount()
    renderAt('/survey/new?step=basics')
    expect(screen.getByLabelText(en.survey.basics.nameEn)).toHaveValue('Zed')
  })

  it('new mode: an unmoved stored pin is not passed as a fixed value, a moved one is', () => {
    saveDraft('u1', fullDraft({ location: { lat: 30, lng: 31, accuracyM: 10, pinMoved: false } }))
    const a = renderAt('/survey/new')
    expect(pickerProps.current.value).toBeUndefined()
    a.unmount()
    saveDraft('u1', fullDraft())
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
    saveDraft('u1', fullDraft())
    renderAt('/survey/new?step=review')
    await user.dblClick(screen.getByRole('button', { name: en.survey.review.submit }))
    expect(repo.submitFactory).toHaveBeenCalledTimes(1)
  })

  it('an invalid step param falls back to location', () => {
    renderAt('/survey/new?step=bogus')
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument()
  })

  describe('limits (F1)', () => {
    it('inputs carry maxLength matching the rules', () => {
      saveDraft('u1', fullDraft({ area: 'other' }))
      renderAt('/survey/new?step=basics')
      expect(screen.getByLabelText(en.survey.basics.nameEn)).toHaveAttribute('maxLength', '120')
      expect(screen.getByLabelText(en.survey.basics.nameAr)).toHaveAttribute('maxLength', '120')
      expect(screen.getByLabelText(en.survey.basics.areaOther)).toHaveAttribute('maxLength', '120')
      expect(screen.getByLabelText(en.survey.basics.address)).toHaveAttribute('maxLength', '300')
    })

    it('contact inputs carry maxLength; website and facebook are LTR url inputs', () => {
      saveDraft('u1', fullDraft())
      renderAt('/survey/new?step=contacts')
      expect(screen.getByLabelText(en.survey.contacts.phone)).toHaveAttribute('maxLength', '40')
      expect(screen.getByLabelText(en.survey.contacts.whatsapp)).toHaveAttribute('maxLength', '40')
      expect(screen.getByLabelText(en.survey.contacts.person)).toHaveAttribute('maxLength', '120')
      for (const label of [en.survey.contacts.website, en.survey.contacts.facebook]) {
        const el = screen.getByLabelText(label)
        expect(el).toHaveAttribute('maxLength', '300')
        expect(el).toHaveAttribute('type', 'url')
        expect(el).toHaveAttribute('inputMode', 'url')
        expect(el).toHaveAttribute('dir', 'ltr')
      }
    })

    it('an overlong pasted Facebook URL is kept whole and blocks Next with an error', async () => {
      saveDraft('u1', fullDraft())
      renderAt('/survey/new?step=contacts')
      const fb = screen.getByLabelText(en.survey.contacts.facebook)
      await user.click(fb)
      await user.paste('https://facebook.com/' + 'x'.repeat(300))
      expect((fb as HTMLInputElement).value).toHaveLength(321)
      await next()
      expect(screen.getByText(en.errors.tooLong.replace('{{max}}', '300'))).toBeInTheDocument()
      expect(screen.getByText('Step 4 of 6')).toBeInTheDocument()
    })

    it('submit from review with a stored overlong field goes back to that step instead of submitting', async () => {
      saveDraft('u1', fullDraft({ contact: { facebook: 'x'.repeat(301) } }))
      renderAt('/survey/new?step=review')
      await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
      expect(repo.submitFactory).not.toHaveBeenCalled()
      expect(screen.getByText('Step 4 of 6')).toBeInTheDocument()
      expect(screen.getByText(en.errors.tooLong.replace('{{max}}', '300'))).toBeInTheDocument()
    })

    it('Add product is disabled at 30 per list, with a hint', () => {
      const rows = Array.from({ length: 30 }, (_, i) => ({ key: `k${i}`, name: { en: `P${i}`, ar: '' } }))
      saveDraft('u1', fullDraft({ productsMade: rows }))
      renderAt('/survey/new?step=products')
      const [made, needed] = screen.getAllByRole('button', { name: en.survey.products.add })
      expect(made).toBeDisabled()
      expect(needed).toBeEnabled()
      expect(screen.getByText(en.survey.products.max.replace('{{max}}', '30'))).toBeInTheDocument()
    })
  })

  describe('draft lifecycle (F1c)', () => {
    it('a commit that has not settled keeps the draft, and a new factory does not reuse it', async () => {
      vi.mocked(repo.submitFactory).mockImplementation(() => new Promise(() => {}))
      saveDraft('u1', fullDraft())
      const a = renderAt('/survey/new?step=review')
      await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
      expect(screen.getByText(/^LIST/)).toBeInTheDocument()
      expect(loadDraft('u1', 'fnew')?.name.en).toBe('Acme')
      a.unmount()
      vi.mocked(repo.newFactoryId).mockReturnValue('fnext')
      renderAt('/survey/new?step=basics')
      expect(screen.getByLabelText(en.survey.basics.nameEn)).toHaveValue('')
    })

    it('a failed commit keeps the draft', async () => {
      vi.mocked(repo.submitFactory).mockImplementation(() => Promise.reject({ code: 'permission-denied' }))
      saveDraft('u1', fullDraft())
      renderAt('/survey/new?step=review')
      await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
      await waitFor(() => expect(outbox.list('u1')[0]?.state).toBe('failed'))
      expect(loadDraft('u1', 'fnew')).not.toBeNull()
    })

    it('new?resume=<fid> opens that saved draft', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(1000)
      saveDraft('u1', fullDraft({ fid: 'fold', name: { en: 'Resumed', ar: '' } }))
      vi.setSystemTime(2000)
      saveDraft('u1', fullDraft({ fid: 'fnewer', name: { en: 'Newer', ar: '' } }))
      vi.useRealTimers()
      renderAt('/survey/new?resume=fold&step=basics')
      expect(await screen.findByLabelText(en.survey.basics.nameEn)).toHaveValue('Resumed')
      expect(loadDraft('u1', 'fold')).not.toBeNull()
    })

    it('a resume whose existence check cannot be answered (offline) is reissued too, content kept', async () => {
      vi.mocked(repo.factoryDocExists).mockRejectedValue({ code: 'unavailable' })
      saveDraft('u1', fullDraft({ fid: 'fold', name: { en: 'Resumed', ar: '' } }))
      renderAt('/survey/new?resume=fold&step=review')
      await user.click(await screen.findByRole('button', { name: en.survey.review.submit }))
      expect(repo.submitFactory).toHaveBeenCalledWith('u1', 'fnew', expect.objectContaining({ name: { en: 'Resumed' } }))
      expect(loadDraft('u1', 'fold')).toBeNull()
    })

    it('a typed resume URL (no router state) for a doc-existing fid gets a new fid, content kept', async () => {
      vi.mocked(repo.factoryDocExists).mockResolvedValue(true)
      saveDraft('u1', fullDraft({ fid: 'fold', name: { en: 'Resumed', ar: '' } }))
      outbox.add('u1', 'fold')
      outbox.markFailed('u1', 'fold', 'rejected')
      renderAt('/survey/new?resume=fold&step=review')
      await user.click(await screen.findByRole('button', { name: en.survey.review.submit }))
      expect(repo.factoryDocExists).toHaveBeenCalledWith('fold')
      expect(repo.submitFactory).toHaveBeenCalledWith('u1', 'fnew', expect.objectContaining({ name: { en: 'Resumed' } }))
      expect(loadDraft('u1', 'fold')).toBeNull()
    })

    it('resuming a failed draft whose doc already exists on the server gets a new fid and clears the old draft', async () => {
      saveDraft('u1', fullDraft({ fid: 'fold', name: { en: 'Resumed', ar: '' } }))
      outbox.add('u1', 'fold')
      outbox.markFailed('u1', 'fold', 'rejected')
      render(
        <MemoryRouter initialEntries={[{ pathname: '/survey/new', search: '?resume=fold&step=review', state: { docExists: true } }]}>
          <Routes>
            <Route path="/survey" element={<ListStub />} />
            <Route path="/survey/new" element={<FactoryStepper mode="new" />} />
          </Routes>
        </MemoryRouter>,
      )
      await user.click(await screen.findByRole('button', { name: en.survey.review.submit }))
      expect(repo.submitFactory).toHaveBeenCalledWith('u1', 'fnew', expect.objectContaining({ name: { en: 'Resumed' } }))
      expect(loadDraft('u1', 'fold')).toBeNull()
      expect(outbox.list('u1').map((e) => e.fid)).toEqual(['fnew'])
      expect(outbox.list('u1')[0]).toMatchObject({ kind: 'new' })
    })
  })

  describe('storage (F5)', () => {
    const draftWrites = (spy: { mock: { calls: unknown[][] } }) =>
      spy.mock.calls.filter(([k]) => typeof k === 'string' && k.startsWith('hscode.draft.')).length

    afterEach(() => vi.restoreAllMocks())

    it('typing saves the draft once, about 500 ms after the last change', async () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem')
      renderAt('/survey/new?step=basics')
      await user.type(screen.getByLabelText(en.survey.basics.nameEn), 'Zed')
      expect(draftWrites(spy)).toBe(0)
      await waitFor(() => expect(draftWrites(spy)).toBe(1), { timeout: 2000 })
      expect(loadDraft('u1', 'fnew')?.name.en).toBe('Zed')
    })

    it('a step change flushes the pending save at once', async () => {
      saveDraft('u1', fullDraft())
      renderAt('/survey/new?step=basics')
      await user.clear(screen.getByLabelText(en.survey.basics.nameEn))
      await user.type(screen.getByLabelText(en.survey.basics.nameEn), 'Quick')
      await next()
      expect(loadDraft('u1', 'fnew')?.name.en).toBe('Quick')
    })

    it('a full storage shows the storage warning on the form', async () => {
      const real = Storage.prototype.setItem
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
        if (k.startsWith('hscode.draft.')) throw new DOMException('full', 'QuotaExceededError')
        real.call(this, k, v)
      })
      renderAt('/survey/new?step=basics')
      await user.type(screen.getByLabelText(en.survey.basics.nameEn), 'Zed')
      await user.selectOptions(screen.getByLabelText(en.survey.basics.area), 'oct6-zone-1')
      expect(screen.queryByText(en.errors.storageFull)).toBeNull()
      await next()
      expect(await screen.findByText(en.errors.storageFull)).toBeInTheDocument()
    })

    it('an outbox that cannot be saved still submits and tells My submissions to warn', async () => {
      saveDraft('u1', fullDraft())
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      renderAt('/survey/new?step=review')
      await user.click(screen.getByRole('button', { name: en.survey.review.submit }))
      expect(repo.submitFactory).toHaveBeenCalledTimes(1)
      expect(screen.getByText('LIST storageFull')).toBeInTheDocument()
    })
  })

  it('review shows factory and product names in the current language, falling back to the other', () => {
    saveDraft(
      'u1',
      fullDraft({
        name: { en: 'Acme', ar: 'أكمي' },
        productsMade: [
          { key: 'a', name: { en: 'Pipe', ar: 'ماسورة' } },
          { key: 'b', name: { en: 'Valve', ar: '' } },
        ],
        productsNeeded: [{ key: 'c', name: { en: '', ar: 'حديد' } }],
      }),
    )
    const i18n = initI18n()
    void i18n.changeLanguage('ar')
    try {
      renderAt('/survey/new?step=review')
      expect(screen.getByText('أكمي')).toBeInTheDocument()
      expect(screen.getByText('ماسورة')).toBeInTheDocument()
      expect(screen.queryByText('Pipe')).toBeNull()
      expect(screen.getByText('Valve')).toBeInTheDocument()
    } finally {
      void i18n.changeLanguage('en')
    }
    cleanup()
    renderAt('/survey/new?step=review')
    expect(screen.getByText('Pipe')).toBeInTheDocument()
    expect(screen.getByText('حديد')).toBeInTheDocument()
  })
})

