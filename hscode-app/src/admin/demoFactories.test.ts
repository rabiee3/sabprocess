import { describe, expect, it } from 'vitest'
import { areas, headings, sectors } from '../data'
import { validateFactoryFields } from '../lib/factoryValidation'
import { insideEgypt } from '../lib/geo'
import { validateHs } from '../lib/hs'
import { DEMO_FACTORIES } from './demoFactories'

const REAL = ['Edita Food Industries', 'Juhayna Food Industries']
const real = DEMO_FACTORIES.filter((f) => REAL.includes(f.name.en ?? ''))
const fictional = DEMO_FACTORIES.filter((f) => !REAL.includes(f.name.en ?? ''))
const subs = import.meta.glob<{ code: string }[]>('../data/hs-sub/*.json', { eager: true, import: 'default' })

describe('DEMO_FACTORIES', () => {
  it('has the two real factories and 6-8 fictional ones, with unique English names', () => {
    expect(real).toHaveLength(2)
    expect(fictional.length).toBeGreaterThanOrEqual(6)
    expect(fictional.length).toBeLessThanOrEqual(8)
    const names = DEMO_FACTORIES.map((f) => f.name.en)
    expect(new Set(names).size).toBe(names.length)
  })
  it('passes the form validation with names in both languages', () => {
    for (const f of DEMO_FACTORIES) {
      expect(validateFactoryFields({ ...f })).toEqual([])
      expect(f.name.en && f.name.ar).toBeTruthy()
      for (const p of [...f.productsMade, ...f.productsNeeded]) expect(p.name.en && p.name.ar).toBeTruthy()
      expect(f.productsMade.length).toBeGreaterThan(0)
      expect(f.photos).toEqual([])
    }
  })
  it('has known areas and sectors, and pins inside Egypt', () => {
    for (const f of DEMO_FACTORIES) {
      expect(areas().some((a) => a.id === f.area)).toBe(true)
      expect(sectors().some((s) => s.id === f.sector)).toBe(true)
      expect(insideEgypt(f.location.lat, f.location.lng)).toBe(true)
    }
  })
  it('every HS code is valid and exists in the data', () => {
    const heads = new Set(headings().map((h) => h.code))
    const allSubs = new Set(Object.values(subs).flatMap((l) => l.map((s) => s.code)))
    for (const f of DEMO_FACTORIES) {
      for (const p of [...f.productsMade, ...f.productsNeeded]) {
        expect(p.hs).toBeTruthy()
        expect(validateHs(p.hs!)).toEqual({ ok: true })
        expect(heads.has(p.hs!.heading)).toBe(true)
        if (p.hs!.sub) expect(allSubs.has(p.hs!.sub)).toBe(true)
      }
    }
  })
  it('carries no phone or whatsapp; the real two only a website', () => {
    for (const f of DEMO_FACTORIES) {
      expect(f.contact.phone).toBeUndefined()
      expect(f.contact.whatsapp).toBeUndefined()
      expect(f.contact.whatsappSameAsPhone).toBeUndefined()
    }
    for (const f of fictional) expect(f.contact).toEqual({})
    for (const f of real) expect(Object.keys(f.contact)).toEqual(['website'])
  })
  it('fictional entries are obviously demo in both languages and manually pinned', () => {
    for (const f of fictional) {
      expect(f.name.en).toMatch(/Demo|sample/i)
      expect(f.name.ar).toMatch(/تجريبي|عينة/)
      expect(f.location.accuracyM).toBeNull()
      expect(f.location.pinMoved).toBe(true)
    }
  })
  it('covers every oct6 zone and the required sectors', () => {
    const zones = new Set(DEMO_FACTORIES.map((f) => f.area))
    for (const z of ['oct6-zone-1', 'oct6-zone-2', 'oct6-zone-3', 'oct6-zone-4', 'oct6-zone-5', 'oct6-zone-6', 'oct6-extension']) {
      expect(zones.has(z)).toBe(true)
    }
    const sec = new Set(fictional.map((f) => f.sector))
    for (const s of ['animal-feed', 'food', 'plastics-packaging', 'electrical-cables', 'building-materials', 'metals', 'paper-printing']) {
      expect(sec.has(s)).toBe(true)
    }
  })
  it('has 2-4 made and 1-3 needed products per fictional factory, with distinct pins', () => {
    for (const f of fictional) {
      expect(f.productsMade.length).toBeGreaterThanOrEqual(2)
      expect(f.productsMade.length).toBeLessThanOrEqual(4)
      expect(f.productsNeeded.length).toBeGreaterThanOrEqual(1)
      expect(f.productsNeeded.length).toBeLessThanOrEqual(3)
    }
    const pins = DEMO_FACTORIES.map((f) => `${f.location.lat.toFixed(5)},${f.location.lng.toFixed(5)}`)
    expect(new Set(pins).size).toBe(pins.length)
  })
  it('links buyers to suppliers: each fictional factory needs something another demo factory makes', () => {
    const made = (h: string) => DEMO_FACTORIES.filter((f) => f.productsMade.some((p) => p.hs?.heading === h))
    for (const f of fictional) {
      const linked = f.productsNeeded.filter((p) => made(p.hs!.heading).some((m) => m !== f))
      expect(linked.length).toBeGreaterThan(0)
    }
    for (const h of ['1005', '2304', '3923', '7408']) expect(made(h).length).toBeGreaterThan(0)
  })
})
