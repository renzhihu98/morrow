/**
 * Sentence-case date labels for Today and the chat thread (Paper B7D / BQQ / B2K). Pure — no RN imports.
 */
import { formatLocalTime } from '@morrow/core';
import { localDateOf, weekdayLabel } from '@/lib/format';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'] as const;

/** `2026-09-21` → `21 Sept`. */
export function dayMonthLabel(localDate: string): string {
  const [, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS_SHORT[m - 1] ?? ''}`;
}

/** Today's date line: `Sun · 21 Sept · 07:12` (Paper B7D). */
export function todayDateLine(nowIso: string, timeZone: string): string {
  const date = localDateOf(nowIso, timeZone);
  return `${weekdayLabel(date)} · ${dayMonthLabel(date)} · ${formatLocalTime(nowIso, timeZone)}`;
}

/** First divider of a thread: `Today · 06:43` for today's reading, else `Tue 16 Sept · 06:43` (Paper B2K). */
export function chatDayLabel(date: string, time: string, today?: string): string {
  if (today && date === today) return `Today · ${time}`;
  return `${weekdayLabel(date)} ${dayMonthLabel(date)} · ${time}`;
}
