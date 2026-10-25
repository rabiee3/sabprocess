import { validateHs } from './hs'
import type { HsCode } from './types'

/** Max lengths, matching firestore.rules (product names aren't capped there; 120 keeps them in line with names). */
export const LIMITS = {
  'name.en': 120,
  'name.ar': 120,
  areaOther: 120,
  address: 300,
  phone: 40,
  whatsapp: 40,
  website: 300,
  facebook: 300,
  contactPerson: 120,
  productName: 120,
} as const
export type LimitField = keyof typeof LIMITS
/** Max products per list (rules: list size <= 30). */
export const MAX_PRODUCTS = 30

/** The error entry for a too-long field (not an i18n key: render it with errors.tooLong + LIMITS[field]). */
export const tooLong = (field: LimitField): string => `tooLong:${field}`

const blank = (s: string | undefined): boolean => !s || s.trim() === ''
const over = (field: LimitField, s: string | undefined): boolean => (s?.trim().length ?? 0) > LIMITS[field]

export type FieldsToValidate = {
  name: { en?: string; ar?: string }
  area: string
  areaOther?: string
  address?: string
  productsMade: { name: { en?: string; ar?: string }; hs?: HsCode }[]
  productsNeeded: { name: { en?: string; ar?: string }; hs?: HsCode }[]
  contact: {
    phone?: string
    whatsapp?: string
    whatsappSameAsPhone?: boolean
    website?: string
    facebook?: string
    contactPerson?: string
  }
}

export type Section = 'basics' | 'products' | 'contacts'

export function basicsErrors(d: Pick<FieldsToValidate, 'name' | 'area' | 'areaOther' | 'address'>): string[] {
  const out: string[] = []
  if (blank(d.name.en) && blank(d.name.ar)) out.push('survey.basics.nameRequired')
  if (over('name.en', d.name.en)) out.push(tooLong('name.en'))
  if (over('name.ar', d.name.ar)) out.push(tooLong('name.ar'))
  if (blank(d.area)) out.push('survey.basics.areaRequired')
  else if (d.area === 'other' && blank(d.areaOther)) out.push('survey.basics.areaOtherRequired')
  if (over('areaOther', d.areaOther)) out.push(tooLong('areaOther'))
  if (over('address', d.address)) out.push(tooLong('address'))
  return out
}

export function productsErrors(d: Pick<FieldsToValidate, 'productsMade' | 'productsNeeded'>): string[] {
  const out: string[] = []
  if (d.productsMade.length > MAX_PRODUCTS || d.productsNeeded.length > MAX_PRODUCTS) out.push('survey.products.max')
  for (const p of [...d.productsMade, ...d.productsNeeded]) {
    if (blank(p.name.en) && blank(p.name.ar)) out.push('survey.products.nameRequired')
    if (over('productName', p.name.en) || over('productName', p.name.ar)) out.push(tooLong('productName'))
    if (p.hs && !validateHs(p.hs).ok) out.push('hs.tariffInvalid')
  }
  return out
}

export function contactErrors(c: FieldsToValidate['contact']): string[] {
  const out: string[] = []
  if (over('phone', c.phone)) out.push(tooLong('phone'))
  if (!c.whatsappSameAsPhone && over('whatsapp', c.whatsapp)) out.push(tooLong('whatsapp'))
  if (over('website', c.website)) out.push(tooLong('website'))
  if (over('facebook', c.facebook)) out.push(tooLong('facebook'))
  if (over('contactPerson', c.contactPerson)) out.push(tooLong('contactPerson'))
  return out
}

export const dedupe = (errors: string[]): string[] => [...new Set(errors)]

/** All the names/area/products/contacts checks together (i18n keys or tooLong(field) entries). */
export function validateFactoryFields(d: FieldsToValidate): string[] {
  return dedupe([...basicsErrors(d), ...productsErrors(d), ...contactErrors(d.contact)])
}
