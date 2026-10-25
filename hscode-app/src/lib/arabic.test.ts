import { describe, expect, it } from 'vitest';
import { normalizeArabic } from './arabic';

describe('normalizeArabic', () => {
  it('works', () => {
    expect(normalizeArabic('العَلَف')).toBe(normalizeArabic('العلف'));
    expect(normalizeArabic('أعلاف إسكندرية آمنة')).toBe('اعلاف اسكندريه امنه');
    expect(normalizeArabic('مكـــرونة')).toBe('مكرونه');
    expect(normalizeArabic('على')).toBe('علي');
    expect(normalizeArabic('Poultry FEED')).toBe('poultry feed');
    expect(normalizeArabic('')).toBe('');
  });
});
