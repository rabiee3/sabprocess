import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'
import type { Factory } from '../lib/types'
import { outbox, type OutboxEntry } from './outbox'
import type { SubmissionItem, SurveyErrorCode } from './repo'

type Cb = (items: SubmissionItem[], meta: { fromCache: boolean }) => void
let emit: Cb
let fail: (c: SurveyErrorCode) => void
/** Seeds u1's real outbox. */
const seedOutbox = (list: (Omit<OutboxEntry, 'kind'> & { kind?: OutboxEntry['kind'] })[]) => localStorage.setItem('hscode.outbox.u1', JSON.stringify(list))
const state = () => outbox.list('u1').map(({ fid, state, error }) => ({ fid, state, error }))

const pwa = vi.hoisted(() => ({ canInstall: false, isIosSafari: false, install: vi.fn(async () => {}) }))
vi.mock('../pwa/usePwa', () => ({ usePwa: () => ({ ...pwa, needRefresh: false, update: vi.fn() }) }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }))
vi.mock('./repo', () => ({
  subscribeMySubmissions: (_uid: string, cb: Cb, onError: (c: SurveyErrorCode) => void) => {
    emit = cb
    fail = onError
    return () => {}
  },
}))

import { MySubmissions } from './MySubmissions'

const fac = (id: string, status: Factory['status'], extra: Partial<Factory> = {}) =>
  ({ id, name: { en: `Factory ${id}` }, area: 'zone-3', status, updatedAt: new Date(2026, 9, 21), ...extra }) as Factory
const item = (f: Factory, pendingWrite = false): SubmissionItem => ({ factory: f, pendingWrite })

function setup() {
  render(
    <MemoryRouter>
      <MySubmissions />
    </MemoryRouter>,
  )
}

describe('MySubmissions', () => {
  beforeEach(() => {
    initI18n()
    localStorage.clear()
    pwa.canInstall = false
    pwa.isIosSafari = false
    pwa.install.mockClear()
  })

  it('offers no install button or iOS hint when the browser cannot install', () => {
    setup()
    expect(screen.queryByRole('button', { name: en.pwa.install })).toBeNull()
    expect(screen.queryByText(en.pwa.iosHint)).toBeNull()
  })

  it('shows Install app when the browser can install; it calls install()', async () => {
    pwa.canInstall = true
    setup()
    const btn = screen.getByRole('button', { name: en.pwa.install })
    expect(btn.className).toContain('min-h-touch')
    await userEvent.click(btn)
    expect(pwa.install).toHaveBeenCalledTimes(1)
  })

  it('on iOS Safari shows the Add to Home Screen hint instead of a button', () => {
    pwa.isIosSafari = true
    setup()
    expect(screen.getByText(en.pwa.iosHint)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.pwa.install })).toBeNull()
  })

  it('counts reflect the items', () => {
    setup()
    act(() =>
      emit([item(fac('a', 'pending')), item(fac('b', 'approved')), item(fac('c', 'approved')), item(fac('d', 'rejected', { rejectReason: 'x' }))], {
        fromCache: false,
      }),
    )
    expect(screen.getByText(`1 ${en.survey.list.pending}`)).toBeInTheDocument()
    expect(screen.getByText(`2 ${en.survey.list.approved}`)).toBeInTheDocument()
    expect(screen.getByText(`1 ${en.survey.list.rejected}`)).toBeInTheDocument()
  })

  it('shows the empty state', () => {
    setup()
    act(() => emit([], { fromCache: false }))
    expect(screen.getByText(en.survey.list.empty)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(en.survey.list.add) })).toHaveAttribute('href', '/new')
  })

  it('a pendingWrite item shows the saved-on-phone chip and keeps its outbox entry', () => {
    seedOutbox([{ fid: 'a', savedAt: 1, state: 'saved', submittedAt: 1 }])
    setup()
    act(() => emit([item(fac('a', 'pending'), true)], { fromCache: true }))
    expect(screen.getAllByText(en.survey.list.savedOnPhone).length).toBeGreaterThan(0)
    expect(state()).toEqual([{ fid: 'a', state: 'saved', error: undefined }])
  })

  it('with editing off, a rejected item shows the reason but no edit or Fix link; pending and approved have none either', () => {
    setup()
    act(() =>
      emit([item(fac('r', 'rejected', { rejectReason: 'Wrong pin' })), item(fac('p', 'pending')), item(fac('ok', 'approved'))], { fromCache: false }),
    )
    expect(screen.getByText('Wrong pin')).toBeInTheDocument()
    expect(screen.getByText(en.survey.list.adminReason)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: en.survey.list.fixResubmit })).toBeNull()
    expect(screen.queryByRole('link', { name: /Factory/ })).toBeNull()
    expect(document.querySelector('a[href*="edit/"]')).toBeNull()
  })

  it('a failed outbox entry shows upload failed with the access-off text', () => {
    seedOutbox([{ fid: 'z', savedAt: 1, state: 'failed', error: 'accessOff', submittedAt: 1 }])
    setup()
    act(() => emit([], { fromCache: true }))
    expect(screen.getByText(en.survey.list.uploadFailed)).toBeInTheDocument()
    expect(screen.getByText(en.errors.accessOff)).toBeInTheDocument()
    expect(screen.getByText(en.survey.list.untitled)).toBeInTheDocument()
  })

  it('an upload that failed on quota shows the service-busy message', () => {
    seedOutbox([{ fid: 'z', savedAt: 1, state: 'failed', error: 'quota', submittedAt: 1 }])
    setup()
    act(() => emit([], { fromCache: true }))
    expect(screen.getByText('The service is busy right now — please try again later')).toBeInTheDocument()
  })

  it('an upload that failed on quota shows the service-busy message', () => {
    seedOutbox([{ fid: 'z', savedAt: 1, state: 'failed', error: 'quota', submittedAt: 1 }])
    setup()
    act(() => emit([], { fromCache: true }))
    expect(screen.getByText('The service is busy right now — please try again later')).toBeInTheDocument()
  })

  it('a server snapshot without an outbox fid marks it failed; a cache snapshot does not', () => {
    seedOutbox([{ fid: 'z', savedAt: 1, state: 'saved', submittedAt: 1 }])
    setup()
    act(() => emit([], { fromCache: true }))
    expect(state()[0].state).toBe('saved')
    expect(screen.getByText(en.survey.list.savedOnPhone, { selector: '[data-chip]' })).toBeInTheDocument()
    act(() => emit([], { fromCache: false }))
    expect(state()).toEqual([{ fid: 'z', state: 'failed', error: 'generic' }])
    expect(screen.getByText(en.survey.list.uploadFailed)).toBeInTheDocument()
  })

  it('confirmed docs are removed from the outbox', () => {
    seedOutbox([{ fid: 'a', savedAt: 1, state: 'saved', submittedAt: 1 }])
    setup()
    act(() => emit([item(fac('a', 'pending'), false)], { fromCache: false }))
    expect(state()).toEqual([])
  })

  it('subscription errors show a banner', () => {
    setup()
    act(() => fail('offline'))
    expect(screen.getByText(en.errors.offline)).toBeInTheDocument()
  })

  it('failed chip text is not a retry promise', () => {
    seedOutbox([{ fid: 'z', savedAt: 1, state: 'failed', error: 'accessOff', submittedAt: 1 }])
    setup()
    act(() => emit([], { fromCache: true }))
    const chip = screen.getByText(en.survey.list.uploadFailed, { selector: '[data-chip]' })
    expect(chip).toHaveTextContent("Couldn't upload")
    expect(chip.textContent).not.toMatch(/keep trying/)
  })

  it('shows loading, not the empty state, before the first snapshot', () => {
    setup()
    expect(screen.getByRole('status', { name: en.common.loading })).toBeInTheDocument()
    expect(screen.queryByText(en.survey.list.empty)).toBeNull()
    act(() => emit([], { fromCache: true }))
    expect(screen.queryByRole('status', { name: en.common.loading })).toBeNull()
    expect(screen.getByText(en.survey.list.empty)).toBeInTheDocument()
  })

  it('a failed entry whose doc arrives on a server snapshot is kept for the user to resume', () => {
    seedOutbox([{ fid: 'a', savedAt: 1, state: 'failed', error: 'generic', submittedAt: 1 }])
    setup()
    act(() => emit([item(fac('a', 'pending'), false)], { fromCache: false }))
    expect(state()).toEqual([{ fid: 'a', state: 'failed', error: 'generic' }])
    expect(screen.getByText(en.survey.list.uploadFailed, { selector: '[data-chip]' })).toBeInTheDocument()
  })

  it('a resubmit whose server doc is still the old version shows upload failed, not Pending', () => {
    const submitted = new Date(2026, 9, 21).getTime() + 60 * 60_000 // an hour after the doc's updatedAt
    seedOutbox([{ fid: 'a', savedAt: submitted, state: 'saved', submittedAt: submitted, kind: 'edit' }])
    setup()
    act(() => emit([item(fac('a', 'rejected', { rejectReason: 'x' }), false)], { fromCache: false }))
    expect(state()).toEqual([{ fid: 'a', state: 'failed', error: 'rejected' }])
    expect(screen.getByText(en.survey.list.uploadFailed, { selector: '[data-chip]' })).toBeInTheDocument()
    expect(screen.getByText(en.errors.rejected)).toBeInTheDocument()
  })

  it('another user on the same phone never sees u1 entries', () => {
    localStorage.setItem('hscode.outbox.u2', JSON.stringify([{ fid: 'theirs', savedAt: 1, submittedAt: 1, state: 'failed', error: 'generic' }]))
    setup()
    act(() => emit([], { fromCache: true }))
    expect(screen.queryByText(en.survey.list.uploadFailed)).toBeNull()
  })

  it('a failed row opens its draft as new?resume, never edit, whether or not the doc is on the server', () => {
    seedOutbox([
      { fid: 'z', savedAt: 1, state: 'failed', error: 'rejected', submittedAt: 1 },
      { fid: 'a', savedAt: 1, state: 'failed', error: 'rejected', submittedAt: 1, kind: 'edit' },
    ])
    setup()
    act(() => emit([item(fac('a', 'pending'), true)], { fromCache: true }))
    expect(screen.getByRole('link', { name: new RegExp(en.survey.list.untitled) })).toHaveAttribute('href', '/new?resume=z')
    expect(screen.getByRole('link', { name: /Factory a/ })).toHaveAttribute('href', '/new?resume=a')
  })

  it('shows the storage warning when the stepper says the outbox could not be saved', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { storageFull: true } }]}>
        <MySubmissions />
      </MemoryRouter>,
    )
    expect(screen.getByText(en.errors.storageFull)).toBeInTheDocument()
  })
})

