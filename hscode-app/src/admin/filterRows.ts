import { normalizeArabic } from '../lib/arabic'
import type { Factory } from '../lib/types'

export type Filters = { area: string; sector: string; text: string }
export const NO_FILTERS: Filters = { area: '', sector: '', text: '' }

/** Client-side filters over the loaded rows; text matches either name, Arabic-normalised. */
export function applyFilters(rows: Factory[], f: Filters): Factory[] {
  const q = normalizeArabic(f.text)
  return rows.filter(
    (r) =>
      (!f.area || r.area === f.area) &&
      (!f.sector || r.sector === f.sector) &&
      (!q || normalizeArabic(`${r.name.en ?? ''} ${r.name.ar ?? ''}`).includes(q)),
  )
}
