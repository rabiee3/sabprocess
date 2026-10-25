import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Factory } from '../lib/types'
import {
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
  type Draft,
} from './draft'

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
  it('contacts and photos have none', () => {
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
    saveDraft(draftFromFactory(fac('e'), {}, []))
    expect(latestNewDraft()).toBeNull()
  })
})

describe('persistence', () => {
  it('save/load/clear', () => {
    const d = { ...emptyDraft('abc'), location: loc }
    saveDraft(d)
    expect(loadDraft('abc')).toEqual(d)
    clearDraft('abc')
    expect(loadDraft('abc')).toBeNull()
  })
  it('latestNewDraft picks the most recent and ignores junk', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    saveDraft(emptyDraft('older'))
    vi.setSystemTime(2000)
    saveDraft(emptyDraft('newer'))
    localStorage.setItem('hscode.draft.junk', '{nope')
    localStorage.setItem('hscode.draft.bad', JSON.stringify({ savedAt: 9999 }))
    expect(latestNewDraft()?.fid).toBe('newer')
  })
  it('latestNewDraft null when none', () => {
    expect(latestNewDraft()).toBeNull()
  })
})
