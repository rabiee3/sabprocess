import { describe, expect, it } from 'vitest';
import { distanceKm, insideEgypt } from './geo';

describe('geo', () => {
  it('distanceKm', () => {
    expect(distanceKm({ lat: 29.9668, lng: 30.9406 }, { lat: 30.0444, lng: 31.2357 })).toBeCloseTo(29.8, 0);
  });
  it('insideEgypt', () => {
    expect(insideEgypt(29.97, 30.94)).toBe(true);
    expect(insideEgypt(51.5, -0.12)).toBe(false);
  });
});
