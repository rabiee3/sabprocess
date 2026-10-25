import { describe, expect, it } from 'vitest';
import { toIndexEntry } from './indexEntry';
import type { Factory } from './types';

const base: Factory = {
  id: 'f1',
  name: { en: 'Delta Feed', ar: 'دلتا للأعلاف' },
  area: 'sadat',
  sector: 'food',
  location: { lat: 30.1, lng: 31.2, accuracyM: 10, pinMoved: false },
  productsMade: [{ name: { en: 'Poultry feed' }, hs: { heading: '2309', sub: '230990' } }],
  productsNeeded: [{ name: { en: 'Corn' } }],
  photoCount: 0,
  status: 'approved',
  createdBy: 'u1',
  createdAt: new Date(1),
  updatedAt: new Date(2),
  approvedAt: new Date(3000),
};

describe('toIndexEntry', () => {
  it('maps a full factory', () => {
    const f = base;
    expect(toIndexEntry(f)).toEqual({
      id: 'f1', n: f.name, lat: f.location.lat, lng: f.location.lng, a: f.area, s: f.sector,
      m: [{ n: f.productsMade[0].name, h: '230990' }],
      d: [{ n: f.productsNeeded[0].name }],
      at: f.approvedAt!.getTime(),
    });
  });
  it('omits s and at when absent', () => {
    const e = toIndexEntry({ ...base, sector: undefined, approvedAt: undefined });
    expect('s' in e).toBe(false);
    expect('at' in e).toBe(false);
  });
  it('omits h for a product without an HS code', () => {
    const e = toIndexEntry(base);
    expect('h' in e.d[0]).toBe(false);
    expect(e.m[0].h).toBe('230990');
  });
  it('drops undefined keys inside LocalizedName copies', () => {
    const e = toIndexEntry({
      ...base,
      name: { en: 'Delta Feed', ar: undefined },
      productsMade: [{ name: { en: undefined, ar: 'علف' } }],
    });
    expect(e.n).toEqual({ en: 'Delta Feed' });
    expect('ar' in e.n).toBe(false);
    expect('en' in e.m[0].n).toBe(false);
    expect(e.n).not.toBe(base.name);
  });

  it('flags sample factories with x: true and omits x otherwise', () => {
    expect(toIndexEntry({ ...base, sample: true }).x).toBe(true);
    expect('x' in toIndexEntry(base)).toBe(false);
    expect('x' in toIndexEntry({ ...base, sample: false })).toBe(false);
  });
});
