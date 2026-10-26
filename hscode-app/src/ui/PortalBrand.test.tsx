import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { initI18n } from '../i18n'
import en from '../i18n/en.json'
import { PortalBrand } from './PortalBrand'

describe('PortalBrand', () => {
  beforeEach(() => initI18n())
  it.each(['surveyor', 'admin'] as const)('links the %s logo to / with its tag', (portal) => {
    render(
      <MemoryRouter>
        <PortalBrand portal={portal} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: en.nav.backToMap })
    expect(link).toHaveAttribute('href', '/')
    expect(link).toHaveTextContent(en.portal[portal])
  })
})
