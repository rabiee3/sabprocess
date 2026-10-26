import { areas, sectors } from '../data';
import { normalizeArabic } from '../lib/arabic';
import { indexTerms, queryTerm } from './terms';
import { isHsQuery, normalizeHs } from '../lib/hs';
import { searchHeadings } from '../hs/search';
import type { Engine } from './engine';
import { hsRelated } from './engine';

export type Suggestions = {
  products: { label: string; q: string }[];
  hs: { code: string; label: string }[];
  sectors: { id: string; label: string }[];
  areas: { id: string; label: string }[];
};

const MAX = 5;

// Product text plus its stripped/singular variants, space separated.
const productHay = (n: { en?: string; ar?: string }) =>
  `${n.en ?? ''} ${n.ar ?? ''}`.split(/\s+/).flatMap(indexTerms).join(' ');

export function suggest(engine: Engine, q: string, lang: 'en' | 'ar'): Suggestions {
  const out: Suggestions = { products: [], hs: [], sectors: [], areas: [] };
  const needle = normalizeArabic(q);
  if (!needle) return out;
  const pneedle = needle.split(' ').map(queryTerm).join(' ');
  const pick = (en?: string, ar?: string) => (lang === 'ar' ? ar || en : en || ar) ?? '';

  const seen = new Set<string>();
  const codes = new Set<string>();
  for (const e of engine.all()) {
    for (const p of e.m) {
      if (p.h) codes.add(p.h);
      const label = pick(p.n.en, p.n.ar);
      const key = normalizeArabic(label);
      if (
        out.products.length < MAX &&
        !seen.has(key) &&
        productHay(p.n).includes(pneedle)
      ) {
        seen.add(key);
        out.products.push({ label, q: label });
      }
    }
  }

  for (const h of searchHeadings(isHsQuery(q) ? normalizeHs(q).slice(0, 4) : q, 200)) {
    if (out.hs.length >= MAX) break;
    if ([...codes].some((c) => hsRelated(c, h.code))) {
      out.hs.push({ code: h.code, label: pick(h.en, h.ar) });
    }
  }

  const match = (en: string, ar: string) => normalizeArabic(`${en} ${ar}`).includes(needle);
  for (const s of sectors()) {
    if (out.sectors.length < MAX && match(s.en, s.ar)) out.sectors.push({ id: s.id, label: pick(s.en, s.ar) });
  }
  for (const a of areas()) {
    if (out.areas.length < MAX && match(a.en, a.ar)) out.areas.push({ id: a.id, label: pick(a.en, a.ar) });
  }
  return out;
}
