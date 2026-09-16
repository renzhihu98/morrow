import type { Prophecy, ProphecyStatus } from '../schemas/prophecy';

/**
 * Elapsed fraction (0–1) of the prophecy window at `now`.
 * For resolved prophecies the bar stops at `resolvedAt`.
 */
export function windowProgress(
  prophecy: Pick<Prophecy, 'windowStart' | 'windowEnd' | 'status' | 'resolvedAt'>,
  now: Date,
): number {
  const start = Date.parse(prophecy.windowStart);
  const end = Date.parse(prophecy.windowEnd);
  let t = now.getTime();
  if (prophecy.status !== 'open' && prophecy.resolvedAt) t = Math.min(t, Date.parse(prophecy.resolvedAt));
  if (!(end > start)) return t >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (t - start) / (end - start)));
}

/** 47 → "0047". */
export function formatProphecyNumber(n: number): string {
  return String(n).padStart(4, '0');
}

export type ProphecyRecord = { fulfilled: number; open: number; expired: number; marks: ProphecyStatus[] };

/** Counts + record marks (oldest → newest, last `limit`) for the Prophecies screen. */
export function prophecyRecord(prophecies: Pick<Prophecy, 'number' | 'status'>[], limit = 12): ProphecyRecord {
  const sorted = [...prophecies].sort((a, b) => a.number - b.number);
  return {
    fulfilled: prophecies.filter((p) => p.status === 'fulfilled').length,
    open: prophecies.filter((p) => p.status === 'open').length,
    expired: prophecies.filter((p) => p.status === 'expired').length,
    marks: sorted.slice(-limit).map((p) => p.status),
  };
}
