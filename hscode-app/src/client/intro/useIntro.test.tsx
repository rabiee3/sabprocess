import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { safeStorage } from '../../lib/safeStorage'
import { INTRO_KEY, useIntro } from './useIntro'

const at = (url: string, state?: unknown) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[state === undefined ? url : { pathname: url, state }]}>{children}</MemoryRouter>
  }

describe('useIntro', () => {
  beforeEach(() => safeStorage.remove(INTRO_KEY))
  afterEach(() => vi.restoreAllMocks())

  it('uses the hscode.introSeen key', () => {
    expect(INTRO_KEY).toBe('hscode.introSeen')
  })

  it('is open on / with no query and nothing stored', () => {
    const { result } = renderHook(() => useIntro(), { wrapper: at('/') })
    expect(result.current.open).toBe(true)
  })

  it('is closed when the URL has a query', () => {
    const { result } = renderHook(() => useIntro(), { wrapper: at('/?q=x') })
    expect(result.current.open).toBe(false)
  })

  it('is closed on other paths', () => {
    const { result } = renderHook(() => useIntro(), { wrapper: at('/f/abc') })
    expect(result.current.open).toBe(false)
  })

  it('is closed when already dismissed on this device', () => {
    safeStorage.set(INTRO_KEY, '1')
    const { result } = renderHook(() => useIntro(), { wrapper: at('/') })
    expect(result.current.open).toBe(false)
  })

  it('dismiss stores "1" and closes', () => {
    const { result } = renderHook(() => useIntro(), { wrapper: at('/') })
    act(() => result.current.dismiss())
    expect(result.current.open).toBe(false)
    expect(safeStorage.get(INTRO_KEY)).toBe('1')
  })

  it('dismiss still closes when storage is blocked', () => {
    vi.spyOn(safeStorage, 'set').mockReturnValue(false)
    const { result } = renderHook(() => useIntro(), { wrapper: at('/') })
    act(() => result.current.dismiss())
    expect(result.current.open).toBe(false)
  })

  it('show() reopens; dismissing it again does not touch storage and does not throw', () => {
    safeStorage.set(INTRO_KEY, '1')
    const set = vi.spyOn(safeStorage, 'set')
    const { result } = renderHook(() => useIntro(), { wrapper: at('/?q=feed') })
    act(() => result.current.show())
    expect(result.current.open).toBe(true)
    expect(() => act(() => result.current.dismiss())).not.toThrow()
    expect(result.current.open).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })

  it('opens as "About" when sent from another page, without storing on dismiss', () => {
    safeStorage.set(INTRO_KEY, '1')
    const set = vi.spyOn(safeStorage, 'set')
    const { result } = renderHook(() => useIntro(), { wrapper: at('/', { intro: 'about' }) })
    expect(result.current.open).toBe(true)
    act(() => result.current.dismiss())
    expect(result.current.open).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })

  it('clears the About router state once read, so a reload or Back does not replay it', async () => {
    safeStorage.set(INTRO_KEY, '1')
    const { result } = renderHook(() => ({ intro: useIntro(), loc: useLocation() }), {
      wrapper: at('/', { intro: 'about' }),
    })
    await vi.waitFor(() => expect(result.current.loc.state).toBeNull())
    expect(result.current.loc.pathname).toBe('/')
    expect(result.current.intro.open).toBe(true)
  })
})
