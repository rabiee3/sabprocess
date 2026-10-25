import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import type { Surveyor } from './types'

vi.mock('../firebase', () => ({ db: {} }))
const setSurveyorActive = vi.fn()
const countSubmissions = vi.fn()
let push: (r: Surveyor[]) => void
vi.mock('./surveyors', () => ({
  subscribeSurveyors: (cb: (r: Surveyor[]) => void) => {
    push = cb
    return () => {}
  },
  setSurveyorActive: (...a: unknown[]) => setSurveyorActive(...a),
  countSubmissions: (...a: unknown[]) => countSubmissions(...a),
}))

import { SurveyorsPage } from './SurveyorsPage'

const d = new Date('2026-10-20')
const rows: Surveyor[] = [
  { uid: 'u1', name: 'Mona Adel', email: 'mona@x.com', active: true, inviteCode: '222222', createdAt: d },
  { uid: 'u2', name: 'Karim', email: 'karim@x.com', active: false, createdAt: d },
]

beforeEach(async () => {
  await initI18n()
  setSurveyorActive.mockReset().mockResolvedValue(undefined)
  countSubmissions.mockReset().mockImplementation(async (uid: string) => {
    if (uid === 'u1') return { pending: 1, approved: 5, rejected: 2 }
    throw new Error('x')
  })
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
})

function setup() {
  render(<SurveyorsPage />)
  act(() => push(rows))
}

describe('SurveyorsPage', () => {
  it('lists surveyors with lazily loaded counts and a dash on error; no h1', async () => {
    setup()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(await screen.findByText('1 pending · 5 approved · 2 rejected')).toBeInTheDocument()
    expect(await screen.findAllByText('—')).not.toHaveLength(0)
    expect(screen.getByText('222222')).toBeInTheDocument()
  })

  it('deactivating asks for confirmation first', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('switch', { name: 'Active: Mona Adel' }))
    expect(setSurveyorActive).not.toHaveBeenCalled()
    expect(screen.getByText("They won't be able to submit factories.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(setSurveyorActive).toHaveBeenCalledWith('u1', false)
  })

  it('keeping active makes no call; reactivating needs no confirm', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('switch', { name: 'Active: Mona Adel' }))
    await user.click(screen.getByRole('button', { name: 'Keep active' }))
    expect(setSurveyorActive).not.toHaveBeenCalled()
    await user.click(screen.getByRole('switch', { name: 'Active: Karim' }))
    expect(setSurveyorActive).toHaveBeenCalledWith('u2', true)
  })
})
