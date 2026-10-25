import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'
import type { Factory } from '../lib/types'
import type { OutboxEntry } from './outbox'
import type { SubmissionItem, SurveyErrorCode } from './repo'

type Cb = (items: SubmissionItem[], meta: { fromCache: boolean }) => void
let emit: Cb
let fail: (c: SurveyErrorCode) => void
let entries: OutboxEntry[] = []
const remove = vi.fn((fid: string) => {
  entries = entries.filter((e) => e.fid !== fid)
})
const markFailed = vi.fn((fid: string, error: SurveyErrorCode) => {
  entries = entries.map((e) => (e.fid === fid ? { ...e, state: 'failed', error } : e))
})

vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }))
vi.mock('./repo', () => ({
  subscribeMySubmissions: (_uid: string, cb: Cb, onError: (c: SurveyErrorCode) => void) => {
    emit = cb
    fail = onError
    return () => {}
  },
}))
vi.mock('./outbox', () => ({
  outbox: {
    list: (uid: string) => (uid === 'u1' ? entries : []),
    remove: (_u: string, f: string) => remove(f),
    markFailed: (_u: string, f: string, e: SurveyErrorCode) => markFailed(f, e),
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
    entries = []
    remove.mockClear()
    markFailed.mockClear()
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
    entries = [{ fid: 'a', savedAt: 1, state: 'saved', submittedAt: 1 }]
    setup()
    act(() => emit([item(fac('a', 'pending'), true)], { fromCache: true }))
    expect(screen.getAllByText(en.survey.list.savedOnPhone).length).toBeGreaterThan(0)
    expect(remove).not.toHaveBeenCalled()
  })

  it('a rejected item shows the reason and a Fix link; pending links to edit; approved has no link', () => {
    setup()
    act(() =>
      emit([item(fac('r', 'rejected', { rejectReason: 'Wrong pin' })), item(fac('p', 'pending')), item(fac('ok', 'approved'))], { fromCache: false }),
    )
    expect(screen.getByText('Wrong pin')).toBeInTheDocument()
    expect(screen.getByText(en.survey.list.adminReason)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: en.survey.list.fixResubmit })).toHaveAttribute('href', '/edit/r')
    expect(screen.getByRole('link', { name: /Factory p/ })).toHaveAttribute('href', '/edit/p')
    expect(screen.queryByRole('link', { name: /Factory ok/ })).toBeNull()
  })

  it('a failed outbox entry shows upload failed with the access-off text', () => {
    entries = [{ fid: 'z', savedAt: 1, state: 'failed', error: 'accessOff', submittedAt: 1 }]
    setup()
    act(() => emit([], { fromCache: true }))
    expect(screen.getByText(en.survey.list.uploadFailed)).toBeInTheDocument()
    expect(screen.getByText(en.errors.accessOff)).toBeInTheDocument()
    expect(screen.getByText(en.survey.list.untitled)).toBeInTheDocument()
  })

  it('a server snapshot without an outbox fid marks it failed; a cache snapshot does not', () => {
    entries = [{ fid: 'z', savedAt: 1, state: 'saved', submittedAt: 1 }]
    setup()
    act(() => emit([], { fromCache: true }))
    expect(markFailed).not.toHaveBeenCalled()
    expect(screen.getByText(en.survey.list.savedOnPhone, { selector: '[data-chip]' })).toBeInTheDocument()
    act(() => emit([], { fromCache: false }))
    expect(markFailed).toHaveBeenCalledWith('z', 'generic')
    expect(screen.getByText(en.survey.list.uploadFailed)).toBeInTheDocument()
  })

  it('confirmed docs are removed from the outbox', () => {
    entries = [{ fid: 'a', savedAt: 1, state: 'saved', submittedAt: 1 }]
    setup()
    act(() => emit([item(fac('a', 'pending'), false)], { fromCache: false }))
    expect(remove).toHaveBeenCalledWith('a')
    expect(markFailed).not.toHaveBeenCalled()
  })

  it('subscription errors show a banner', () => {
    setup()
    act(() => fail('offline'))
    expect(screen.getByText(en.errors.offline)).toBeInTheDocument()
  })

  it('failed chip text is not a retry promise', () => {
    entries = [{ fid: 'z', savedAt: 1, state: 'failed', error: 'accessOff', submittedAt: 1 }]
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

  it('a failed entry whose doc arrives on a server snapshot is removed', () => {
    entries = [{ fid: 'a', savedAt: 1, state: 'failed', error: 'generic', submittedAt: 1 }]
    setup()
    act(() => emit([item(fac('a', 'pending'), false)], { fromCache: false }))
    expect(remove).toHaveBeenCalledWith('a')
    expect(screen.queryByText(en.survey.list.uploadFailed)).toBeNull()
  })
})
