import { describe, expect, it } from 'vitest';
import { FIXTURE_NOW, QUESTION_LIMIT, fixtures, formatProphecyNumber, isReadingOpen, questionsLeft, windowProgress } from '../src';

describe('questionsLeft', () => {
  it('counts down from the limit and never goes negative', () => {
    expect(questionsLeft({ questionCount: 0 })).toBe(QUESTION_LIMIT);
    expect(questionsLeft({ questionCount: 2 })).toBe(13);
    expect(questionsLeft({ questionCount: 15 })).toBe(0);
    expect(questionsLeft({ questionCount: 20 })).toBe(0);
  });
});

describe('isReadingOpen', () => {
  const r = { status: 'open' as const, localDate: '2026-09-30', timezone: 'America/Los_Angeles' };
  it('is open during its reading day only', () => {
    expect(isReadingOpen(r, FIXTURE_NOW)).toBe(true);
    expect(isReadingOpen(r, new Date('2026-10-01T03:59:00-07:00'))).toBe(true);
    expect(isReadingOpen(r, new Date('2026-10-01T04:00:00-07:00'))).toBe(false);
    expect(isReadingOpen({ ...r, status: 'sealed' }, FIXTURE_NOW)).toBe(false);
  });
});

describe('windowProgress', () => {
  const base = {
    windowStart: '2026-09-01T00:00:00Z',
    windowEnd: '2026-09-11T00:00:00Z',
    status: 'open' as const,
    resolvedAt: null,
  };
  it('returns elapsed fraction clamped to 0–1', () => {
    expect(windowProgress(base, new Date('2026-08-30T00:00:00Z'))).toBe(0);
    expect(windowProgress(base, new Date('2026-09-01T00:00:00Z'))).toBe(0);
    expect(windowProgress(base, new Date('2026-09-06T00:00:00Z'))).toBeCloseTo(0.5);
    expect(windowProgress(base, new Date('2026-09-11T00:00:00Z'))).toBe(1);
    expect(windowProgress(base, new Date('2026-10-01T00:00:00Z'))).toBe(1);
  });
  it('freezes at resolvedAt for resolved prophecies', () => {
    const fulfilled = { ...base, status: 'fulfilled' as const, resolvedAt: '2026-09-03T12:00:00Z' };
    expect(windowProgress(fulfilled, new Date('2026-10-01T00:00:00Z'))).toBeCloseTo(0.25);
  });
  it('handles zero-length windows', () => {
    const z = { ...base, windowEnd: base.windowStart };
    expect(windowProgress(z, new Date('2026-08-01T00:00:00Z'))).toBe(0);
    expect(windowProgress(z, new Date('2026-09-02T00:00:00Z'))).toBe(1);
  });
  it('matches the 0047 fixture (fulfilled 09.30 in a 09.16→10.07 window)', () => {
    const p = fixtures.prophecies.find((x) => x.number === 47)!;
    expect(windowProgress(p, FIXTURE_NOW)).toBeGreaterThan(0.6);
    expect(windowProgress(p, FIXTURE_NOW)).toBeLessThan(0.7);
  });
});

describe('formatProphecyNumber', () => {
  it('pads to four digits', () => {
    expect(formatProphecyNumber(47)).toBe('0047');
  });
});
