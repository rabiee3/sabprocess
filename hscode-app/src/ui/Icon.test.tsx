import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Icon } from './Icon'

const svg = '<svg width="24" height="24"></svg>'

describe('Icon', () => {
  it('is decorative, never shrinks, and forces the svg to fill its box', () => {
    const { container } = render(<Icon svg={svg} />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toContain('shrink-0')
    expect(el.className).toContain('[&>svg]:size-full')
    expect(el.querySelector('svg')).not.toBeNull()
  })
  it('defaults to size-4 and takes a custom size', () => {
    const a = render(<Icon svg={svg} />).container.firstElementChild as HTMLElement
    expect(a.className).toContain('size-4')
    const b = render(<Icon svg={svg} className="size-6 text-red-600" />).container.firstElementChild as HTMLElement
    expect(b.className).toContain('size-6')
    expect(b.className).not.toContain('size-4')
  })
})
