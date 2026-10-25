import { describe, expect, it } from 'vitest'
import type { Factory } from '../lib/types'
import { factoryFlags } from './flags'

const base = (loc: Partial<Factory['location']>): Factory => ({
  id: 'f',
  name: { en: 'X' },
  area: 'oct6-zone-1',
  location: { lat: 30, lng: 31, accuracyM: 10, pinMoved: true, ...loc },
  productsMade: [],
  productsNeeded: [],
  photoCount: 0,
  status: 'pending',
  createdBy: 'u',
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('factoryFlags', () => {
  it('flags accuracy above 50 m only', () => {
    expect(factoryFlags(base({ accuracyM: 85 }))).toEqual(['lowAccuracy'])
    expect(factoryFlags(base({ accuracyM: 51 }))).toEqual(['lowAccuracy'])
    expect(factoryFlags(base({ accuracyM: 50 }))).toEqual([])
  })
  it('flags a null accuracy as placed by hand', () => {
    expect(factoryFlags(base({ accuracyM: null }))).toEqual(['manual'])
  })
  it('flags a pin that never moved', () => {
    expect(factoryFlags(base({ pinMoved: false }))).toEqual(['pinNeverMoved'])
  })
  it('combines flags', () => {
    expect(factoryFlags(base({ accuracyM: 85, pinMoved: false }))).toEqual(['lowAccuracy', 'pinNeverMoved'])
    expect(factoryFlags(base({ accuracyM: null, pinMoved: false }))).toEqual(['manual', 'pinNeverMoved'])
  })
})
