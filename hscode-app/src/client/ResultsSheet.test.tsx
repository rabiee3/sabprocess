import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { initI18n, setLanguage } from '../i18n'
import en from '../i18n/en.json'
import ar from '../i18n/ar.json'
import { ResultsSheet } from './ResultsSheet'

function renderEmpty(lang: 'en' | 'ar', desktop = false) {
  return render(
    <ResultsSheet entries={[]} loading={false} lang={lang} desktop={desktop} onSelect={vi.fn()} onTry={vi.fn()} />,
  )
}

describe('ResultsSheet empty state', () => {
  beforeEach(() => initI18n())
  afterEach(() => setLanguage('en'))

  it.each([false, true])('in Arabic the "no factories" title appears once (desktop=%s)', (desktop) => {
    setLanguage('ar')
    renderEmpty('ar', desktop)
    expect(screen.getAllByText(ar.map.emptyTitle)).toHaveLength(1)
    // The h2 is the count, as in English ("0 factories"), not a second copy of the empty title.
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(ar.map.emptyTitle)
  })

  it('in English the title appears once and the h2 is the count', () => {
    setLanguage('en')
    renderEmpty('en')
    expect(screen.getAllByText(en.map.emptyTitle)).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('0 factories')
  })

  it('the English suggestion chips are English: no Arabic text', () => {
    setLanguage('en')
    renderEmpty('en')
    const chips = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(chips).toContain(en.home.chipHs)
    expect(chips).toContain(en.home.chipFeed)
    for (const c of chips) expect(c).not.toMatch(/[؀-ۿ]/)
  })

  it('the Arabic suggestion chips are Arabic', () => {
    setLanguage('ar')
    renderEmpty('ar')
    const chips = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(chips).toContain(ar.home.chipFeed)
    expect(ar.home.chipFeed).toMatch(/[؀-ۿ]/)
  })
})
