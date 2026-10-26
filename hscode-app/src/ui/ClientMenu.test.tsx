import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { initI18n, setLanguage } from '../i18n'
import en from '../i18n/en.json'
import { ClientMenu } from './ClientMenu'

function setup(props: { onAbout?: () => void; onInstall?: () => void } = {}) {
  const onAbout = props.onAbout ?? vi.fn()
  render(
    <MemoryRouter>
      <p>outside</p>
      <ClientMenu onAbout={onAbout} onInstall={props.onInstall} />
    </MemoryRouter>,
  )
  return { onAbout, button: screen.getByRole('button', { name: en.menu.open }) }
}

describe('ClientMenu', () => {
  beforeEach(async () => {
    initI18n()
    await setLanguage('en')
  })

  it('is a labelled menu button, closed at first', () => {
    const { button } = setup()
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('lists About, For surveyors, Install in order and focuses the first', async () => {
    const { button } = setup({ onInstall: vi.fn() })
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const items = screen.getAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual([en.menu.about, en.menu.surveyors, en.menu.install])
    expect(items[1]).toHaveAttribute('href', '/survey')
    expect(items[0]).toHaveFocus()
  })

  it('hides Install without onInstall', async () => {
    const { button } = setup()
    await userEvent.click(button)
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([en.menu.about, en.menu.surveyors])
  })

  it('Arrow keys, Home and End move focus with wrap-around', async () => {
    const { button } = setup({ onInstall: vi.fn() })
    await userEvent.click(button)
    const items = screen.getAllByRole('menuitem')
    await userEvent.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(items[2]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(items[2]).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(items[0]).toHaveFocus()
  })

  it('Escape closes and returns focus to the button', async () => {
    const { button } = setup()
    await userEvent.click(button)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('a click outside closes it', async () => {
    const { button } = setup()
    await userEvent.click(button)
    await userEvent.click(screen.getByText('outside'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('About closes the menu, refocuses the button and calls onAbout', async () => {
    const { button, onAbout } = setup()
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('menuitem', { name: en.menu.about }))
    expect(onAbout).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button).toHaveFocus()
  })

  it('Install calls onInstall', async () => {
    const onInstall = vi.fn()
    const { button } = setup({ onInstall })
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('menuitem', { name: en.menu.install }))
    expect(onInstall).toHaveBeenCalledTimes(1)
  })

  it('has no link to /admin', async () => {
    const { button } = setup({ onInstall: vi.fn() })
    await userEvent.click(button)
    expect(document.querySelectorAll('a[href*="/admin"]')).toHaveLength(0)
  })

  it('opens on the inline end, above the map and inside the viewport', async () => {
    const { button } = setup()
    await userEvent.click(button)
    const menu = screen.getByRole('menu')
    expect(menu.className).toContain('end-0')
    expect(menu.className).toContain('z-[1300]')
    expect(menu.className).toContain('max-w-[calc(100vw-1rem)]')
    for (const item of screen.getAllByRole('menuitem')) expect(item.className).toContain('min-h-touch')
  })
})
