import MiniSearch from 'minisearch';
import { areas, sectors } from '../data';
import { isHsQuery, normalizeHs } from '../lib/hs';
import type { IndexEntry } from '../lib/types';
import { indexTerms, queryTerm } from './terms';

export type SearchFilters = { area?: string; sector?: string; hs?: string };
export type Engine = {
  search(q: string, f: SearchFilters): IndexEntry[];
  byId(id: string): IndexEntry | undefined;
  all(): IndexEntry[];
};

type Doc = { id: string; name: string; made: string; sector: string; area: string };

const byAt = (a: IndexEntry, b: IndexEntry) =>
  (b.at ?? 0) - (a.at ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const join = (...s: (string | undefined)[]) => s.filter(Boolean).join(' ');

/** Either-direction prefix match between a stored code and the typed digits. */
export function hsRelated(code: string | undefined, digits: string): boolean {
  if (!code || !digits) return false;
  return code.startsWith(digits) || digits.startsWith(code);
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function passes(e: IndexEntry, f: SearchFilters): boolean {
  if (f.area && e.a !== f.area) return false;
  if (f.sector && e.s !== f.sector) return false;
  if (f.hs) {
    const d = normalizeHs(f.hs);
    if (d && !e.m.some((p) => hsRelated(p.h, d))) return false;
  }
  return true;
}

/** The entries that pass the filters, newest first: what an empty query shows, without building an engine. */
export function filterEntries(entries: IndexEntry[], f: SearchFilters): IndexEntry[] {
  return entries.filter((e) => passes(e, f)).sort(byAt);
}

export function createEngine(entries: IndexEntry[], _lang: 'en' | 'ar'): Engine {
  const map = new Map(entries.map((e) => [e.id, e]));
  const areaById = new Map(areas().map((a) => [a.id, a]));
  const sectorById = new Map(sectors().map((s) => [s.id, s]));

  const docs: Doc[] = entries.map((e) => {
    const sec = e.s ? sectorById.get(e.s) : undefined;
    const ar = areaById.get(e.a);
    return {
      id: e.id,
      name: join(e.n.en, e.n.ar),
      made: e.m.map((p) => join(p.n.en, p.n.ar)).join(' '),
      sector: join(sec?.en, sec?.ar),
      area: join(ar?.en, ar?.ar),
    };
  });

  const mini = new MiniSearch<Doc>({
    fields: ['name', 'made', 'sector', 'area'],
    idField: 'id',
    processTerm: indexTerms,
    searchOptions: {
      processTerm: queryTerm,
      prefix: true,
      fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
      boost: { name: 2, made: 2 },
      combineWith: 'AND',
    },
  });
  mini.addAll(docs);

  const textSearch = (q: string): IndexEntry[] => {
    let hits = mini.search(q);
    if (!hits.length && q.split(/\s+/).length > 1) hits = mini.search(q, { combineWith: 'OR' });
    return hits
      .map((h) => ({ e: map.get(h.id)!, score: h.score }))
      .sort((a, b) => b.score - a.score || byAt(a.e, b.e))
      .map((x) => x.e);
  };

  const digitSearch = (digits: string): IndexEntry[] => {
    const ranked: { e: IndexEntry; exact: boolean; common: number }[] = [];
    for (const e of entries) {
      const codes = e.m.map((p) => p.h).filter((h): h is string => !!h && hsRelated(h, digits));
      if (!codes.length) continue;
      ranked.push({
        e,
        exact: codes.includes(digits),
        common: Math.max(...codes.map((c) => commonPrefix(c, digits))),
      });
    }
    return ranked
      .sort((a, b) => Number(b.exact) - Number(a.exact) || b.common - a.common || byAt(a.e, b.e))
      .map((x) => x.e);
  };

  return {
    all: () => [...entries].sort(byAt),
    byId: (id) => map.get(id),
    search(q, f) {
      const query = q.trim();
      let out: IndexEntry[];
      const digits = normalizeHs(query);
      if (!query) out = [...entries].sort(byAt);
      else if (isHsQuery(query)) out = digitSearch(digits);
      else out = textSearch(query);
      return out.filter((e) => passes(e, f));
    },
  };
}

const engines = new WeakMap<IndexEntry[], Engine>();

/** The engine already built for these entries, if any (never builds). */
export function peekEngine(entries: IndexEntry[]): Engine | undefined {
  return engines.get(entries);
}

/** Memoised by array identity: loadIndex() returns the same array, so a remount never rebuilds. */
export function getEngine(entries: IndexEntry[]): Engine {
  let e = engines.get(entries);
  if (!e) {
    e = createEngine(entries, 'en');
    engines.set(entries, e);
  }
  return e;
}
