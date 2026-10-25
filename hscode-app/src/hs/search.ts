import { headings } from '../data';
import { normalizeArabic } from '../lib/arabic';
import { isHsQuery, normalizeHs } from '../lib/hs';

export type HsHit = { code: string; en: string; ar?: string; chapter: string };

type Entry = { hit: HsHit; hay: string };

let cache: Entry[] | null = null;

function entries(): Entry[] {
  if (!cache) {
    cache = headings().map((h) => ({
      hit: { code: h.code, en: h.en, ar: h.ar, chapter: h.code.slice(0, 2) },
      hay: normalizeArabic(`${h.en} ${h.ar ?? ''}`),
    }));
  }
  return cache;
}

function wordStart(hay: string, token: string): boolean {
  let i = hay.indexOf(token);
  while (i !== -1) {
    if (i === 0 || /[^\p{L}\p{N}]/u.test(hay[i - 1])) return true;
    i = hay.indexOf(token, i + 1);
  }
  return false;
}

export function searchHeadings(query: string, limit = 30): HsHit[] {
  const q = query.trim();
  if (!q || limit <= 0) return [];
  const all = entries();
  const out: HsHit[] = [];

  const digits = normalizeHs(q);
  if (isHsQuery(q)) {
    for (const e of all) {
      if (e.hit.code.startsWith(digits)) out.push(e.hit);
    }
    // exact first, then prefix; stable sort keeps code order
    out.sort((a, b) => Number(b.code === digits) - Number(a.code === digits));
    return out.slice(0, limit);
  }

  // Strip the Arabic definite article so "التغذيه" matches "تغذيه" (a superset match).
  const tokens = normalizeArabic(q)
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (t.length > 4 && t.startsWith('ال') ? t.slice(2) : t));
  if (!tokens.length) return [];
  const ranked: { hit: HsHit; rank: number }[] = [];
  for (const e of all) {
    if (!tokens.every((t) => e.hay.includes(t))) continue;
    ranked.push({ hit: e.hit, rank: tokens.every((t) => wordStart(e.hay, t)) ? 0 : 1 });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  return ranked.slice(0, limit).map((r) => r.hit);
}
