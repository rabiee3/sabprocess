import { insideEgypt } from '../lib/geo'
import { validateHs } from '../lib/hs'
import { safeStorage } from '../lib/safeStorage'
import { outbox } from './outbox'
import type { Factory, FactoryLocation, HsCode, Product } from '../lib/types'
import type { ContactDraft, FactoryInput, PhotoData } from './types'

export type StepId = 'location' | 'basics' | 'products' | 'contacts' | 'photos' | 'review'
export const STEPS: StepId[] = ['location', 'basics', 'products', 'contacts', 'photos', 'review']

export type GpsStatus = 'pending' | 'ok' | 'denied' | 'unavailable' | 'timeout'
export type Name = { en: string; ar: string }
export type ProductDraft = { key: string; name: Name; hs?: HsCode }
export type ProductList = 'productsMade' | 'productsNeeded'

export type Draft = {
  fid: string
  mode: 'new' | 'edit'
  location?: FactoryLocation
  gpsStatus: GpsStatus
  name: Name
  area: string
  areaOther: string
  sector: string
  address: string
  productsMade: ProductDraft[]
  productsNeeded: ProductDraft[]
  contact: ContactDraft
  photos: PhotoData[]
  thumb?: string
  previousPhotoIds: string[]
}

let keyCounter = 0
export function productKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // fall through to the simple fallback
  }
  keyCounter += 1
  return `k${Date.now().toString(36)}${keyCounter}${Math.random().toString(36).slice(2, 8)}`
}

export function emptyDraft(fid: string): Draft {
  return {
    fid,
    mode: 'new',
    gpsStatus: 'pending',
    name: { en: '', ar: '' },
    area: '',
    areaOther: '',
    sector: '',
    address: '',
    productsMade: [],
    productsNeeded: [],
    contact: {},
    photos: [],
    previousPhotoIds: [],
  }
}

const toProductDraft = (p: Product): ProductDraft => ({
  key: productKey(),
  name: { en: p.name.en ?? '', ar: p.name.ar ?? '' },
  ...(p.hs ? { hs: p.hs } : {}),
})

export function draftFromFactory(f: Factory, contact: ContactDraft, photos: PhotoData[]): Draft {
  return {
    fid: f.id,
    mode: 'edit',
    location: f.location,
    gpsStatus: 'ok',
    name: { en: f.name.en ?? '', ar: f.name.ar ?? '' },
    area: f.area,
    areaOther: f.areaOther ?? '',
    sector: f.sector ?? '',
    address: f.address ?? '',
    productsMade: f.productsMade.map(toProductDraft),
    productsNeeded: f.productsNeeded.map(toProductDraft),
    contact,
    photos,
    ...(f.thumb ? { thumb: f.thumb } : {}),
    previousPhotoIds: photos.map((p) => p.id),
  }
}

export type DraftAction =
  | { type: 'setLocation'; location: FactoryLocation }
  | { type: 'setGpsStatus'; status: GpsStatus }
  | { type: 'setName'; lang: 'en' | 'ar'; value: string }
  | { type: 'setField'; field: 'area' | 'areaOther' | 'sector' | 'address'; value: string }
  | { type: 'addProduct'; list: ProductList }
  | { type: 'updateProduct'; list: ProductList; key: string; patch: Partial<Omit<ProductDraft, 'key'>> }
  | { type: 'removeProduct'; list: ProductList; key: string }
  | { type: 'setContact'; contact: ContactDraft }
  | { type: 'setPhotos'; photos: PhotoData[]; thumb?: string | null }

export function draftReducer(d: Draft, a: DraftAction): Draft {
  switch (a.type) {
    case 'setLocation':
      return { ...d, location: a.location }
    case 'setGpsStatus':
      return { ...d, gpsStatus: a.status }
    case 'setName':
      return { ...d, name: { ...d.name, [a.lang]: a.value } }
    case 'setField':
      return { ...d, [a.field]: a.value }
    case 'addProduct':
      return { ...d, [a.list]: [...d[a.list], { key: productKey(), name: { en: '', ar: '' } }] }
    case 'updateProduct':
      return { ...d, [a.list]: d[a.list].map((p) => (p.key === a.key ? { ...p, ...a.patch } : p)) }
    case 'removeProduct':
      return { ...d, [a.list]: d[a.list].filter((p) => p.key !== a.key) }
    case 'setContact':
      return { ...d, contact: a.contact }
    case 'setPhotos': {
      // thumb: undefined = unchanged, null = clear, string = new
      if (a.thumb === undefined) return { ...d, photos: a.photos }
      const { thumb: _old, ...rest } = d
      void _old
      return { ...rest, photos: a.photos, ...(a.thumb ? { thumb: a.thumb } : {}) }
    }
  }
}

const blank = (s: string | undefined): boolean => !s || s.trim() === ''

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

/** The stepErrors entry for a too-long field (not an i18n key: render it with errors.tooLong + LIMITS[field]). */
export const tooLong = (field: LimitField): string => `tooLong:${field}`
const over = (field: LimitField, s: string | undefined): boolean => (s?.trim().length ?? 0) > LIMITS[field]

export function stepErrors(d: Draft, step: StepId): string[] {
  const out: string[] = []
  const check = (field: LimitField, s: string | undefined) => {
    if (over(field, s)) out.push(tooLong(field))
  }
  switch (step) {
    case 'location':
      if (!d.location || !insideEgypt(d.location.lat, d.location.lng)) out.push('survey.location.required')
      else if (d.mode === 'new' && d.gpsStatus !== 'ok' && !d.location.pinMoved) out.push('survey.location.mustMove')
      break
    case 'basics':
      if (blank(d.name.en) && blank(d.name.ar)) out.push('survey.basics.nameRequired')
      check('name.en', d.name.en)
      check('name.ar', d.name.ar)
      if (blank(d.area)) out.push('survey.basics.areaRequired')
      else if (d.area === 'other' && blank(d.areaOther)) out.push('survey.basics.areaOtherRequired')
      check('areaOther', d.areaOther) // sent whenever non-blank (toFactoryInput)
      check('address', d.address)
      break
    case 'products':
      if (d.productsMade.length > MAX_PRODUCTS || d.productsNeeded.length > MAX_PRODUCTS) out.push('survey.products.max')
      for (const p of [...d.productsMade, ...d.productsNeeded]) {
        if (blank(p.name.en) && blank(p.name.ar)) out.push('survey.products.nameRequired')
        if (over('productName', p.name.en) || over('productName', p.name.ar)) out.push(tooLong('productName'))
        if (p.hs && !validateHs(p.hs).ok) out.push('hs.tariffInvalid')
      }
      break
    case 'contacts': {
      const c = d.contact
      check('phone', c.phone)
      if (!c.whatsappSameAsPhone) check('whatsapp', c.whatsapp)
      check('website', c.website)
      check('facebook', c.facebook)
      check('contactPerson', c.contactPerson)
      break
    }
    default:
      break
  }
  return [...new Set(out)]
}

const DIGITS: Record<string, string> = {}
for (let i = 0; i < 10; i += 1) {
  DIGITS[String.fromCharCode(0x0660 + i)] = String(i)
  DIGITS[String.fromCharCode(0x06f0 + i)] = String(i)
}
export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (c) => DIGITS[c] ?? c)
}

function toProducts(list: ProductDraft[]): Product[] {
  const out: Product[] = []
  for (const p of list) {
    const en = p.name.en.trim()
    const ar = p.name.ar.trim()
    if (!en && !ar) continue
    out.push({ name: { ...(en ? { en } : {}), ...(ar ? { ar } : {}) }, ...(p.hs ? { hs: p.hs } : {}) })
  }
  return out
}

function toContact(c: ContactDraft): ContactDraft {
  const out: ContactDraft = {}
  const t = (s: string | undefined) => s?.trim() ?? ''
  const phone = normalizeDigits(t(c.phone))
  let whatsapp = normalizeDigits(t(c.whatsapp))
  if (c.whatsappSameAsPhone) whatsapp = phone
  if (phone) out.phone = phone
  if (whatsapp) out.whatsapp = whatsapp
  if (c.whatsappSameAsPhone) out.whatsappSameAsPhone = true
  for (const k of ['website', 'facebook', 'contactPerson'] as const) {
    const v = t(c[k])
    if (v) out[k] = v
  }
  return out
}

export function toFactoryInput(d: Draft): FactoryInput {
  if (!d.location) throw new Error('location required')
  const en = d.name.en.trim()
  const ar = d.name.ar.trim()
  const areaOther = d.areaOther.trim()
  const address = d.address.trim()
  const sector = d.sector.trim()
  return {
    name: { ...(en ? { en } : {}), ...(ar ? { ar } : {}) },
    area: d.area.trim(),
    ...(areaOther ? { areaOther } : {}),
    ...(address ? { address } : {}),
    ...(sector ? { sector } : {}),
    location: d.location,
    productsMade: toProducts(d.productsMade),
    productsNeeded: toProducts(d.productsNeeded),
    contact: toContact(d.contact),
    photos: d.photos,
    ...(d.thumb ? { thumb: d.thumb } : {}),
  }
}

const PREFIX = 'hscode.draft.'
const keyOf = (uid: string, fid: string) => `${PREFIX}${uid}.${fid}`
type Stored = { savedAt: number; draft: Draft }

function parse(raw: string | null): Stored | null {
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object') return null
    const s = v as Partial<Stored>
    const d = s.draft
    if (typeof s.savedAt !== 'number' || !d || typeof d !== 'object') return null
    if (typeof d.fid !== 'string' || (d.mode !== 'new' && d.mode !== 'edit')) return null
    if (!Array.isArray(d.productsMade) || !Array.isArray(d.productsNeeded) || !Array.isArray(d.photos)) return null
    return { savedAt: s.savedAt, draft: d }
  } catch {
    return null
  }
}

/** Drafts saved before per-user scoping (`hscode.draft.<fid>`, no dot after the prefix) belong to nobody: drop them. */
function dropLegacy(keys: string[]): void {
  for (const k of keys) if (k.startsWith(PREFIX) && !k.slice(PREFIX.length).includes('.')) safeStorage.remove(k)
}

/** False when storage did not accept the draft (blocked or full). */
export function saveDraft(uid: string, d: Draft): boolean {
  const stored: Stored = { savedAt: Date.now(), draft: d }
  return safeStorage.set(keyOf(uid, d.fid), JSON.stringify(stored))
}

export function loadDraft(uid: string, fid: string): Draft | null {
  return parse(safeStorage.get(keyOf(uid, fid)))?.draft ?? null
}

export function clearDraft(uid: string, fid: string): void {
  safeStorage.remove(keyOf(uid, fid))
}

/** The newest 'new' draft of this user, skipping ones already submitted and waiting in the outbox ('saved'). */
export function latestNewDraft(uid: string): Draft | null {
  const keys = safeStorage.keys()
  dropLegacy(keys)
  const queued = new Set(outbox.list(uid).filter((e) => e.state === 'saved').map((e) => e.fid))
  const mine = `${PREFIX}${uid}.`
  let best: Stored | null = null
  for (const k of keys) {
    if (!k.startsWith(mine)) continue
    const s = parse(safeStorage.get(k))
    if (!s || s.draft.mode !== 'new' || queued.has(s.draft.fid)) continue
    if (!best || s.savedAt > best.savedAt) best = s
  }
  return best?.draft ?? null
}
