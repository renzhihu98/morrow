import { moonPath, terminatorRx } from './MoonGlyph';

describe('MoonGlyph phases', () => {
  it('matches the Paper glyphs (.58 → 1.0, .64 → 1.8, .71 → 2.7)', () => {
    expect(terminatorRx(0.58)).toBeCloseTo(1.04, 1);
    expect(terminatorRx(0.64)).toBeCloseTo(1.82, 1);
    expect(terminatorRx(0.71)).toBeCloseTo(2.73, 1);
  });

  it('keeps neighbouring likelihoods distinct and ordered', () => {
    const [a, b, c] = [terminatorRx(0.58), terminatorRx(0.64), terminatorRx(0.71)];
    expect(b - a).toBeGreaterThan(0.5);
    expect(c - b).toBeGreaterThan(0.5);
  });

  it('curves the terminator left for gibbous and right for crescent', () => {
    expect(moonPath(0.71)).toMatch(/0 0 1 8 1\.5 Z$/);
    expect(moonPath(0.25)).toMatch(/0 0 0 8 1\.5 Z$/);
  });
});
