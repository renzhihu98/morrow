import { DAY_CUTOFF_HOUR } from '../constants';

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    partsFormatterCache.set(timeZone, f);
  }
  return f;
}

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

/** Wall-clock parts of `instant` in `timeZone`. */
export function getLocalParts(instant: Date, timeZone: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year ?? 0,
    month: out.month ?? 0,
    day: out.day ?? 0,
    // some engines render midnight as 24 even with h23
    hour: (out.hour ?? 0) % 24,
    minute: out.minute ?? 0,
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/**
 * The reading day (`YYYY-MM-DD`) that `now` belongs to in `timeZone`.
 * A day runs from `cutoffHour`:00 local to `cutoffHour`:00 the next day,
 * so 03:59 on the 17th belongs to the 16th.
 */
export function getReadingDate(now: Date, timeZone: string, cutoffHour: number = DAY_CUTOFF_HOUR): string {
  const { year, month, day, hour } = getLocalParts(now, timeZone);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (hour < cutoffHour) d.setUTCDate(d.getUTCDate() - 1);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Add days to a `YYYY-MM-DD` date. */
export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** `2026-09-16` → `09.16` (the design's short date). */
export function formatShortDate(localDate: string): string {
  const [, m, d] = localDate.split('-');
  return `${m}.${d}`;
}

/** Local `HH:MM` (24h) of an ISO instant in `timeZone`, e.g. `06:43`. */
export function formatLocalTime(iso: string | Date, timeZone: string): string {
  const { hour, minute } = getLocalParts(typeof iso === 'string' ? new Date(iso) : iso, timeZone);
  return `${pad(hour)}:${pad(minute)}`;
}
