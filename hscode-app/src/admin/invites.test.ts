import { randomCode } from './invites'

describe('randomCode', () => {
  it('zero-pads to 6 digits', () => {
    expect(randomCode(() => 0)).toBe('000000')
    expect(randomCode(() => 42913 / 1_000_000)).toBe('042913')
    expect(randomCode(() => 0.9999999)).toBe('999999')
  })

  it('defaults to crypto and always yields 6 digits', () => {
    for (let i = 0; i < 50; i++) expect(randomCode()).toMatch(/^\d{6}$/)
  })
})
