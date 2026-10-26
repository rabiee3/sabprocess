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
    // WCAG 2.5.3 label in name: the name is the visible logo + tag; "Back to the map" is the description.
    const link = screen.getByRole('link', { name: `HSCode ${en.portal[portal]}` })
    expect(link).toHaveAttribute('href', '/')
    expect(link).not.toHaveAttribute('aria-label')
    expect(link).toHaveAccessibleDescription(en.nav.backToMap)
  })
})
