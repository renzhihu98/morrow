import { addDays, getLocalParts } from '@morrow/core';

/** The UTC instant of `localDate` at `hour`:00 wall time in `timeZone` (DST-safe to the hour). */
export function zonedInstant(localDate: string, hour: number, timeZone: string): Date {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d, hour);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = getLocalParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += target - asUtc;
  }
  return new Date(guess);
}

/** When a reading day ends: 04:00 local on the following date. */
export const readingDayEnd = (localDate: string, timeZone: string, cutoffHour = 4) =>
  zonedInstant(addDays(localDate, 1), cutoffHour, timeZone);

/** `2026-09-30` → `Wed` */
export function weekdayShort(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}
