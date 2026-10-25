import { hsString } from './hs';
import type { Factory, IndexEntry, Product } from './types';

const mapProducts = (ps: Product[]) => ps.map((p) => ({ n: p.name, h: hsString(p.hs) }));

export function toIndexEntry(f: Factory): IndexEntry {
  const entry: IndexEntry = {
    id: f.id,
    n: f.name,
    lat: f.location.lat,
    lng: f.location.lng,
    a: f.area,
    m: mapProducts(f.productsMade),
    d: mapProducts(f.productsNeeded),
  };
  if (f.sector) entry.s = f.sector;
  if (f.approvedAt) entry.at = f.approvedAt.getTime();
  return entry;
}
