import { areas, sectors } from '../data'
import type { LocalizedName } from '../lib/types'

export type Lang = 'en' | 'ar'

/** The name in the current language, falling back to the other. */
export const pickName = (n: LocalizedName, lang: Lang): string =>
  (lang === 'ar' ? n.ar || n.en : n.en || n.ar) ?? ''

export const areaLabel = (id: string, lang: Lang): string => areas().find((a) => a.id === id)?.[lang] ?? ''
export const sectorLabel = (id: string | undefined, lang: Lang): string =>
  (id && sectors().find((s) => s.id === id)?.[lang]) || ''
