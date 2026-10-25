import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

let auth: Record<string, unknown> = {}
vi.mock('../auth/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../auth/api', () => ({ claimInvite: vi.fn(), signInWithGoogle: vi.fn(), signOutUser: vi.fn() }))

import { Component as SurveyRoute } from './SurveyRoute'

const user = { uid: 'u1', email: 'a@b.com', displayName: 'A' }
function renderAt(path = '/survey') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SurveyRoute />
    </MemoryRouter>,
  )
}

describe('SurveyRoute', () => {
  beforeEach(() => initI18n())

  it('loading shows a spinner', () => {
    auth = { user: null, role: 'visitor', active: false, loading: true }
    renderAt()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
  it('visitor sees Continue with Google', () => {
    auth = { user: null, role: 'visitor', active: false, loading: false }
    renderAt()
    expect(screen.getByRole('button', { name: en.survey.gate.continueGoogle })).toBeInTheDocument()
  })
  it('client sees the invite screen', () => {
    auth = { user, role: 'client', active: false, loading: false }
    renderAt()
    expect(screen.getByText(en.survey.invite.body)).toBeInTheDocument()
  })
  it('inactive surveyor sees access-off', () => {
    auth = { user, role: 'surveyor', active: false, loading: false }
    renderAt()
    expect(screen.getByText(en.survey.gate.offTitle)).toBeInTheDocument()
  })
  it('active surveyor sees the surveyor area', () => {
    auth = { user, role: 'surveyor', active: true, loading: false }
    renderAt()
    expect(screen.getByRole('heading', { level: 1, name: en.nav.surveyors })).toBeInTheDocument()
  })
  it('admin sees a link to /admin', () => {
    auth = { user, role: 'admin', active: true, loading: false }
    renderAt()
    expect(screen.getByRole('link', { name: en.nav.admin })).toHaveAttribute('href', '/admin')
  })
})
