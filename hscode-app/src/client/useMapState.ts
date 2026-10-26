import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

const KEYS = ['q', 'area', 'sector', 'hs', 'near', 'sel'] as const

export type MapStatePatch = {
  q?: string
  area?: string
  sector?: string
  hs?: string
  near?: boolean
  sel?: string
}

/** Map and search state lives in the URL so links and Back work. Unknown params are preserved. */
export function useMapState() {
  const [params, setParams] = useSearchParams()

  const set = useCallback(
    (patch: MapStatePatch, opts?: { push?: boolean }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const k of Object.keys(patch) as (keyof MapStatePatch)[]) {
            const v = patch[k]
            if (v === undefined || v === '' || v === false) next.delete(k)
            else next.set(k, v === true ? '1' : v)
          }
          return next
        },
        { replace: !opts?.push },
      )
    },
    [setParams],
  )

  const clear = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const k of KEYS) next.delete(k)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  return useMemo(
    () => ({
      q: params.get('q') ?? '',
      area: params.get('area') ?? '',
      sector: params.get('sector') ?? '',
      hs: params.get('hs') ?? '',
      near: params.get('near') === '1',
      sel: params.get('sel') ?? undefined,
      set,
      clear,
    }),
    [params, set, clear],
  )
}
