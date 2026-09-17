/**
 * Calendar search for chat (SPEC §10): events the person is part of, with what they are about — title, calendar,
 * location and details — read from the aggregate index. Taboo events never come back.
 */
import { formatShortDate, getLocalParts, getReadingDate } from '@morrow/core';
import { findTaboo } from '../ai/taboo';
import type { CalendarAggregates, CalendarEventState } from './aggregates';
import { partOfDay } from './facts';
import { normalizeTitle, type PursuitIndex } from './pursuits';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DETAILS_IN_RESULT = 240;

export type CalendarSearchInput = {
  /** Words to match against title, calendar name, location and details (any word matches). */
  query?: string | null;
  /** A pursuit key (`job_search`) — its events. */
  pursuit?: string | null;
  when: 'past' | 'upcoming' | 'all';
  limit?: number;
};

export type CalendarSearchHit = {
  id: string;
  date: string;
  weekday: string;
  partOfDay: string | null;
  title: string;
  calendar: string | null;
  location: string | null;
  details: string | null;
  with: string[];
  status: 'confirmed' | 'tentative';
};

export function searchCalendar(
  cal: CalendarAggregates | null,
  pursuits: PursuitIndex | null | undefined,
  input: CalendarSearchInput,
  timeZone: string,
  now: Date,
): { total: number; events: CalendarSearchHit[] } {
  if (!cal) return { total: 0, events: [] };
  const words = (input.query ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2);
  const t = now.getTime();

  const matches = Object.entries(cal.events).filter(([, e]) => {
    if (!e.t || e.sh || e.d || e.st === 'x') return false;
    const start = Date.parse(e.s);
    if (input.when === 'past' ? start > t : input.when === 'upcoming' ? start <= t : false) return false;
    const calendar = e.k ? cal.calendars?.[e.k] ?? '' : '';
    const haystack = `${e.t} ${calendar} ${e.l ?? ''} ${e.x ?? ''}`;
    if (findTaboo(haystack)) return false;
    if (input.pursuit && pursuits?.titles[normalizeTitle(e.t)] !== input.pursuit) return false;
    if (words.length > 0 && !words.some((w) => haystack.toLowerCase().includes(w))) return false;
    return true;
  });

  // Upcoming: soonest first. Past and all: most recent first.
  matches.sort(([, a], [, b]) => (input.when === 'upcoming' ? Date.parse(a.s) - Date.parse(b.s) : Date.parse(b.s) - Date.parse(a.s)));
  const toHit = ([id, e]: [string, CalendarEventState]): CalendarSearchHit => {
    const date = getReadingDate(new Date(e.s), timeZone, 0);
    const { year, month, day, hour, minute } = getLocalParts(new Date(e.s), timeZone);
    return {
      id,
      date: formatShortDate(date),
      weekday: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!,
      partOfDay: e.a ? null : partOfDay(hour * 60 + minute),
      title: e.t!,
      calendar: e.k ? cal.calendars?.[e.k] ?? null : null,
      location: e.l ?? null,
      details: e.x ? e.x.slice(0, DETAILS_IN_RESULT) : null,
      with: e.p.map((key) => cal.names[key] ?? key),
      status: e.st === 't' ? 'tentative' : 'confirmed',
    };
  };
  return { total: matches.length, events: matches.slice(0, Math.min(input.limit ?? 15, 25)).map(toHit) };
}
