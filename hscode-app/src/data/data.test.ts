import { chapters, headings, loadSubheadings, areas, sectors } from './index';

describe('bundled data', () => {
  it('has 96 chapters, each with en and ar, chapter 77 absent', () => {
    expect(chapters()).toHaveLength(96);
    expect(chapters().every((c) => /^\d{2}$/.test(c.code) && c.en && c.ar)).toBe(true);
    expect(chapters().find((c) => c.code === '77')).toBeUndefined();
  });
  it('every heading is 4 digits under an existing chapter', () => {
    const ch = new Set(chapters().map((c) => c.code));
    expect(headings().length).toBeGreaterThan(1200);
    expect(headings().every((h) => /^\d{4}$/.test(h.code) && ch.has(h.code.slice(0, 2)))).toBe(true);
  });
  it('loads subheadings of 2309 lazily', async () => {
    const subs = await loadSubheadings('2309');
    expect(subs.map((s) => s.code)).toContain('230990');
    expect(subs.every((s) => s.code.startsWith('2309'))).toBe(true);
  });
  it('areas have unique ids and centres inside Egypt', () => {
    const ids = areas().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      areas().every(
        (a) => a.center.lat >= 21.5 && a.center.lat <= 32 && a.center.lng >= 24.5 && a.center.lng <= 37,
      ),
    ).toBe(true);
  });
  it('sectors have unique ids with en and ar', () => {
    const ids = sectors().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(11);
    expect(sectors().every((s) => s.en && s.ar)).toBe(true);
  });
});
