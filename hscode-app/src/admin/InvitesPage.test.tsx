import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import type { Invite, Surveyor } from './types'

vi.mock('../firebase', () => ({ db: {} }))
const generateInvite = vi.fn()
const cancelInvite = vi.fn()
let pushInvites: (r: Invite[]) => void
vi.mock('./invites', () => ({
  generateInvite: (...a: unknown[]) => generateInvite(...a),
  cancelInvite: (...a: unknown[]) => cancelInvite(...a),
  subscribeInvites: (cb: (r: Invite[]) => void) => {
    pushInvites = cb
    return () => {}
  },
}))
let pushSurveyors: (r: Surveyor[]) => void
vi.mock('./surveyors', () => ({
  subscribeSurveyors: (cb: (r: Surveyor[]) => void) => {
    pushSurveyors = cb
    return () => {}
  },
}))

import { InvitesPage } from './InvitesPage'

const d = new Date('2026-10-20')
const invites: Invite[] = [
  { code: '111111', label: 'Fresh', usedBy: null, cancelled: false, createdAt: d },
  { code: '222222', label: 'Taken', usedBy: 'u1', usedAt: d, cancelled: false, createdAt: d },
  { code: '333333', usedBy: null, cancelled: true, createdAt: d },
]

beforeEach(async () => {
  await initI18n()
  generateInvite.mockReset()
  cancelInvite.mockReset()
  Element.prototype.scrollIntoView = vi.fn()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
})

function setup() {
  render(<InvitesPage />)
  act(() => {
    pushInvites(invites)
    pushSurveyors([{ uid: 'u1', name: 'Mona Adel', email: 'm@x', active: true, createdAt: d }])
  })
}

describe('InvitesPage', () => {
  it('has no h1 and shows counters', () => {
    setup()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByText('1 Unused')).toBeInTheDocument()
    expect(screen.getByText('1 Used')).toBeInTheDocument()
    expect(screen.getByText('1 Cancelled')).toBeInTheDocument()
  })

  it('generates a code, shows it with Copy, and highlights its row', async () => {
    generateInvite.mockResolvedValue('111111')
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setup()
    await user.type(screen.getByLabelText('Label (optional)'), '  Ahmed ')
    await user.click(screen.getByRole('button', { name: 'Generate code' }))
    expect(generateInvite).toHaveBeenCalledWith('Ahmed')
    const banner = await screen.findByRole('status')
    expect(within(banner).getByText('111111')).toBeInTheDocument()
    await user.click(within(banner).getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('111111')
    expect(await within(banner).findByText('Copied')).toBeInTheDocument()
    expect(document.querySelector('[data-highlight="true"]')?.textContent).toContain('111111')
  })

  it('shows an error when generation fails', async () => {
    generateInvite.mockRejectedValue(new Error('collision'))
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Generate code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't find a free code")
  })

  it('offers Cancel only on unused rows and cancels after confirming', async () => {
    cancelInvite.mockResolvedValue(undefined)
    const user = userEvent.setup()
    setup()
    const btns = screen.getAllByRole('button', { name: 'Cancel code' })
    expect(btns).toHaveLength(1)
    await user.click(btns[0])
    expect(cancelInvite).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Yes, cancel code' }))
    expect(cancelInvite).toHaveBeenCalledWith('111111')
  })

  it('keeping the code makes no call; a failed cancel shows an error', async () => {
    cancelInvite.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Cancel code' }))
    await user.click(screen.getByRole('button', { name: 'Keep code' }))
    expect(cancelInvite).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancel code' }))
    await user.click(screen.getByRole('button', { name: 'Yes, cancel code' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows the surveyor name for used codes', () => {
    setup()
    expect(screen.getByText(/Mona Adel/)).toBeInTheDocument()
  })
})
