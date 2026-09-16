import { fixtures, FIXTURE_NOW, FIXTURE_TIMEZONE } from '@morrow/core';
import {
  firstSentence,
  formatBytes,
  formatCount,
  isForgetConfirmed,
  previousMonthLabel,
  prophecyStatusLabel,
  shortDateOf,
  sourceShortList,
  splitStepLabel,
  weekdayLabel,
  windowLabel,
} from './format';

const prophecy = (n: number) => fixtures.prophecies.find((p) => p.number === n)!;

describe('format helpers', () => {
  it('labels weekdays and months like the archive design', () => {
    expect(weekdayLabel('2026-09-30')).toBe('WED');
    expect(weekdayLabel('2026-09-28')).toBe('MON');
    expect(previousMonthLabel('2026-09-16')).toBe('AUGUST');
    expect(previousMonthLabel('2026-01-05')).toBe('DECEMBER');
  });

  it('formats sizes, counts and sources', () => {
    expect(formatBytes(3200)).toBe('3.2 KB');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatCount(1208)).toBe('1,208');
    expect(sourceShortList(['calendar', 'spotify'])).toBe('CAL · SPT');
  });

  it('labels prophecy windows relative to now', () => {
    expect(windowLabel(prophecy(50), FIXTURE_NOW, FIXTURE_TIMEZONE)).toEqual({ text: 'CLOSES IN 3 DAYS', urgent: true });
    expect(windowLabel(prophecy(51), FIXTURE_NOW, FIXTURE_TIMEZONE)).toEqual({ text: 'UNTIL 10.19', urgent: false });
    expect(windowLabel(prophecy(47), FIXTURE_NOW, FIXTURE_TIMEZONE).text).toBe('FULFILLED 09.30');
    expect(prophecyStatusLabel(prophecy(48))).toBe('0048 EXPIRED');
    expect(shortDateOf('2026-09-27T04:00:00-07:00', FIXTURE_TIMEZONE)).toBe('09.27');
  });

  it('splits step labels and first sentences', () => {
    expect(splitStepLabel('Mail — who wrote first')).toEqual({ label: 'Mail', detail: 'who wrote first' });
    expect(splitStepLabel('Past readings')).toEqual({ label: 'Past readings', detail: null });
    expect(firstSentence("You've moved coffee with Sam four times since March. Each time, you reached out again.")).toBe(
      "You've moved coffee with Sam four times since March.",
    );
  });

  it('only confirms an exact FORGET', () => {
    expect(isForgetConfirmed('FORGET')).toBe(true);
    expect(isForgetConfirmed(' FORGET ')).toBe(true);
    expect(isForgetConfirmed('forget')).toBe(false);
    expect(isForgetConfirmed('FORGE')).toBe(false);
  });
});
