import { describe, expect, it } from 'vitest'
import { safeUrl, whatsappHref } from './contactLinks'

describe('contactLinks', () => {
  it('links http(s) and bare hosts only', () => {
    expect(safeUrl('https://a.com/x')).toBe('https://a.com/x')
    expect(safeUrl('a.com')).toBe('https://a.com/')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,x')).toBeNull()
    expect(safeUrl('  ')).toBeNull()
  })
  it('builds wa.me links with the Egypt country code', () => {
    expect(whatsappHref('010 1234 5678')).toBe('https://wa.me/201012345678')
    expect(whatsappHref('+20 10 1234 5678')).toBe('https://wa.me/201012345678')
    expect(whatsappHref('٠١٠١٢٣٤٥٦٧٨')).toBe('https://wa.me/201012345678')
    expect(whatsappHref('abc')).toBeNull()
  })
})
