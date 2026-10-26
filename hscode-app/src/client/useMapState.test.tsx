import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { useMapState } from './useMapState'

function setup(initial = '/') {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  return renderHook(() => ({ s: useMapState(), loc: useLocation(), nav: useNavigate() }), { wrapper })
}

describe('useMapState', () => {
  it('defaults', () => {
    const { result } = setup()
    expect(result.current.s).toMatchObject({ q: '', area: '', sector: '', hs: '', near: false, sel: undefined })
  })

  it('reads all keys from the URL', () => {
    const { result } = setup('/?q=feed&area=a1&sector=food&hs=2309&near=1&sel=f9')
    expect(result.current.s).toMatchObject({ q: 'feed', area: 'a1', sector: 'food', hs: '2309', near: true, sel: 'f9' })
  })

  it('set writes the URL, merges, and removes empty values', () => {
    const { result } = setup('/?area=a1&other=keep')
    act(() => result.current.s.set({ q: 'oil' }))
    expect(new URLSearchParams(result.current.loc.search).get('q')).toBe('oil')
    expect(new URLSearchParams(result.current.loc.search).get('area')).toBe('a1')
    act(() => result.current.s.set({ q: '', near: true }))
    const p = new URLSearchParams(result.current.loc.search)
    expect(p.has('q')).toBe(false)
    expect(p.get('near')).toBe('1')
    act(() => result.current.s.set({ near: false, area: undefined }))
    const p2 = new URLSearchParams(result.current.loc.search)
    expect(p2.has('near')).toBe(false)
    expect(p2.has('area')).toBe(false)
    expect(p2.get('other')).toBe('keep')
  })

  it('typing replaces history; selecting pushes, and Back restores the previous state', () => {
    const { result } = setup('/')
    act(() => result.current.s.set({ q: 'a' }))
    act(() => result.current.s.set({ q: 'ab' }))
    act(() => result.current.s.set({ sel: 'f1' }, { push: true }))
    expect(result.current.s.sel).toBe('f1')
    act(() => result.current.nav(-1))
    expect(result.current.s.sel).toBeUndefined()
    expect(result.current.s.q).toBe('ab')
  })

  it('a replace does not add a history entry', () => {
    const { result } = setup('/')
    act(() => result.current.s.set({ q: 'a' }))
    act(() => result.current.s.set({ q: 'ab' }))
    act(() => result.current.nav(-1))
    // nothing before the first entry, so we stay put
    expect(result.current.s.q).toBe('ab')
  })

  it('clear removes the map keys', () => {
    const { result } = setup('/?q=x&area=a&sector=s&hs=1&near=1&sel=z')
    act(() => result.current.s.clear())
    expect(result.current.loc.search).toBe('')
  })

  it('clear preserves unknown keys', () => {
    const { result } = setup('/?q=x&utm=1')
    act(() => result.current.s.clear())
    expect(result.current.loc.search).toBe('?utm=1')
  })
})
