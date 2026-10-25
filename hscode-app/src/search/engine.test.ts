import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';
import { fixtures } from './fixtures';

const engine = createEngine(fixtures, 'en');
const ids = (q: string, f = {}) => engine.search(q, f).map((e) => e.id);

describe('engine text search', () => {
  it('returns the same ordered set for every spelling of feed, including singular and plural', () => {
    const base = ids('اعلاف');
    expect(base).toEqual(expect.arrayContaining(['f1', 'f9']));
    for (const q of ['أعلاف', 'الأعلاف', 'أعـــلاف', 'أَعْلاف', 'علف', 'العَلَف']) {
      expect(ids(q)).toEqual(base);
    }
  });

  it('does not return unrelated factories for a short Arabic term', () => {
    expect(ids('علف')).not.toContain('f6');
  });

  it('supports as-you-type partials', () => {
    expect(ids('ألو')).toContain('f11');
    expect(ids('الحد')).toContain('f11');
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
    expect(ids('2309')).toEqual(['f10', 'f2', 'f1']);
  });
  it('matches a stored heading from a deeper query', () => {
    expect(ids('230990')).toEqual(['f1', 'f10', 'f2']);
  });
  it('accepts dots, spaces and dashes', () => {
    expect(ids('23.09')).toEqual(['f10', 'f2', 'f1']);
    expect(ids('23 09 90')).toEqual(['f1', 'f10', 'f2']);
  });
  it('accepts Arabic-Indic and Persian digits', () => {
    expect(ids('٢٣٠٩')).toEqual(['f10', 'f2', 'f1']);
    expect(ids('۲۳۰۹')).toEqual(['f10', 'f2', 'f1']);
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
    expect(ids('', { hs: '٢٣٠٩' })).toEqual(['f1', 'f10', 'f2']);
  });
  it('combines query and filters', () => {
    expect(ids('steel', { sector: 'metals', hs: '7217' })).toEqual(['f7']);
  });
});

describe('engine listing', () => {
  it('returns all newest first for an empty query', () => {
    expect(ids('')).toEqual(['f1', 'f10', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f11']);
    expect(engine.all().length).toBe(11);
    expect(engine.byId('f3')?.id).toBe('f3');
  });
});
