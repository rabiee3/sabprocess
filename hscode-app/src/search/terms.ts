import { normalizeArabic } from '../lib/arabic';

// Curated forms in normalized spelling; both dawajin and dajaj map to one canonical.
const CURATED: Record<string, string> = {
  منتجات: 'منتج',
  دواجن: 'دجاج',
  لحوم: 'لحم',
  حبوب: 'حب',
  اغذيه: 'غذا',
  اوراق: 'ورق',
  كابلات: 'كابل',
};

const CLITIC = /^(?:وال|بال|فال|كال|لل|ال)(?=.{3,})/;

/** Drop a leading conjunction/preposition + article when at least 3 letters remain. */
export function stripClitic(t: string): string {
  return t.replace(CLITIC, '');
}

/** Singular of the afʿāl plural shape (أعلاف -> علف) plus a small curated map. */
export function sing(t: string): string {
  if (CURATED[t]) return CURATED[t];
  return t.replace(/^ا(.)(.)ا(.)$/, '$1$2$3');
}

const AFAL = /^ا(.)(.)ا(.)$/;

/** Strip clitics, but never from a word that is itself the afʿāl shape (ألبان != أ+لبان). */
function stripAll(t: string): string {
  for (let i = 0; i < 2; i++) {
    if (AFAL.test(t)) break;
    const s = stripClitic(t);
    if (s === t) break;
    t = s;
  }
  return t;
}

/** Index time: raw plus stripped/singular variants (raw kept for as-you-type partials). */
export function indexTerms(term: string): string[] {
  const t = normalizeArabic(term);
  if (!t) return [];
  const c = stripAll(t);
  return [...new Set([t, c, sing(c)])];
}

/** Query time: a single term (arrays would be ANDed). */
export function queryTerm(term: string): string {
  return sing(stripAll(normalizeArabic(term)));
}
