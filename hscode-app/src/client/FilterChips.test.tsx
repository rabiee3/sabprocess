import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { initI18n, setLanguage } from '../i18n'
import { sectors } from '../data'
import { FilterChips } from './FilterChips'

const longest = [...sectors()].sort((a, b) => b.ar.length - a.ar.length)[0]

const show = (p: Partial<React.ComponentProps<typeof FilterChips>> = {}) =>
  render(
    <FilterChips
      lang="ar" area="" sector={longest.id} near={false} locating={false}
      onArea={() => {}} onSector={() => {}} onNear={() => {}} {...p}
    />,
  )

beforeEach(() => {
  initI18n()
  setLanguage('ar')
})

describe('FilterChips', () => {
  it('truncates a long selected label and keeps the full text in title', () => {
    show()
    const chip = screen.getByTitle(longest.ar)
    const label = screen.getByText(longest.ar)
    expect(chip.tagName).toBe('BUTTON')
    expect(label.className).toContain('truncate')
    expect(label.className).toContain('max-w-[14rem]')
  })
  it('wraps on desktop and scrolls below it', () => {
    const { container } = show()
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toContain('lg:flex-wrap')
    expect(row.className).toContain('overflow-x-auto')
  })
  it('puts spinner and icon in the same size-4 box so the label does not move', () => {
    const idle = show()
    const box = (c: HTMLElement) => {
      const btn = c.querySelector('button[aria-pressed]') as HTMLElement
      return btn.firstElementChild as HTMLElement
    }
    expect(box(idle.container).className).toContain('size-4')
    expect(box(idle.container).querySelector('svg')).not.toBeNull()
    idle.unmount()
    const busy = show({ locating: true })
    expect(box(busy.container).className).toContain('size-4')
    expect(box(busy.container).querySelector('[role="status"]')).not.toBeNull()
  })
})
