import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n, setLanguage } from '../i18n'
import { LangToggle } from './LangToggle'
import { Bdi } from './Bdi'

function reset() {
  localStorage.clear()
  document.documentElement.lang = ''
  document.documentElement.dir = ''
}

describe('LangToggle', () => {
  beforeEach(async () => {
    reset()
    initI18n()
    await setLanguage('en')
    reset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    reset()
  })

  it('switches to Arabic: sets dir=rtl, lang=ar and persists', async () => {
    initI18n()
    render(<LangToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'ع' }))
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
    expect(localStorage.getItem('hscode.lang')).toBe('ar')
    expect(screen.getByRole('button', { name: 'ع' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches back to English: ltr', async () => {
    initI18n()
    render(<LangToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'ع' }))
    await userEvent.click(screen.getByRole('button', { name: 'EN' }))
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('hscode.lang')).toBe('en')
  })

  it('restores the saved language on init', () => {
    localStorage.setItem('hscode.lang', 'ar')
    initI18n()
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
  })

  it('defaults to English when nothing is saved', () => {
    initI18n()
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
  })

  it('does not crash when localStorage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => initI18n()).not.toThrow()
    render(<LangToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'ع' }))
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('renders the Arabic label in the Arabic font', () => {
    initI18n()
    render(<LangToggle />)
    expect(screen.getByRole('button', { name: 'ع' })).toHaveClass('font-ar')
  })
})

describe('Bdi', () => {
  it('renders a bdi element', () => {
    const { container } = render(<Bdi>Acme</Bdi>)
    expect(container.querySelector('bdi')).toHaveTextContent('Acme')
  })
})
