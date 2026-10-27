import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { initI18n, setLanguage } from '../i18n'
import en from '../i18n/en.json'
import ar from '../i18n/ar.json'
import { DemoBadge } from './DemoBadge'

beforeEach(() => {
  initI18n()
  setLanguage('en')
})

describe('DemoBadge', () => {
  it('renders the single demo.badge key in each language', () => {
    const { unmount } = render(<DemoBadge />)
    expect(screen.getByText(en.demo.badge)).toHaveAttribute('data-demo-badge')
    unmount()
    setLanguage('ar')
    render(<DemoBadge />)
    expect(screen.getByText(ar.demo.badge)).toBeInTheDocument()
  })
  it('accepts extra spacing classes', () => {
    render(<DemoBadge className="me-2" />)
    expect(screen.getByText(en.demo.badge)).toHaveClass('me-2')
  })
})
