import { hsString } from './hs';
import type { Factory, IndexEntry, LocalizedName, Product } from './types';

/** A copy of `n` with only the keys that hold a value (Firestore rejects `undefined`). */
const copyName = (n: LocalizedName): LocalizedName => {
  const out: LocalizedName = {};
  if (n.en !== undefined) out.en = n.en;
  if (n.ar !== undefined) out.ar = n.ar;
  return out;
};

const mapProducts = (ps: Product[]): IndexEntry['m'] =>
  ps.map((p) => {
    const item: IndexEntry['m'][number] = { n: copyName(p.name) };
    if (p.hs) item.h = hsString(p.hs);
    return item;
  });

export function toIndexEntry(f: Factory): IndexEntry {
  const entry: IndexEntry = {
    id: f.id,
    n: copyName(f.name),
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
