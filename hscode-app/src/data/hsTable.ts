import chaptersJson from './hs-chapters.json';
import headingsJson from './hs-headings.json';
import headingsArJson from './hs-headings-ar.json';
import type { HsChapter, HsHeading } from './index';

// The bundled HS table (about 128 KB gzip). Import it only through src/hs/lazyTable.ts (a dynamic import), so it
// stays out of the first load (spec §8); tests may import it directly.
export const chapters = (): HsChapter[] => chaptersJson;
const headingsAr = headingsArJson as Record<string, string>;
const headingList: HsHeading[] = headingsJson.map((h) =>
  headingsAr[h.code] ? { ...h, ar: headingsAr[h.code] } : h,
);
export const headings = (): HsHeading[] => headingList;
