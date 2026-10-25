import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'

let auth: Record<string, unknown> = {}
vi.mock('../auth/useAuth', () => ({ useAuth: () => auth }))
const signOutUser = vi.fn()
vi.mock('../auth/api', () => ({ signInAdmin: vi.fn(), signOutUser: () => signOutUser() }))
vi.mock('../firebase', () => ({ db: {} }))
const getCount = vi.fn()
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getCountFromServer: () => getCount(),
}))

import { Component as AdminRoute } from './AdminRoute'

const user = { uid: 'u1', email: 'admin@sab.example', displayName: 'A' }
function renderAt(path = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminRoute />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminRoute', () => {
  beforeEach(() => {
    initI18n()
    getCount.mockReset().mockResolvedValue({ data: () => ({ count: 4 }) })
    signOutUser.mockReset()
  })

  it('loading shows a spinner and an sr-only h1', () => {
    auth = { user: null, role: 'visitor', active: false, loading: true }
    renderAt()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: en.common.loading })).toBeInTheDocument()
  })
  it('visitor sees the sign-in form', () => {
    auth = { user: null, role: 'visitor', active: false, loading: false }
    renderAt()
    expect(screen.getByLabelText(en.admin.signIn.email)).toBeInTheDocument()
  })
  it('a client sees the not-admin message with sign out and a survey link', async () => {
    auth = { user, role: 'client', active: false, loading: false }
    renderAt()
    expect(screen.getByText(en.admin.notAdmin.title)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: en.admin.notAdmin.survey })).toHaveAttribute('href', '/survey')
    await userEvent.click(screen.getByRole('button', { name: en.nav.signOut }))
    expect(signOutUser).toHaveBeenCalled()
  })
  it('admin sees 5 nav links, the pending badge and redirects to review', async () => {
    auth = { user, role: 'admin', active: true, loading: false }
    renderAt()
    const nav = screen.getByRole('navigation', { name: en.admin.navLabel })
    expect(within(nav).getAllByRole('link')).toHaveLength(5)
    expect(await within(nav).findByText('4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: en.admin.nav.review })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: new RegExp(en.admin.nav.review) })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(user.email)).toBeInTheDocument()
  })
  it('hides the badge when the count fails', async () => {
    getCount.mockRejectedValue(new Error('x'))
    auth = { user, role: 'admin', active: true, loading: false }
    renderAt('/admin/surveyors')
    expect(screen.getByRole('heading', { level: 1, name: en.admin.nav.surveyors })).toBeInTheDocument()
    await Promise.resolve()
    expect(screen.queryByText('4')).not.toBeInTheDocument()
  })
  it('the menu button toggles the drawer', async () => {
    auth = { user, role: 'admin', active: true, loading: false }
    renderAt()
    const btn = screen.getByRole('button', { name: en.admin.menu })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })
})
