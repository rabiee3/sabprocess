import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { initI18n, setLanguage } from '../../i18n'
import en from '../../i18n/en.json'
import ar from '../../i18n/ar.json'
import { IntroOverlay } from './IntroOverlay'

function setup() {
  const onDismiss = vi.fn()
  const onSearch = vi.fn()
  render(
    <MemoryRouter>
      <IntroOverlay onDismiss={onDismiss} onSearch={onSearch} />
    </MemoryRouter>,
  )
  return { onDismiss, onSearch, dialog: screen.getByRole('dialog') }
}

describe('IntroOverlay', () => {
  beforeEach(async () => {
    initI18n()
    await setLanguage('en')
  })

  it('is a modal dialog labelled by its one h1, which takes focus', () => {
    const { dialog } = setup()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const h1s = within(dialog).getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent(en.home.headline)
    expect(screen.getByRole('dialog', { name: en.home.headline })).toBe(dialog)
    expect(h1s[0]).toHaveFocus()
  })

  it('Escape calls onDismiss', async () => {
    const { onDismiss } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('the close button calls onDismiss', async () => {
    const { onDismiss } = setup()
    await userEvent.click(screen.getByRole('button', { name: en.intro.close }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('"Find factories" on the phone closes it without a search', async () => {
    const { onDismiss, onSearch } = setup()
    const [phone] = screen.getAllByRole('button', { name: en.home.findFactories })
    expect(phone).toHaveAttribute('type', 'button')
    await userEvent.click(phone)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('the desktop search calls onSearch(q) then onDismiss', async () => {
    const { onDismiss, onSearch } = setup()
    await userEvent.type(screen.getByRole('searchbox', { name: en.home.searchLabel }), ' HS 8544 {Enter}')
    expect(onSearch).toHaveBeenCalledWith('HS 8544')
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onSearch.mock.invocationCallOrder[0]).toBeLessThan(onDismiss.mock.invocationCallOrder[0])
  })

  it('an empty desktop search just closes', async () => {
    const { onDismiss, onSearch } = setup()
    await userEvent.click(within(screen.getByRole('search')).getByRole('button', { name: en.home.findFactories }))
    expect(onSearch).not.toHaveBeenCalled()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('a "Try" chip searches with its text', async () => {
    const { onDismiss, onSearch } = setup()
    const chip = screen.getByRole('link', { name: en.home.chipPlastic })
    expect(chip).toHaveAttribute('href', `/?q=${encodeURIComponent(en.home.chipPlastic)}`)
    await userEvent.click(chip)
    expect(onSearch).toHaveBeenCalledWith(en.home.chipPlastic)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has exactly one staff link, to /survey, and no link to /admin', () => {
    const { dialog } = setup()
    const links = within(dialog).getAllByRole('link')
    const survey = links.filter((l) => l.getAttribute('href')?.endsWith('/survey'))
    expect(survey).toHaveLength(1)
    expect(survey[0]).toHaveTextContent(en.home.surveyorCta)
    expect(links.filter((l) => l.getAttribute('href')?.includes('/admin'))).toHaveLength(0)
    expect(dialog.querySelectorAll('a[href*="/admin"]')).toHaveLength(0)
  })

  it('keeps the footer credit with the sabprocess.com link', () => {
    setup()
    expect(screen.getByText(en.home.by, { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'sabprocess.com' })).toHaveAttribute('href', 'https://sabprocess.com')
  })

  it('Tab from the last control wraps to the first, never reaching controls outside', async () => {
    render(
      <MemoryRouter>
        <button type="button">before</button>
        <IntroOverlay onDismiss={() => {}} onSearch={() => {}} />
        <button type="button">after</button>
      </MemoryRouter>,
    )
    const dialog = screen.getByRole('dialog')
    const u = userEvent.setup()
    const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button, input')
    focusables[focusables.length - 1].focus()
    await u.tab()
    expect(focusables[0]).toHaveFocus()
    await u.tab({ shift: true })
    expect(focusables[focusables.length - 1]).toHaveFocus()
  })

  it('returns focus to the opener on unmount', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(
      <MemoryRouter>
        <IntroOverlay onDismiss={() => {}} onSearch={() => {}} />
      </MemoryRouter>,
    )
    expect(opener).not.toHaveFocus()
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('with no real opener (first visit), returns focus to the fallback target on unmount', () => {
    const target = document.createElement('input')
    document.body.appendChild(target)
    ;(document.activeElement as HTMLElement | null)?.blur()
    const { unmount } = render(
      <MemoryRouter>
        <IntroOverlay onDismiss={() => {}} onSearch={() => {}} returnFocus={() => target} />
      </MemoryRouter>,
    )
    unmount()
    expect(target).toHaveFocus()
    target.remove()
  })

  it('a live opener wins over the fallback', () => {
    const opener = document.createElement('button')
    const target = document.createElement('input')
    document.body.append(opener, target)
    opener.focus()
    const { unmount } = render(
      <MemoryRouter>
        <IntroOverlay onDismiss={() => {}} onSearch={() => {}} returnFocus={() => target} />
      </MemoryRouter>,
    )
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
    target.remove()
  })

  it('renders the Arabic copy', async () => {
    await setLanguage('ar')
    setup()
    expect(screen.getByRole('heading', { level: 1, name: ar.home.headline })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ar.intro.close })).toBeInTheDocument()
  })
})
