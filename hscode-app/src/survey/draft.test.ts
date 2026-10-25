import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Factory } from '../lib/types'
import {
  LIMITS,
  MAX_PRODUCTS,
  STEPS,
  clearDraft,
  draftFromFactory,
  draftReducer,
  emptyDraft,
  latestNewDraft,
  loadDraft,
  normalizeDigits,
  productKey,
  saveDraft,
  stepErrors,
  toFactoryInput,
  tooLong,
  type Draft,
} from './draft'
import { outbox } from './outbox'

const loc = { lat: 29.97, lng: 30.94, accuracyM: 12, pinMoved: false }

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('reducer', () => {
  it('STEPS order', () => {
    expect(STEPS).toEqual(['location', 'basics', 'products', 'contacts', 'photos', 'review'])
  })
  it('handles each action', () => {
    let d = emptyDraft('f')
    d = draftReducer(d, { type: 'setLocation', location: loc })
    d = draftReducer(d, { type: 'setGpsStatus', status: 'ok' })
    d = draftReducer(d, { type: 'setName', lang: 'en', value: 'Acme' })
    d = draftReducer(d, { type: 'setField', field: 'area', value: 'x' })
    d = draftReducer(d, { type: 'addProduct', list: 'productsMade' })
    const key = d.productsMade[0].key
    d = draftReducer(d, { type: 'updateProduct', list: 'productsMade', key, patch: { name: { en: 'Pipe', ar: '' } } })
    d = draftReducer(d, { type: 'setContact', contact: { phone: '1' } })
    d = draftReducer(d, { type: 'setPhotos', photos: [{ id: 'p1', data: 'd' }], thumb: 't' })
    expect(d.location).toEqual(loc)
    expect(d.gpsStatus).toBe('ok')
    expect(d.name.en).toBe('Acme')
    expect(d.area).toBe('x')
    expect(d.productsMade[0].name.en).toBe('Pipe')
    expect(d.contact.phone).toBe('1')
    expect(d.photos).toHaveLength(1)
    expect(d.thumb).toBe('t')
    d = draftReducer(d, { type: 'removeProduct', list: 'productsMade', key })
    expect(d.productsMade).toHaveLength(0)
  })
  it('setPhotos thumb: undefined keeps, null clears, string replaces', () => {
    let d = draftReducer(emptyDraft('f1'), { type: 'setPhotos', photos: [{ id: 'p1', data: 'd' }], thumb: 't1' })
    d = draftReducer(d, { type: 'setPhotos', photos: [{ id: 'p1', data: 'd' }, { id: 'p2', data: 'e' }] })
    expect(d.thumb).toBe('t1')
    d = draftReducer(d, { type: 'setPhotos', photos: [{ id: 'p1', data: 'd' }], thumb: 't2' })
    expect(d.thumb).toBe('t2')
    d = draftReducer(d, { type: 'setPhotos', photos: [], thumb: null })
    expect(d.thumb).toBeUndefined()
    expect('thumb' in d).toBe(false)
  })
  it('mustMove applies to new drafts only', () => {
    const base = { ...emptyDraft('f1'), location: { lat: 30, lng: 31, accuracyM: null, pinMoved: false }, gpsStatus: 'denied' as const }
    expect(stepErrors(base, 'location')).toContain('survey.location.mustMove')
    expect(stepErrors({ ...base, mode: 'edit' }, 'location')).toEqual([])
  })
  it('product keys are unique', () => {
    expect(productKey()).not.toBe(productKey())
  })
})

describe('stepErrors', () => {
  it('location', () => {
    expect(stepErrors(emptyDraft('f'), 'location')).toContain('survey.location.required')
    const d1 = draftReducer(emptyDraft('f'), { type: 'setLocation', location: loc })
    expect(stepErrors({ ...d1, gpsStatus: 'ok' }, 'location')).toEqual([])
    expect(stepErrors({ ...d1, gpsStatus: 'denied' }, 'location')).toContain('survey.location.mustMove')
    expect(stepErrors({ ...d1, gpsStatus: 'denied', location: { ...loc, pinMoved: true } }, 'location')).toEqual([])
    expect(stepErrors({ ...d1, gpsStatus: 'ok', location: { ...loc, lat: 10 } }, 'location')).toContain('survey.location.required')
  })
  it('basics', () => {
    expect(stepErrors(emptyDraft('f'), 'basics')).toEqual(
      expect.arrayContaining(['survey.basics.nameRequired', 'survey.basics.areaRequired']),
    )
    const d = { ...emptyDraft('f'), name: { en: ' ', ar: 'س' }, area: 'other' }
    expect(stepErrors(d, 'basics')).toEqual(['survey.basics.areaOtherRequired'])
    expect(stepErrors({ ...d, areaOther: 'Z' }, 'basics')).toEqual([])
  })
  it('products', () => {
    const d = emptyDraft('f')
    const row = (name: string, hs?: Draft['productsMade'][0]['hs']) => ({ key: productKey(), name: { en: name, ar: '' }, hs })
    expect(stepErrors({ ...d, productsMade: [row(''), row(' ')] }, 'products')).toEqual(['survey.products.nameRequired'])
    expect(stepErrors({ ...d, productsNeeded: [row('a', { heading: '7208' })] }, 'products')).toEqual([])
    expect(stepErrors({ ...d, productsNeeded: [row('a', { heading: '12' })] }, 'products')).toEqual(['hs.tariffInvalid'])
  })
  it('length limits match the rules (trimmed values)', () => {
    const x = (n: number) => 'x'.repeat(n)
    const d = { ...emptyDraft('f'), name: { en: x(120), ar: x(120) }, area: 'other', areaOther: x(120), address: x(300) }
    expect(stepErrors(d, 'basics')).toEqual([])
    expect(stepErrors({ ...d, name: { en: x(121), ar: '' } }, 'basics')).toEqual([tooLong('name.en')])
    expect(stepErrors({ ...d, name: { en: '', ar: x(121) } }, 'basics')).toEqual([tooLong('name.ar')])
    expect(stepErrors({ ...d, areaOther: x(121) }, 'basics')).toEqual([tooLong('areaOther')])
    expect(stepErrors({ ...d, area: 'zone', areaOther: x(121) }, 'basics')).toEqual([tooLong('areaOther')])
    expect(stepErrors({ ...d, address: x(301) }, 'basics')).toEqual([tooLong('address')])
    expect(stepErrors({ ...d, address: ` ${x(300)} ` }, 'basics')).toEqual([])
  })
  it('contact limits', () => {
    const x = (n: number) => 'x'.repeat(n)
    const ok = { phone: x(40), whatsapp: x(40), website: x(300), facebook: x(300), contactPerson: x(120) }
    expect(stepErrors({ ...emptyDraft('f'), contact: ok }, 'contacts')).toEqual([])
    for (const [k, max] of [['phone', 40], ['whatsapp', 40], ['website', 300], ['facebook', 300], ['contactPerson', 120]] as const) {
      expect(stepErrors({ ...emptyDraft('f'), contact: { ...ok, [k]: x(max + 1) } }, 'contacts')).toEqual([tooLong(k)])
    }
    // whatsapp mirrors the phone: its own stale value is not sent, so not checked
    expect(stepErrors({ ...emptyDraft('f'), contact: { whatsapp: x(41), whatsappSameAsPhone: true } }, 'contacts')).toEqual([])
    expect(LIMITS.facebook).toBe(300)
  })
  it('product name and count limits', () => {
    const d = emptyDraft('f')
    const row = (en: string) => ({ key: productKey(), name: { en, ar: '' } })
    expect(stepErrors({ ...d, productsMade: [row('x'.repeat(120))] }, 'products')).toEqual([])
    expect(stepErrors({ ...d, productsNeeded: [row('x'.repeat(121))] }, 'products')).toEqual([tooLong('productName')])
    expect(stepErrors({ ...d, productsMade: Array.from({ length: 30 }, () => row('a')) }, 'products')).toEqual([])
    expect(stepErrors({ ...d, productsMade: Array.from({ length: 31 }, () => row('a')) }, 'products')).toEqual(['survey.products.max'])
    expect(MAX_PRODUCTS).toBe(30)
  })
  it('photos have no errors; contacts none when empty', () => {
    expect(stepErrors(emptyDraft('f'), 'contacts')).toEqual([])
    expect(stepErrors(emptyDraft('f'), 'photos')).toEqual([])
  })
})

describe('normalizeDigits', () => {
  it('converts both digit sets', () => {
    expect(normalizeDigits('٠١٠ ١٢٣٤ ٥٦٧٨')).toBe('010 1234 5678')
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789')
  })
})

describe('toFactoryInput', () => {
  const base = (): Draft => ({ ...emptyDraft('f'), location: loc, name: { en: ' Acme ', ar: '  ' }, area: 'x' })
  it('normalizes phone and trims', () => {
    const d = { ...base(), contact: { phone: ' ٠١٠٠ ', website: '  ', contactPerson: ' Ali ' } }
    const out = toFactoryInput(d)
    expect(out.contact.phone).toBe('0100')
    expect(out.contact).not.toHaveProperty('website')
    expect(out.contact.contactPerson).toBe('Ali')
    expect(out.name).toEqual({ en: 'Acme' })
  })
  it('drops blank product rows, keeps hs only when set', () => {
    const d = {
      ...base(),
      productsMade: [
        { key: 'a', name: { en: '', ar: ' ' } },
        { key: 'b', name: { en: 'Pipe', ar: '' } },
        { key: 'c', name: { en: '', ar: 'ماسورة' }, hs: { heading: '7306' } },
      ],
    }
    const out = toFactoryInput(d)
    expect(out.productsMade).toEqual([{ name: { en: 'Pipe' } }, { name: { ar: 'ماسورة' }, hs: { heading: '7306' } }])
    expect(out.productsMade[0]).not.toHaveProperty('hs')
    expect(toFactoryInput({ ...base(), productsMade: [{ key: 'a', name: { en: '', ar: '' } }] }).productsMade).toHaveLength(0)
  })
  it('whatsappSameAsPhone', () => {
    const out = toFactoryInput({ ...base(), contact: { phone: '010', whatsappSameAsPhone: true } })
    expect(out.contact.whatsapp).toBe('010')
    expect(out.contact.whatsappSameAsPhone).toBe(true)
  })
  it('omits blank optionals', () => {
    const out = toFactoryInput(base())
    for (const k of ['areaOther', 'address', 'sector', 'thumb']) expect(out).not.toHaveProperty(k)
  })
})

describe('draftFromFactory', () => {
  const fac = (id: string) =>
    ({ id, name: { en: 'A' }, area: 'a', location: loc, productsMade: [{ name: { ar: 'م' } }], productsNeeded: [], thumb: 't' }) as unknown as Factory
  it('maps a factory', () => {
    const d = draftFromFactory(fac('x1'), { phone: '1' }, [{ id: 'p2', data: 'x' }])
    expect(d.mode).toBe('edit')
    expect(d.fid).toBe('x1')
    expect(d.name).toEqual({ en: 'A', ar: '' })
    expect(d.gpsStatus).toBe('ok')
    expect(d.previousPhotoIds).toEqual(['p2'])
    expect(d.productsMade[0].name).toEqual({ en: '', ar: 'م' })
    expect(d.productsMade[0].key).toBeTruthy()
    expect(d.thumb).toBe('t')
  })
  it('edit drafts are not resumed as new', () => {
    saveDraft('u1', draftFromFactory(fac('e'), {}, []))
    expect(latestNewDraft('u1')).toBeNull()
  })
})

describe('persistence', () => {
  it('save/load/clear', () => {
    const d = { ...emptyDraft('abc'), location: loc }
    expect(saveDraft('u1', d)).toBe(true)
    expect(loadDraft('u1', 'abc')).toEqual(d)
    expect(localStorage.getItem('hscode.draft.u1.abc')).not.toBeNull()
    clearDraft('u1', 'abc')
    expect(loadDraft('u1', 'abc')).toBeNull()
  })
  it('saveDraft reports a full storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(saveDraft('u1', emptyDraft('abc'))).toBe(false)
    vi.restoreAllMocks()
  })
  it('latestNewDraft picks the most recent and ignores junk', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    saveDraft('u1', emptyDraft('older'))
    vi.setSystemTime(2000)
    saveDraft('u1', emptyDraft('newer'))
    localStorage.setItem('hscode.draft.u1.junk', '{nope')
    localStorage.setItem('hscode.draft.u1.bad', JSON.stringify({ savedAt: 9999 }))
    expect(latestNewDraft('u1')?.fid).toBe('newer')
  })
  it('latestNewDraft null when none', () => {
    expect(latestNewDraft('u1')).toBeNull()
  })
  it('drafts are scoped per user: B never sees A drafts', () => {
    saveDraft('userA', { ...emptyDraft('fa'), name: { en: 'A secret', ar: '' } })
    expect(latestNewDraft('userB')).toBeNull()
    expect(loadDraft('userB', 'fa')).toBeNull()
    clearDraft('userB', 'fa')
    expect(loadDraft('userA', 'fa')?.name.en).toBe('A secret')
  })
  it('old unscoped drafts are ignored and removed', () => {
    localStorage.setItem('hscode.draft.legacy1', JSON.stringify({ savedAt: 1, draft: emptyDraft('legacy1') }))
    expect(latestNewDraft('u1')).toBeNull()
    expect(localStorage.getItem('hscode.draft.legacy1')).toBeNull()
  })
  it('latestNewDraft skips a draft waiting in the outbox as saved, but resumes a failed one', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    saveDraft('u1', emptyDraft('older'))
    vi.setSystemTime(2000)
    saveDraft('u1', emptyDraft('queued'))
    outbox.add('u1', 'queued')
    expect(latestNewDraft('u1')?.fid).toBe('older')
    outbox.markFailed('u1', 'queued', 'generic')
    expect(latestNewDraft('u1')?.fid).toBe('queued')
  })
})
