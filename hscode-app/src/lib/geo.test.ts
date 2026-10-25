import { describe, expect, it } from 'vitest';
import { distanceKm, insideEgypt } from './geo';

describe('geo', () => {
  it('distanceKm', () => {
    expect(distanceKm({ lat: 29.9668, lng: 30.9406 }, { lat: 30.0444, lng: 31.2357 })).toBeCloseTo(29.8, 0);
  });
  it('distanceKm stays finite for near-antipodal points', () => {
    const d = distanceKm({ lat: 0, lng: 0 }, { lat: 0.0000001, lng: 180 });
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBeCloseTo(20015, -1);
    // h can round to just above 1 for antipodal pairs; the clamp keeps asin in range
    const x = distanceKm({ lat: 62.063860961274244, lng: 13.214504052604726 }, { lat: -62.063860961274244, lng: 13.214504052604726 + 180 });
    expect(Number.isNaN(x)).toBe(false);
    expect(x).toBeCloseTo(20015, -1);
  });
  it('insideEgypt', () => {
    expect(insideEgypt(29.97, 30.94)).toBe(true);
    expect(insideEgypt(51.5, -0.12)).toBe(false);
  });
});
