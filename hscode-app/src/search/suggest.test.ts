import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../lib/types';
import { createEngine } from './engine';
import { fixtures } from './fixtures';
import { suggest } from './suggest';

describe('suggest', () => {
  it('suggests products and only indexed HS headings', () => {
    const s = suggest(createEngine(fixtures, 'en'), 'feed', 'en');
    expect(s.products.map((p) => p.label)).toContain('Poultry feed');
    expect(s.hs.every((h) => ['2309'].includes(h.code) || h.code.length === 4)).toBe(true);
    const s2 = suggest(createEngine(fixtures, 'en'), '2309', 'en');
    expect(s2.hs.map((h) => h.code)).toEqual(['2309']);
    expect(suggest(createEngine(fixtures, 'en'), '0101', 'en').hs).toEqual([]);
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
    const h = suggest(createEngine(many, 'en'), '23', 'en');
    expect(h.hs.length).toBeLessThanOrEqual(5);
  });

  it('returns empty groups for an empty query', () => {
    expect(suggest(createEngine(fixtures, 'en'), '  ', 'en')).toEqual({ products: [], hs: [], sectors: [], areas: [] });
  });
});
