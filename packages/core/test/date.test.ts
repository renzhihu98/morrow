import { describe, expect, it } from 'vitest';
import { addDays, formatLocalTime, formatShortDate, getReadingDate } from '../src';

const LA = 'America/Los_Angeles';

describe('getReadingDate', () => {
  it('applies the 04:00 local cutoff', () => {
    expect(getReadingDate(new Date('2026-09-17T03:59:00-07:00'), LA)).toBe('2026-09-16');
    expect(getReadingDate(new Date('2026-09-17T04:00:00-07:00'), LA)).toBe('2026-09-17');
    expect(getReadingDate(new Date('2026-09-17T00:00:00-07:00'), LA)).toBe('2026-09-16');
    expect(getReadingDate(new Date('2026-09-17T23:59:00-07:00'), LA)).toBe('2026-09-17');
  });

  it('uses the given timezone, not the host timezone', () => {
    const instant = new Date('2026-09-17T10:30:00Z');
    expect(getReadingDate(instant, LA)).toBe('2026-09-16'); // 03:30 PDT
    expect(getReadingDate(instant, 'Europe/London')).toBe('2026-09-17'); // 11:30 BST
    expect(getReadingDate(instant, 'Asia/Tokyo')).toBe('2026-09-17'); // 19:30 JST
    expect(getReadingDate(new Date('2026-09-17T18:30:00Z'), 'Asia/Tokyo')).toBe('2026-09-17'); // 03:30 JST on 18th
    expect(getReadingDate(new Date('2026-09-17T19:00:00Z'), 'Asia/Tokyo')).toBe('2026-09-18'); // 04:00 JST
  });

  it('crosses month and year boundaries', () => {
    expect(getReadingDate(new Date('2027-01-01T03:00:00-08:00'), LA)).toBe('2026-12-31');
    expect(getReadingDate(new Date('2026-10-01T02:00:00-07:00'), LA)).toBe('2026-09-30');
  });

  it('handles DST fall-back (2026-11-01, 02:00 PDT → 01:00 PST)', () => {
    // 01:30 occurs twice; both are before the cutoff
    expect(getReadingDate(new Date('2026-11-01T01:30:00-07:00'), LA)).toBe('2026-10-31');
    expect(getReadingDate(new Date('2026-11-01T01:30:00-08:00'), LA)).toBe('2026-10-31');
    expect(getReadingDate(new Date('2026-11-01T03:59:00-08:00'), LA)).toBe('2026-10-31');
    expect(getReadingDate(new Date('2026-11-01T04:00:00-08:00'), LA)).toBe('2026-11-01');
  });

  it('handles DST spring-forward (2026-03-08, 02:00 PST → 03:00 PDT)', () => {
    expect(getReadingDate(new Date('2026-03-08T01:59:00-08:00'), LA)).toBe('2026-03-07');
    expect(getReadingDate(new Date('2026-03-08T03:59:00-07:00'), LA)).toBe('2026-03-07');
    expect(getReadingDate(new Date('2026-03-08T04:00:00-07:00'), LA)).toBe('2026-03-08');
  });

  it('supports a custom cutoff hour', () => {
    const t = new Date('2026-09-17T00:30:00-07:00');
    expect(getReadingDate(t, LA, 0)).toBe('2026-09-17');
    expect(getReadingDate(t, LA, 1)).toBe('2026-09-16');
  });
});

describe('date helpers', () => {
  it('formats and adds', () => {
    expect(formatShortDate('2026-09-16')).toBe('09.16');
    expect(formatLocalTime('2026-09-16T13:43:00Z', LA)).toBe('06:43');
    expect(formatLocalTime('2026-09-16T07:05:00Z', LA)).toBe('00:05');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});
