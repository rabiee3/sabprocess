import areasJson from './areas.json';
import sectorsJson from './sectors.json';

export interface HsChapter { code: string; en: string; ar: string }
export interface HsHeading { code: string; en: string; ar?: string }
export interface HsSub { code: string; en: string }
export interface Area { id: string; en: string; ar: string; center: { lat: number; lng: number } }
export interface Sector { id: string; en: string; ar: string }

// One chunk per chapter; Vite splits these so subheadings stay out of the main bundle.
const subLoaders = import.meta.glob<HsSub[]>('./hs-sub/*.json', { import: 'default' });

// The HS chapters and headings (about 128 KB gzip) live in ./hsTable, loaded lazily (src/hs/lazyTable.ts):
// never import it statically from code on the map's first load.
export const areas = (): Area[] => areasJson;
export const sectors = (): Sector[] => sectorsJson;

export async function loadSubheadings(heading: string): Promise<HsSub[]> {
  const load = subLoaders[`./hs-sub/${heading.slice(0, 2)}.json`];
  if (!load) return [];
  return (await load()).filter((s) => s.code.startsWith(heading));
}
