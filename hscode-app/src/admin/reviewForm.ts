import { insideEgypt } from '../lib/geo'
import { validateFactoryFields } from '../lib/factoryValidation'
import type { LocalizedName } from '../lib/types'
import { toProducts, type Draft } from '../survey/draft'
import type { AdminEdit } from './repo'

/** Validation of the admin form (names, area, products, location). Contact is read-only here. */
export function formErrors(d: Draft): string[] {
  const errs = validateFactoryFields({ ...d, contact: {} })
  if (!d.location || !insideEgypt(d.location.lat, d.location.lng)) errs.push('survey.location.required')
  return errs
}

/** The edit sent with Approve. Empty optional fields are sent as '' so the repo deletes them. */
export function toAdminEdit(d: Draft): AdminEdit {
  if (!d.location) throw new Error('location required')
  const en = d.name.en.trim()
  const ar = d.name.ar.trim()
  const area = d.area.trim()
  return {
    name: { ...(en ? { en } : {}), ...(ar ? { ar } : {}) },
    area,
    areaOther: area === 'other' ? d.areaOther.trim() : '',
    sector: d.sector.trim(),
    address: d.address.trim(),
    location: d.location,
    productsMade: toProducts(d.productsMade),
    productsNeeded: toProducts(d.productsNeeded),
  }
}

/** The name in the UI language, falling back to the other one. */
export function displayName(name: LocalizedName, lang: string, fallback = ''): string {
  const [first, second] = lang.startsWith('ar') ? [name.ar, name.en] : [name.en, name.ar]
  return first?.trim() || second?.trim() || fallback
}

export function formatDate(d: Date, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}
