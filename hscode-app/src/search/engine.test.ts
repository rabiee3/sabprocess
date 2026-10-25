import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';
import { feedMill, fixtures } from './fixtures';

const engine = createEngine(fixtures, 'en');
const ids = (q: string, f = {}) => engine.search(q, f).map((e) => e.id);

describe('engine text search', () => {
  it('finds the feed mill across Arabic letter variants, diacritics and the article', () => {
    // f2 shares the animal-feed sector label, so it legitimately matches too.
    const base = ids('اعلاف');
    expect(base[0]).toBe(feedMill.id);
    expect(ids('أعلاف')).toEqual(base);
    expect(ids('العَلَف')[0]).toBe(feedMill.id);
  });

  it('finds multi-word English queries', () => {
    expect(ids('poultry feed')).toContain('f1');
  });

  it('falls back to OR when AND finds nothing', () => {
    expect(ids('poultry steel')).toEqual(expect.arrayContaining(['f1', 'f6']));
  });

  it('breaks score ties by at desc then id', () => {
    expect(ids('steel')).toEqual(['f6', 'f7']);
  });
});

describe('engine digit search', () => {
  it('matches a stored deeper code from a heading query', () => {
    expect(ids('2309')).toEqual(['f2', 'f1']);
  });
  it('matches a stored heading from a deeper query', () => {
    expect(ids('230990')).toEqual(['f1', 'f2']);
  });
  it('accepts dots, spaces and dashes', () => {
    expect(ids('23.09')).toEqual(['f2', 'f1']);
    expect(ids('23 09 90')).toEqual(['f1', 'f2']);
  });
  it('ignores a single digit as an HS query', () => {
    expect(ids('2')).not.toContain('f3');
  });
});

describe('engine filters', () => {
  it('filters sector exactly', () => {
    expect(ids('', { sector: 'animal-feed' })).toEqual(['f1', 'f2']);
  });
  it('filters area exactly', () => {
    expect(ids('', { area: 'nowhere' })).toEqual([]);
  });
  it('hs filter returns makers, not those who need it', () => {
    expect(ids('', { hs: '1005' })).toEqual(['f3']);
  });
  it('combines query and filters', () => {
    expect(ids('steel', { sector: 'metals', hs: '7217' })).toEqual(['f7']);
  });
});

describe('engine listing', () => {
  it('returns all newest first for an empty query', () => {
    expect(ids('')).toEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']);
    expect(engine.all().length).toBe(8);
    expect(engine.byId('f3')?.id).toBe('f3');
  });
});
