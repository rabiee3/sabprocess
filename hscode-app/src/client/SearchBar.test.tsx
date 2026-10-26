import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n, setLanguage } from '../i18n'
import { createEngine } from '../search/engine'
import { fixtures } from '../search/fixtures'
import { SearchBar } from './SearchBar'

beforeEach(() => {
  initI18n()
  setLanguage('en')
})

const props = { lang: 'en' as const, value: '', onApply: vi.fn(), onClear: vi.fn() }

describe('SearchBar', () => {
  it('says "Preparing search…" and stays usable while the engine is not ready', async () => {
    const { rerender } = render(<SearchBar engine={null} {...props} />)
    const box = screen.getByRole('combobox', { name: 'Search factories' })
    expect(box).toHaveAttribute('placeholder', 'Preparing search…')
    expect(box).toBeEnabled()
    await userEvent.type(box, 'feed')
    expect(box).toHaveValue('feed')
    rerender(<SearchBar engine={createEngine(fixtures, 'en')} {...props} />)
    expect(box).toHaveAttribute('placeholder', 'Search a product, HS code, or industry…')
  })

  it('a query typed before the engine is ready gets its suggestions once it is', async () => {
    const { rerender } = render(<SearchBar engine={null} {...props} />)
    await userEvent.type(screen.getByRole('combobox'), 'feed')
    expect(screen.queryByRole('option', { name: /Poultry feed/ })).toBeNull()
    rerender(<SearchBar engine={createEngine(fixtures, 'en')} {...props} />)
    const list = await screen.findByRole('listbox')
    expect(await within(list).findByRole('option', { name: /Poultry feed/ })).toBeInTheDocument()
  })

  it('HS name suggestions come from the lazily loaded HS table', async () => {
    render(<SearchBar engine={createEngine(fixtures, 'en')} {...props} />)
    await userEvent.type(screen.getByRole('combobox'), '2309')
    const list = await screen.findByRole('listbox')
    expect(await within(list).findByRole('option', { name: /2309/ })).toBeInTheDocument()
  })
})
