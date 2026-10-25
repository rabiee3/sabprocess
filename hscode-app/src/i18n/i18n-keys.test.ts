import en from './en.json'
import ar from './ar.json'

function flatten(o: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') Object.assign(out, flatten(v as Record<string, unknown>, key))
    else out[key] = String(v)
  }
  return out
}

const REQUIRED: Record<string, string[]> = {
  'survey.gate': ['signInTitle', 'signInBody', 'continueGoogle', 'offTitle', 'offBody'],
  'survey.invite': ['title', 'body', 'unlock', 'invalid', 'offline', 'signedInAs'],
  'survey.list': ['title', 'add', 'empty', 'pending', 'approved', 'rejected', 'savedOnPhone', 'uploadFailed', 'adminReason', 'fixResubmit'],
  'survey.step': ['counter', 'back', 'next', 'location', 'basics', 'products', 'contacts', 'photos', 'review'],
  'survey.location': ['title', 'hint', 'gpsOff', 'weak', 'myLocation', 'accuracy'],
  'survey.basics': ['nameEn', 'nameAr', 'nameRequired', 'area', 'areaOther', 'sector', 'address'],
  'survey.products': ['made', 'needed', 'name', 'hsOptional', 'add', 'remove'],
  hs: ['title', 'for', 'heading', 'moreDetail', 'tariff', 'tariffHint', 'use', 'skip', 'searchPlaceholder', 'browseChapters', 'enoughHint', 'tariffInvalid'],
  'survey.contacts': ['intro', 'phone', 'whatsapp', 'sameAsPhone', 'website', 'facebook', 'person'],
  'survey.photos': ['intro', 'camera', 'gallery', 'failed', 'remove'],
  'survey.review': ['title', 'offlineBanner', 'pinNotMoved', 'weakGps', 'submit', 'saveOnPhone', 'edit'],
  errors: ['offline', 'accessOff', 'rejected', 'quota', 'generic'],
}

const E = flatten(en)
const A = flatten(ar)

describe('i18n catalogues', () => {
  it('en and ar have identical key sets', () => {
    expect(Object.keys(A).sort()).toEqual(Object.keys(E).sort())
  })
  it('no value is empty', () => {
    for (const [k, v] of [...Object.entries(E), ...Object.entries(A)]) {
      expect(v.trim(), k).not.toBe('')
    }
  })
  it('contains every required surveyor key', () => {
    for (const [ns, keys] of Object.entries(REQUIRED)) {
      for (const k of keys) {
        expect(E[`${ns}.${k}`], `en ${ns}.${k}`).toBeTruthy()
        expect(A[`${ns}.${k}`], `ar ${ns}.${k}`).toBeTruthy()
      }
    }
  })
  it('keeps interpolation placeholders aligned', () => {
    const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join()
    for (const [k, v] of Object.entries(E)) {
      expect(ph(A[k] ?? ''), k).toBe(ph(v))
    }
  })
})
