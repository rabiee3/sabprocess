import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { initI18n, setLanguage } from '../i18n'
import en from '../i18n/en.json'
import ar from '../i18n/ar.json'
import { Component as Splash } from './Splash'

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

function setup() {
  const router = createMemoryRouter([
    { path: '/', element: <Splash /> },
    { path: '*', element: <Where /> },
  ])
  render(<RouterProvider router={router} />)
}

describe('Splash', () => {
  beforeEach(async () => {
    initI18n()
    await setLanguage('en')
  })

  it('has one h1 with the headline and the CTAs link to the right places', () => {
    setup()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: en.home.headline })).toBeInTheDocument()
    for (const l of screen.getAllByRole('link', { name: en.home.findFactories })) expect(l).toHaveAttribute('href', '/map')
    expect(screen.getByRole('link', { name: en.home.imSurveyor })).toHaveAttribute('href', '/survey')
    expect(screen.getByRole('link', { name: en.home.forSurveyors })).toHaveAttribute('href', '/survey')
    for (const l of screen.getAllByRole('link', { name: en.home.admin })) expect(l).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'sabprocess.com' })).toHaveAttribute('href', 'https://sabprocess.com')
  })

  it('renders the Arabic copy', async () => {
    await setLanguage('ar')
    setup()
    expect(screen.getByRole('heading', { level: 1, name: ar.home.headline })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: ar.home.imSurveyor })).toHaveAttribute('href', '/survey')
    expect(screen.getAllByRole('link', { name: ar.home.findFactories })[0]).toHaveAttribute('href', '/map')
  })

  it('submits the search to /map?q=', async () => {
    setup()
    const u = userEvent.setup()
    await u.type(screen.getByRole('searchbox', { name: en.home.searchLabel }), 'HS 8544{Enter}')
    expect(screen.getByTestId('where')).toHaveTextContent('/map?q=HS%208544')
  })

  it('chips navigate with their text', async () => {
    setup()
    const u = userEvent.setup()
    await u.click(screen.getByRole('link', { name: en.home.chipPlastic }))
    expect(screen.getByTestId('where')).toHaveTextContent('/map?q=Plastic%20packaging')
  })

  it('keeps the logo dir=ltr and the pattern aria-hidden', () => {
    setup()
    expect(screen.getByRole('img', { name: 'HSCode' }).closest('[dir="ltr"]')).not.toBeNull()
    expect(document.querySelector('img[aria-hidden="true"]')).toHaveAttribute('alt', '')
  })
})
