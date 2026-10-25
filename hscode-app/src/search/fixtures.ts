import type { IndexEntry } from '../lib/types';

export const feedMill: IndexEntry = {
  id: 'f1',
  n: { en: 'Delta Feed Mill', ar: 'مصنع العلف الذهبي' },
  lat: 30, lng: 31, a: 'oct6-zone-1', s: 'animal-feed',
  m: [{ n: { en: 'Poultry feed', ar: 'أعلاف دواجن' }, h: '230990' }],
  d: [{ n: { en: 'Maize', ar: 'ذرة' }, h: '1005' }],
  at: 500,
};

const mk = (id: string, name: string, at: number, extra: Partial<IndexEntry> = {}): IndexEntry => ({
  id, n: { en: name }, lat: 30, lng: 31, a: 'oct6-zone-1', m: [], d: [], at, ...extra,
});

export const fixtures: IndexEntry[] = [
  feedMill,
  mk('f2', 'Nile Fodder', 400, { s: 'animal-feed', m: [{ n: { en: 'Cattle fodder' }, h: '2309' }] }),
  mk('f3', 'Maize Growers', 300, { s: 'food', m: [{ n: { en: 'Maize' }, h: '1005' }] }),
  mk('f4', 'Corn Starch Co', 200, { s: 'food', m: [{ n: { en: 'Starch' }, h: '1108' }], d: [{ n: { en: 'Maize' }, h: '1005' }] }),
  mk('f5', 'Plastic Works', 100, { s: 'plastics-packaging', m: [{ n: { en: 'Plastic bags' }, h: '3923' }] }),
  mk('f6', 'Steel One', 50, { s: 'metals', m: [{ n: { en: 'Steel bars' }, h: '7214' }] }),
  mk('f7', 'Steel Two', 50, { s: 'metals', m: [{ n: { en: 'Steel wire' }, h: '7217' }] }),
  mk('f8', 'No Codes', 10),
];
