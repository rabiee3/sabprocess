import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../lib/types';
import { createEngine } from './engine';
import { fixtures } from './fixtures';
import { searchHeadings } from '../hs/search';
import { suggest as suggestWith } from './suggest';

const suggest = (...a: Parameters<typeof suggestWith>) => suggestWith(a[0], a[1], a[2], searchHeadings);

describe('suggest', () => {
  it('suggests products and only indexed HS headings', () => {
    const e = createEngine(fixtures, 'en');
    expect(suggest(e, 'feed', 'en').products.map((p) => p.label)).toContain('Poultry feed');
    expect(suggest(e, '2309', 'en').hs.map((h) => h.code)).toEqual(['2309']);
    expect(suggest(e, '230990', 'en').hs.map((h) => h.code)).toEqual(['2309']);
    expect(suggest(e, '0101', 'en').hs).toEqual([]);
    const indexed = new Set(['2309', '1005', '1108', '3923', '7214', '7217']);
    const s = suggest(e, 'animal', 'en');
    expect(s.hs.length).toBeGreaterThan(0);
    expect(s.hs.every((h) => indexed.has(h.code))).toBe(true);
  });

  it('finds Arabic products by singular or plural', () => {
    const e = createEngine(fixtures, 'ar');
    expect(suggest(e, 'علف', 'ar').products.map((p) => p.label)).toContain('أعلاف دواجن');
  });

  it('matches sectors and areas', () => {
    const s = suggest(createEngine(fixtures, 'en'), 'animal', 'en');
    expect(s.sectors[0]).toEqual({ id: 'animal-feed', label: 'Animal feed' });
    expect(suggest(createEngine(fixtures, 'ar'), 'الأعلاف', 'ar').sectors[0].id).toBe('animal-feed');
  });

  it('caps each group at 5', () => {
    const many: IndexEntry[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`, n: { en: `P${i}` }, lat: 30, lng: 31, a: 'oct6-zone-1',
      m: [{ n: { en: `Widget ${i}` }, h: `23090${i % 10}` }], d: [], at: i,
    }));
    const s = suggest(createEngine(many, 'en'), 'widget', 'en');
    expect(s.products).toHaveLength(5);
    const codes = Array.from({ length: 9 }, (_, i) => `230${i + 1}`);
    const hsMany = createEngine(
      codes.map((c) => ({ id: c, n: { en: c }, lat: 30, lng: 31, a: 'oct6-zone-1', m: [{ n: { en: 'x' }, h: c }], d: [] })),
      'en',
    );
    expect(suggest(hsMany, '23', 'en').hs).toHaveLength(5);
    expect(suggest(hsMany, 'a', 'en').sectors).toHaveLength(5);
    expect(suggest(hsMany, 'a', 'en').areas).toHaveLength(5);
  });

  it('has no HS group until the HS table is passed in (it loads lazily)', () => {
    const e = createEngine(fixtures, 'en');
    expect(suggestWith(e, '2309', 'en').hs).toEqual([]);
    expect(suggestWith(e, 'feed', 'en').products.map((p) => p.label)).toContain('Poultry feed');
  });

  it('returns empty groups for an empty query', () => {
    expect(suggest(createEngine(fixtures, 'en'), '  ', 'en')).toEqual({ products: [], hs: [], sectors: [], areas: [] });
  });
});
