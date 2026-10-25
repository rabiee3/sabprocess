import { EGYPT_BOUNDS } from './types';

interface LatLng {
  lat: number;
  lng: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function insideEgypt(lat: number, lng: number): boolean {
  return (
    lat >= EGYPT_BOUNDS.minLat && lat <= EGYPT_BOUNDS.maxLat &&
    lng >= EGYPT_BOUNDS.minLng && lng <= EGYPT_BOUNDS.maxLng
  );
}
