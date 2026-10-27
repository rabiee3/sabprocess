import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'

describe('index.html', () => {
  it('on Android the keyboard shrinks the page, so the results sheet stays above it', () => {
    const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? ''
    expect(viewport.split(/,\s*/)).toContain('interactive-widget=resizes-content')
    expect(viewport).toContain('width=device-width')
  })
})
