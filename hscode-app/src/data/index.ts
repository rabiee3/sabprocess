import chaptersJson from './hs-chapters.json';
import headingsJson from './hs-headings.json';
import headingsArJson from './hs-headings-ar.json';
import areasJson from './areas.json';
import sectorsJson from './sectors.json';

export interface HsChapter { code: string; en: string; ar: string }
export interface HsHeading { code: string; en: string; ar?: string }
export interface HsSub { code: string; en: string }
export interface Area { id: string; en: string; ar: string; center: { lat: number; lng: number } }
export interface Sector { id: string; en: string; ar: string }

// One chunk per chapter; Vite splits these so subheadings stay out of the main bundle.
const subLoaders = import.meta.glob<HsSub[]>('./hs-sub/*.json', { import: 'default' });

export const chapters = (): HsChapter[] => chaptersJson;
const headingsAr = headingsArJson as Record<string, string>;
const headingList: HsHeading[] = headingsJson.map((h) =>
  headingsAr[h.code] ? { ...h, ar: headingsAr[h.code] } : h,
);
export const headings = (): HsHeading[] => headingList;
export const areas = (): Area[] => areasJson;
export const sectors = (): Sector[] => sectorsJson;

export async function loadSubheadings(heading: string): Promise<HsSub[]> {
  const load = subLoaders[`./hs-sub/${heading.slice(0, 2)}.json`];
  if (!load) return [];
  return (await load()).filter((s) => s.code.startsWith(heading));
}
