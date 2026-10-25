import { describe, expect, it } from 'vitest';
import { formatHs, hsMatchesPrefix, hsString, normalizeHs, validateHs } from './hs';

describe('hs', () => {
  it('normalizeHs strips non-digits', () => {
    expect(normalizeHs(' 2309.90 ')).toBe('230990');
    expect(normalizeHs('')).toBe('');
  });
  it('validateHs', () => {
    expect(validateHs({ heading: '2309' })).toEqual({ ok: true });
    expect(validateHs({ heading: '2309', sub: '230990' })).toEqual({ ok: true });
    expect(validateHs({ heading: '2309', sub: '230990', tariff: '2309900010' })).toEqual({ ok: true });
    expect(validateHs({ heading: '230' })).toEqual({ ok: false, error: 'heading' });
    expect(validateHs({ heading: '2309', sub: '230490' })).toEqual({ ok: false, error: 'sub' });
    expect(validateHs({ heading: '2309', sub: '2309' })).toEqual({ ok: false, error: 'sub' });
    expect(validateHs({ heading: '2309', tariff: '2309900010' })).toEqual({ ok: false, error: 'tariff' });
    expect(validateHs({ heading: '2309', sub: '230990', tariff: '2309100010' })).toEqual({ ok: false, error: 'tariff' });
  });
  it('hsString returns deepest level', () => {
    expect(hsString({ heading: '2309', sub: '230990' })).toBe('230990');
    expect(hsString({ heading: '2309' })).toBe('2309');
    expect(hsString(undefined)).toBeUndefined();
  });
  it('hsMatchesPrefix', () => {
    expect(hsMatchesPrefix('2309900010', '23')).toBe(true);
    expect(hsMatchesPrefix('230990', '2309.9')).toBe(true);
    expect(hsMatchesPrefix('8544', '2309')).toBe(false);
    expect(hsMatchesPrefix('2309', '')).toBe(false);
  });
  it('formatHs', () => {
    expect(formatHs('2309900010')).toBe('2309.90.00.10');
    expect(formatHs('230990')).toBe('2309.90');
    expect(formatHs('23099000')).toBe('2309.90.00');
    expect(formatHs('2309')).toBe('2309');
    expect(formatHs('23')).toBe('23');
  });
});
