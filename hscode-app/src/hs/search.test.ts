import { describe, expect, it } from 'vitest';
import { searchHeadings } from './search';

describe('searchHeadings', () => {
  it('matches exact code first', () => {
    expect(searchHeadings('2309')[0].code).toBe('2309');
  });
  it('matches code prefix', () => {
    const hits = searchHeadings('23', 200);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.code.startsWith('23'))).toBe(true);
    expect(hits.every((h) => h.chapter === '23')).toBe(true);
  });
  it('accepts dotted codes', () => {
    expect(searchHeadings('23.09')[0].code).toBe('2309');
  });
  it('searches English', () => {
    expect(searchHeadings('animal feed').map((h) => h.code)).toContain('2309');
  });
  it('searches Arabic', () => {
    expect(searchHeadings('تغذية الحيوانات').map((h) => h.code)).toContain('2309');
  });
  it('normalizes Arabic taa marbuta', () => {
    expect(searchHeadings('التغذيه').length).toBeGreaterThan(0);
  });
  it('returns [] for empty or blank', () => {
    expect(searchHeadings('')).toEqual([]);
    expect(searchHeadings('   ')).toEqual([]);
  });
  it('respects limit', () => {
    expect(searchHeadings('cable', 5).length).toBeLessThanOrEqual(5);
  });
  it('ranks word-start matches before substring matches', () => {
    const hits = searchHeadings('cable', 200);
    const idx = (re: RegExp) => hits.findIndex((h) => re.test(h.en.toLowerCase()));
    const firstWord = idx(/\bcable/);
    const firstSub = hits.findIndex((h) => !/\bcable/.test(h.en.toLowerCase()) && h.en.toLowerCase().includes('cable'));
    if (firstSub !== -1) expect(firstWord).toBeLessThan(firstSub);
  });
});
