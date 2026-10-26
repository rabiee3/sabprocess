import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';
import { indexTerms, queryTerm } from './terms';
import type { IndexEntry } from '../lib/types';

const f = (id: string, ar: string, at: number): IndexEntry => ({
  id, n: { ar }, lat: 30, lng: 31, a: 'oct6-zone-1', m: [], d: [], at,
});
const dairyPlural = f('d1', 'مصنع ألبان', 2);
const dairySingular = f('d2', 'مصنع لبن', 1);
const boards = f('b1', 'مصنع ألواح', 3);
const boardSing = f('b2', 'مصنع لوح', 4);
const e = createEngine([dairyPlural, dairySingular, boards, boardSing], 'ar');
const ids = (q: string) => e.search(q, {}).map((x) => x.id).sort();

describe('afʿāl plurals and clitics', () => {
  it('matches ألبان and لبن both ways', () => {
    expect(ids('ألبان')).toEqual(['d1', 'd2']);
    expect(ids('لبن')).toEqual(['d1', 'd2']);
  });
  it('matches ألواح and لوح both ways', () => {
    expect(ids('ألواح')).toEqual(['b1', 'b2']);
    expect(ids('لوح')).toEqual(['b1', 'b2']);
  });
  it('strips article and preposition before an afʿāl word', () => {
    expect(queryTerm('الألبان')).toBe('لبن');
    expect(queryTerm('للألبان')).toBe('لبن');
  });
  it('does not index a bogus remainder', () => {
    expect(indexTerms('ألبان')).not.toContain('بان');
    expect(ids('بان')).toEqual([]);
  });
});
