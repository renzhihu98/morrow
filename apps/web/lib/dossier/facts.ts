/**
 * Deterministic dossier facts from aggregates (no LLM). Every fact id is a stable evidence ref
 * (`people.sam`, `rhythms.protected_time`, …) that readings must cite; values carry the dates behind them.
 */
import { formatShortDate, getLocalParts, getReadingDate, type DossierFact, type SourceKind } from '@morrow/core';
import { findTaboo } from '../ai/taboo';
import type { CalendarAggregates, CalendarEventState, DossierAggregates, SpotifyAggregates } from './aggregates';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_PEOPLE = 6;

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (min: number) => {
  const m = Math.round(min);
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function localDate(iso: string, tz: string) {
  return getReadingDate(new Date(iso), tz, 0);
}

function localWeekday(iso: string, tz: string): number {
  const { year, month, day } = getLocalParts(new Date(iso), tz);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function localMinutes(iso: string, tz: string): number {
  const { hour, minute } = getLocalParts(new Date(iso), tz);
  return hour * 60 + minute;
}

function mostCommon<T>(items: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of counts) if (!best || count > best.count) best = { value, count };
  return best;
}

const byTime = (a: string, b: string) => Date.parse(a) - Date.parse(b);

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const titleCase = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Past, attended, timed events. */
const attended = (e: CalendarEventState, now: Date) => e.st !== 'x' && !e.d && !e.a && Date.parse(e.s) <= now.getTime();

// ─── people ────────────────────────────────────────────────────────────────

export type ContactStat = {
  contact: string;
  name: string;
  meetings: string[];
  moves: string[];
  usualMoveWeekday: string | null;
  everyDays: number | null;
};

export function contactStats(cal: CalendarAggregates, tz: string, now: Date): ContactStat[] {
  const byContact = new Map<string, { meetings: string[]; moves: string[] }>();
  const entry = (k: string) => {
    let v = byContact.get(k);
    if (!v) byContact.set(k, (v = { meetings: [], moves: [] }));
    return v;
  };
  for (const e of Object.values(cal.events)) {
    if (!attended(e, now) || e.p.length === 0 || e.p.length > 8) continue; // skip all-hands
    for (const c of e.p) entry(c).meetings.push(e.s);
  }
  for (const m of cal.moves) {
    if (m.contacts.length > 8) continue;
    for (const c of m.contacts) entry(c).moves.push(m.from);
  }
  return [...byContact.entries()]
    .map(([contact, v]) => {
      const meetings = v.meetings.sort(byTime);
      const moves = v.moves.sort(byTime);
      const gaps = meetings.slice(1).map((m, i) => (Date.parse(m) - Date.parse(meetings[i]!)) / DAY_MS);
      const weekday = mostCommon(moves.map((m) => localWeekday(m, tz)));
      return {
        contact,
        name: cal.names[contact] ?? titleCase(contact),
        meetings,
        moves,
        usualMoveWeekday: weekday ? WEEKDAYS[weekday.value]! : null,
        everyDays: gaps.length ? Math.max(1, Math.round(mean(gaps))) : null,
      };
    })
    .filter((s) => s.moves.length >= 2 || s.meetings.length >= 3)
    .sort((a, b) => b.moves.length - a.moves.length || b.meetings.length - a.meetings.length || a.contact.localeCompare(b.contact));
}

function peopleFacts(cal: CalendarAggregates, tz: string, now: Date): DossierFact[] {
  return contactStats(cal, tz, now)
    .slice(0, MAX_PEOPLE)
    .map((s) => {
      const parts: string[] = [];
      if (s.moves.length >= 2) {
        const dates = s.moves.slice(-4).map((m) => formatShortDate(localDate(m, tz)));
        parts.push(`Moved ${s.moves.length} times${s.usualMoveWeekday ? `, mostly ${s.usualMoveWeekday}s` : ''} (${dates.join(' · ')})`);
      }
      if (s.meetings.length >= 2) {
        const since = formatShortDate(localDate(s.meetings[0]!, tz));
        parts.push(`Met ${s.meetings.length} times since ${since}${s.everyDays ? `, every ${s.everyDays} days or so` : ''}`);
      }
      const last = s.meetings.at(-1);
      if (last) parts.push(`last ${formatShortDate(localDate(last, tz))}`);
      return { id: `people.${s.contact}`, category: 'people' as const, label: s.name.split(/\s+/)[0] ?? s.name, value: parts.join(' · '), sources: ['calendar'] };
    });
}

// ─── rhythms ───────────────────────────────────────────────────────────────

/** Earliest activity per local date: first attended meeting start and/or first play (after 04:00). */
export function firstActivityByDay(agg: DossierAggregates, tz: string, now: Date) {
  const days = new Map<string, { min: number; sources: Set<SourceKind> }>();
  const note = (date: string, min: number, source: SourceKind) => {
    if (min < 4 * 60) return;
    const d = days.get(date);
    if (!d) days.set(date, { min, sources: new Set([source]) });
    else if (min < d.min) Object.assign(d, { min, sources: new Set([source]) });
    else if (min === d.min) d.sources.add(source);
  };
  for (const e of Object.values(agg.calendar?.events ?? {})) {
    if (!attended(e, now)) continue;
    const date = localDate(e.s, tz);
    const wd = localWeekday(e.s, tz);
    if (wd === 0 || wd === 6) continue;
    note(date, localMinutes(e.s, tz), 'calendar');
  }
  for (const [date, day] of Object.entries(agg.spotify?.days ?? {})) {
    if (day.firstMin === null) continue;
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    note(date, day.firstMin, 'spotify');
  }
  return days;
}

function firstActivityFact(agg: DossierAggregates, tz: string, now: Date): DossierFact | null {
  const today = getReadingDate(now, tz, 0);
  const daysAgo = (date: string) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);
  const days = [...firstActivityByDay(agg, tz, now).entries()].filter(([date]) => daysAgo(date) >= 0 && daysAgo(date) <= 60);
  if (days.length < 5) return null;
  const recent = days.filter(([date]) => daysAgo(date) <= 14).map(([, d]) => d.min);
  const earlier = days.filter(([date]) => daysAgo(date) > 14).map(([, d]) => d.min);
  const sources = [...new Set(days.flatMap(([, d]) => [...d.sources]))].sort() as SourceKind[];
  const base = recent.length >= 3 ? mean(recent) : mean(days.map(([, d]) => d.min));
  let value = `Weekdays start around ${hhmm(base)}`;
  if (recent.length >= 3 && earlier.length >= 3) {
    const shift = Math.round(mean(recent) - mean(earlier));
    if (Math.abs(shift) >= 15) value += ` — ${Math.abs(shift)} min ${shift < 0 ? 'earlier' : 'later'} than the weeks before`;
    else value += ', steady for two months';
  }
  return { id: 'rhythms.first_activity', category: 'rhythms', label: 'First light', value, sources };
}

type Series = { id: string; weekday: number; minute: number; kept: string[]; moved: string[]; cancelled: string[]; contacts: string[] };

export function recurringSeries(cal: CalendarAggregates, tz: string, now: Date): Series[] {
  const series = new Map<string, Series>();
  const moved = new Set(cal.moves.map((m) => m.eventId));
  for (const [id, e] of Object.entries(cal.events)) {
    if (!e.r || e.a || e.d) continue;
    const slot = e.o ?? e.s;
    if (Date.parse(slot) > now.getTime()) continue;
    let s = series.get(e.r);
    if (!s) {
      s = { id: e.r, weekday: localWeekday(slot, tz), minute: localMinutes(slot, tz), kept: [], moved: [], cancelled: [], contacts: e.p };
      series.set(e.r, s);
    }
    if (e.st === 'x') s.cancelled.push(slot);
    else if (moved.has(id) || (e.o && Date.parse(e.o) !== Date.parse(e.s))) s.moved.push(slot);
    else s.kept.push(slot);
  }
  return [...series.values()];
}

function slotFacts(cal: CalendarAggregates, tz: string, now: Date): DossierFact[] {
  const all = recurringSeries(cal, tz, now);
  const facts: DossierFact[] = [];
  const label = (s: Series) => `${WEEKDAYS[s.weekday]}s at ${hhmm(s.minute)}`;

  const protectedSlot = all
    .filter((s) => s.kept.length >= 4 && s.moved.length === 0 && s.cancelled.length === 0)
    .sort((a, b) => b.kept.length - a.kept.length || a.minute - b.minute)[0];
  if (protectedSlot) {
    const since = formatShortDate(localDate([...protectedSlot.kept].sort(byTime)[0]!, tz));
    facts.push({
      id: 'rhythms.protected_time',
      category: 'rhythms',
      label: 'Protected time',
      value: `${label(protectedSlot)} — kept ${protectedSlot.kept.length} of ${protectedSlot.kept.length} since ${since}`,
      sources: ['calendar'],
    });
  }

  const fragile = all
    .map((s) => ({ s, slipped: s.moved.length + s.cancelled.length, total: s.kept.length + s.moved.length + s.cancelled.length }))
    .filter(({ slipped, total }) => slipped >= 2 && total >= 4)
    .sort((a, b) => b.slipped / b.total - a.slipped / a.total)[0];
  if (fragile) {
    facts.push({
      id: 'rhythms.slipping_slot',
      category: 'rhythms',
      label: 'The slot that slips',
      value: `${label(fragile.s)} — moved or cancelled ${fragile.slipped} of ${fragile.total} times`,
      sources: ['calendar'],
    });
  }
  return facts;
}

function busiestDayFact(cal: CalendarAggregates, tz: string, now: Date): DossierFact | null {
  const since = now.getTime() - 56 * DAY_MS;
  const weekdays = Object.values(cal.events)
    .filter((e) => attended(e, now) && Date.parse(e.s) >= since)
    .map((e) => localWeekday(e.s, tz));
  if (weekdays.length < 10) return null;
  const top = mostCommon(weekdays)!;
  const perWeek = Math.round((top.count / 8) * 10) / 10;
  return {
    id: 'rhythms.busiest_day',
    category: 'rhythms',
    label: 'Busiest day',
    value: `${WEEKDAYS[top.value]} — about ${perWeek} meetings each, over the last 8 weeks`,
    sources: ['calendar'],
  };
}

// ─── listening ─────────────────────────────────────────────────────────────

function lateNightFact(sp: SpotifyAggregates, tz: string, now: Date): DossierFact | null {
  const today = getReadingDate(now, tz);
  const cutoff = new Date(Date.parse(`${today}T12:00:00Z`) - 30 * DAY_MS).toISOString().slice(0, 10);
  const nights = Object.entries(sp.days).filter(([date, d]) => date > cutoff && d.late > 0);
  if (nights.length === 0) return null;
  const wd = mostCommon(
    nights.map(([date]) => {
      const [y, m, d] = date.split('-').map(Number) as [number, number, number];
      return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    }),
  )!;
  const mostly = nights.length >= 3 && wd.count / nights.length >= 0.5 ? `, mostly ${WEEKDAYS[wd.value]}s` : '';
  const dates = nights.map(([date]) => formatShortDate(date)).slice(-4).join(' · ');
  return {
    id: 'rhythms.late_nights',
    category: 'rhythms',
    label: 'Late nights',
    value: `Playing after 23:00 on ${plural(nights.length, 'night')} of the last 30${mostly} (${dates})`,
    sources: ['spotify'],
  };
}

function tasteFacts(sp: SpotifyAggregates): DossierFact[] {
  const safe = (name: string) => !findTaboo(name);
  const facts: DossierFact[] = [];
  const top = (sp.top?.artists ?? []).filter(safe).slice(0, 3);
  const returned = Object.entries(sp.artists)
    .filter(([name, n]) => n >= 5 && safe(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (top.length > 0) {
    facts.push({ id: 'tastes.top_artists', category: 'tastes', label: 'On repeat', value: `Lately: ${top.join(', ')}`, sources: ['spotify'] });
  }
  if (returned.length > 0) {
    facts.push({
      id: 'tastes.returns_to',
      category: 'tastes',
      label: 'Returns to',
      value: returned.map(([name, n]) => `${name} (${n} plays)`).join(' · '),
      sources: ['spotify'],
    });
  }
  return facts;
}

/** All deterministic facts, minus anything forgotten or touching a taboo topic. */
export function buildFacts(agg: DossierAggregates, timeZone: string, now: Date): DossierFact[] {
  const facts: DossierFact[] = [];
  const first = firstActivityFact(agg, timeZone, now);
  if (first) facts.push(first);
  if (agg.calendar) {
    facts.push(...slotFacts(agg.calendar, timeZone, now));
    const busiest = busiestDayFact(agg.calendar, timeZone, now);
    if (busiest) facts.push(busiest);
  }
  if (agg.spotify) {
    const late = lateNightFact(agg.spotify, timeZone, now);
    if (late) facts.push(late);
  }
  if (agg.calendar) facts.push(...peopleFacts(agg.calendar, timeZone, now));
  if (agg.spotify) facts.push(...tasteFacts(agg.spotify));
  const forgotten = new Set(agg.forgotten);
  return facts.filter((f) => !forgotten.has(f.id) && !findTaboo(`${f.label} ${f.value}`));
}
