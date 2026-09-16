/**
 * Pure presentation helpers (no React Native imports — unit tested with jest-expo).
 */
import {
  formatProphecyNumber,
  formatShortDate,
  getReadingDate,
  type Prophecy,
  type ProphecyStatus,
  type SourceKind,
} from '@morrow/core';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const;

/** `2026-09-30` → `TUE` (calendar weekday of a local date, timezone-free). */
export function weekdayLabel(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
}

/** `2026-08-24` → `AUGUST`. */
export function monthLabel(localDate: string): string {
  const m = Number(localDate.split('-')[1]);
  return MONTHS[m - 1] ?? '';
}

/** Month before the given local date's month, e.g. `2026-09-16` → `AUGUST`. */
export function previousMonthLabel(localDate: string): string {
  const m = Number(localDate.split('-')[1]);
  return MONTHS[(m + 10) % 12] ?? '';
}

/** 3200 → `3.2 KB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const kb = bytes / 1000;
  return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
}

/** 1208 → `1,208`. */
export function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Two-digit padded count: 7 → `07`. */
export const pad2 = (n: number) => String(n).padStart(2, '0');

const SOURCE_GLYPH: Record<SourceKind, string> = { calendar: 'CA', spotify: 'SP', mail: 'MA', instagram: 'IG' };
const SOURCE_SHORT: Record<SourceKind, string> = { calendar: 'CAL', spotify: 'SPT', mail: 'MAIL', instagram: 'IG' };

export const sourceGlyph = (kind: SourceKind) => SOURCE_GLYPH[kind];
/** Dossier source column: `CAL · SPT`. */
export const sourceShortList = (kinds: SourceKind[]) => kinds.map((k) => SOURCE_SHORT[k]).join(' · ');

/** Calendar date (`YYYY-MM-DD`) of an instant in `timeZone` (midnight boundary). */
export const localDateOf = (iso: string, timeZone: string) => getReadingDate(new Date(iso), timeZone, 0);

/** `09.30` short date of an instant in `timeZone`. */
export const shortDateOf = (iso: string, timeZone: string) => formatShortDate(localDateOf(iso, timeZone));

/** Whole days from `now` until the prophecy window closes (ceil, ≥ 0). */
export function daysUntil(iso: string, now: Date): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now.getTime()) / 86_400_000));
}

/** Right-hand label on an open prophecy card: `CLOSES IN 3 DAYS` (≤ 3 days, accent) or `UNTIL 10.19`. */
export function windowLabel(
  p: Pick<Prophecy, 'windowEnd' | 'status' | 'resolvedAt'>,
  now: Date,
  timeZone: string,
): { text: string; urgent: boolean } {
  const timeZoneDate = (iso: string) => localDateOf(iso, timeZone);
  if (p.status === 'fulfilled' && p.resolvedAt) return { text: `FULFILLED ${formatShortDate(timeZoneDate(p.resolvedAt))}`, urgent: true };
  if (p.status === 'expired') return { text: 'EXPIRED', urgent: false };
  const days = daysUntil(p.windowEnd, now);
  if (days <= 3) return { text: days <= 1 ? 'CLOSES TODAY' : `CLOSES IN ${days} DAYS`, urgent: true };
  return { text: `UNTIL ${formatShortDate(timeZoneDate(p.windowEnd))}`, urgent: false };
}

/** Readings archive: right-hand prophecy status, e.g. `0051 OPEN`. */
export function prophecyStatusLabel(p: Pick<Prophecy, 'number' | 'status'>): string {
  const labels: Record<ProphecyStatus, string> = { open: 'OPEN', fulfilled: 'FULFILLED', expired: 'EXPIRED' };
  return `${formatProphecyNumber(p.number)} ${labels[p.status]}`;
}

/** First sentence of a headline, for single-line list rows. */
export function firstSentence(text: string): string {
  const m = text.match(/^.+?[.!?](?=\s|$)/);
  return m ? m[0] : text;
}

/**
 * Split a step label like `Calendar — coffee with Sam, four moves` into
 * a mono label and a detail line.
 */
export function splitStepLabel(label: string): { label: string; detail: string | null } {
  const idx = label.indexOf(' — ');
  if (idx === -1) return { label, detail: null };
  return { label: label.slice(0, idx), detail: label.slice(idx + 3) };
}

export type StepStatus = 'done' | 'active' | 'pending';
export const stepGlyph = (s: StepStatus) => (s === 'done' ? '✓' : s === 'active' ? '◌' : '·');

/** Composer counter: `3/15`. */
export const quotaLabel = (used: number, limit: number) => `${used}/${limit}`;

/** Clamp to 0–1. */
export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** A confirm input enables the destructive action only on an exact (trimmed, case-sensitive) `FORGET`. */
export const isForgetConfirmed = (value: string) => value.trim() === 'FORGET';
