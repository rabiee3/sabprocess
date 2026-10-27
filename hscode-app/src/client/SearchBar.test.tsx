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
    // The heading's name, not /2309/: that also matches the always-present "Search for “2309”" option.
    const heading = await within(list).findByRole('option', { name: /animal feeding/i }, { timeout: 5000 })
    expect(heading).toHaveTextContent('2309')
  })
})

// Phone: closing the keyboard (Back, or tapping the map) must not lose what was typed.
describe('SearchBar: closing the keyboard applies the typed text', () => {
  const setup = (value = '') => {
    const onApply = vi.fn()
    const onClear = vi.fn()
    render(<SearchBar engine={createEngine(fixtures, 'en')} lang="en" value={value} onApply={onApply} onClear={onClear} />)
    return { box: screen.getByRole('combobox'), onApply, onClear }
  }

  it('blurring with new text applies it as the search, once', async () => {
    const { box, onApply } = setup()
    await userEvent.type(box, '  starch ')
    box.blur()
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith({ q: 'starch', hs: '' })
  })

  it('blurring with nothing new typed applies nothing', async () => {
    const { box, onApply } = setup('feed')
    box.focus()
    box.blur()
    await userEvent.type(box, '   ')
    await userEvent.clear(box)
    box.blur()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('Enter applies once; the blur that follows does not apply again', async () => {
    const { box, onApply } = setup()
    await userEvent.type(box, 'starch{Enter}')
    box.blur()
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('the clear button keeps focus in the box, so clearing never applies the half-typed text', async () => {
    const { box, onApply, onClear } = setup()
    await userEvent.type(box, 'star')
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
    expect(box).toHaveFocus()
  })

  it('the keyboard closing without a blur (the visual viewport grows back) applies the text and leaves the box', async () => {
    const vv = Object.assign(new EventTarget(), { height: 400 })
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
    try {
      const { box, onApply } = setup()
      await userEvent.type(box, 'glucose')
      vv.height = 800
      vv.dispatchEvent(new Event('resize'))
      expect(onApply).toHaveBeenCalledWith({ q: 'glucose', hs: '' })
      expect(box).not.toHaveFocus()
    } finally {
      Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
    }
  })
})
