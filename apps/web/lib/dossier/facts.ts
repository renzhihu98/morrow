/**
 * Deterministic dossier facts from aggregates (no LLM). Every fact id is a stable evidence ref
 * (`people.sam`, `rhythms.protected_time`, …) that readings must cite; values carry the dates behind them.
 */
import { formatShortDate, getLocalParts, getReadingDate, type DossierFact, type SourceKind } from '@morrow/core';
import { findTaboo } from '../ai/taboo';
import { listeningDays, type CalendarAggregates, type CalendarEventState, type DossierAggregates, type SpotifyAggregates } from './aggregates';
import { mailPeopleFacts, mailRhythmFacts } from './mail';
import { pursuitFacts } from './pursuits';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_PEOPLE = 6;

/**
 * Human part of the day for minutes since local midnight. Facts feed readings, and Morrow speaks about
 * mornings and evenings, not clock times.
 */
export function partOfDay(min: number): string {
  if (min < 6 * 60) return 'before dawn';
  if (min < 7 * 60 + 30) return 'early morning';
  if (min < 9 * 60 + 30) return 'morning';
  if (min < 11 * 60 + 30) return 'late morning';
  if (min < 13 * 60 + 30) return 'around midday';
  if (min < 17 * 60) return 'afternoon';
  if (min < 21 * 60) return 'evening';
  return 'night';
}

const slotPart = (min: number) => {
  const part = partOfDay(min);
  return part === 'early morning' || part === 'late morning' ? 'morning' : part === 'around midday' ? 'lunchtime' : part;
};


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

/** The user's own time: attended and not a copy on someone else's (read-only) calendar. */
const ownTime = (e: CalendarEventState, now: Date) => attended(e, now) && !e.sh;

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
      // The dossier is evidence, but it should still read like something noticed, not a row of counts.
      const parts: string[] = [];
      if (s.meetings.length >= 2) {
        const since = formatShortDate(localDate(s.meetings[0]!, tz));
        parts.push(
          s.everyDays
            ? `You make room for them about every ${s.everyDays} days, and have since ${since} (${s.meetings.length} times)`
            : `You have made room for them ${s.meetings.length} times since ${since}`,
        );
      }
      if (s.moves.length >= 2) {
        const dates = s.moves.slice(-3).map((m) => formatShortDate(localDate(m, tz)));
        parts.push(
          `${parts.length > 0 ? 'and it' : 'It'} keeps moving rather than being dropped — ${s.moves.length} times${s.usualMoveWeekday ? `, usually away from a ${s.usualMoveWeekday}` : ''} (${dates.join(' · ')})`,
        );
      }
      const last = s.meetings.at(-1);
      if (last) parts.push(`last together ${formatShortDate(localDate(last, tz))}`);
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
    if (!ownTime(e, now)) continue;
    const date = localDate(e.s, tz);
    const wd = localWeekday(e.s, tz);
    if (wd === 0 || wd === 6) continue;
    note(date, localMinutes(e.s, tz), 'calendar');
  }
  for (const [date, day] of Object.entries(agg.spotify ? listeningDays(agg.spotify, tz) : {})) {
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
  const part = partOfDay(base);
  let value = `The first thing on a weekday usually lands ${part === 'around midday' ? part : part === 'before dawn' ? 'before dawn' : `in the ${part}`}`;
  if (recent.length >= 3 && earlier.length >= 3) {
    const shift = Math.round(mean(recent) - mean(earlier));
    const direction = shift < 0 ? 'earlier' : 'later';
    if (Math.abs(shift) >= 45) value += `, noticeably ${direction} than last month`;
    else if (Math.abs(shift) >= 15) value += `, a little ${direction} than last month`;
    else value += ', steady for two months';
  }
  return { id: 'rhythms.first_activity', category: 'rhythms', label: 'First light', value, sources };
}

type Series = { id: string; weekday: number; minute: number; kept: string[]; moved: string[]; cancelled: string[]; contacts: string[] };

export function recurringSeries(cal: CalendarAggregates, tz: string, now: Date): Series[] {
  const series = new Map<string, Series>();
  const moved = new Set(cal.moves.map((m) => m.eventId));
  for (const [id, e] of Object.entries(cal.events)) {
    if (!e.r || e.a || e.d || e.sh) continue;
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
  const label = (s: Series) => `${WEEKDAYS[s.weekday]} ${slotPart(s.minute)}s`;

  const protectedSlot = all
    .filter((s) => s.kept.length >= 4 && s.moved.length === 0 && s.cancelled.length === 0)
    .sort((a, b) => b.kept.length - a.kept.length || a.minute - b.minute)[0];
  if (protectedSlot) {
    const since = formatShortDate(localDate([...protectedSlot.kept].sort(byTime)[0]!, tz));
    facts.push({
      id: 'rhythms.protected_time',
      category: 'rhythms',
      label: 'Protected time',
      value: `${label(protectedSlot)} — never moved or cancelled, kept ${protectedSlot.kept.length} times since ${since}`,
      sources: ['calendar'],
    });
  }

  // Two different series can sit in the same weekday slot; naming both "Wednesday evenings" would read as a
  // contradiction ("never moved" and "always moves"), so the slipping one has to be a different slot.
  const fragile = all
    .map((s) => ({ s, slipped: s.moved.length + s.cancelled.length, total: s.kept.length + s.moved.length + s.cancelled.length }))
    .filter(({ s, slipped, total }) => slipped >= 2 && total >= 4 && (!protectedSlot || label(s) !== label(protectedSlot)))
    .sort((a, b) => b.slipped / b.total - a.slipped / a.total)[0];
  if (fragile) {
    facts.push({
      id: 'rhythms.slipping_slot',
      category: 'rhythms',
      label: 'The slot that slips',
      value: `${label(fragile.s)} — moved or cancelled ${fragile.slipped} times out of ${fragile.total}`,
      sources: ['calendar'],
    });
  }
  return facts;
}

function busiestDayFact(cal: CalendarAggregates, tz: string, now: Date): DossierFact | null {
  const since = now.getTime() - 56 * DAY_MS;
  const weekdays = Object.values(cal.events)
    .filter((e) => ownTime(e, now) && Date.parse(e.s) >= since)
    .map((e) => localWeekday(e.s, tz));
  if (weekdays.length < 10) return null;
  const top = mostCommon(weekdays)!;
  const second = [...new Set(weekdays)].filter((d) => d !== top.value).map((d) => weekdays.filter((w) => w === d).length);
  const clear = second.length === 0 || top.count >= Math.max(...second) * 1.5;
  return {
    id: 'rhythms.busiest_day',
    category: 'rhythms',
    label: 'Busiest day',
    value: `${WEEKDAYS[top.value]}s ${clear ? 'are clearly the fullest day of the week' : 'are usually the fullest day, but only just'}, over the last two months`,
    sources: ['calendar'],
  };
}

// ─── listening ─────────────────────────────────────────────────────────────

function lateNightFact(sp: SpotifyAggregates, tz: string, now: Date): DossierFact | null {
  const today = getReadingDate(now, tz);
  const cutoff = new Date(Date.parse(`${today}T12:00:00Z`) - 30 * DAY_MS).toISOString().slice(0, 10);
  const nights = Object.entries(listeningDays(sp, tz))
    .filter(([date, d]) => date > cutoff && d.late > 0)
    .sort(([a], [b]) => a.localeCompare(b));
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
    value: `Music playing late at night on ${nights.length} ${nights.length === 1 ? 'night' : 'nights'} this past month${mostly} (${dates})`,
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
  const settled = new Set((sp.top?.settled ?? []).map((a) => a.toLowerCase()));
  const fresh = settled.size > 0 ? (sp.top?.artists ?? []).filter((a) => safe(a) && !settled.has(a.toLowerCase())).slice(0, 3) : [];
  if (fresh.length > 0) {
    facts.push({
      id: 'tastes.new_in_rotation',
      category: 'tastes',
      label: 'New in rotation',
      value: `${fresh.join(', ')} — in this month's heavy rotation, but not among your artists of the last six months`,
      sources: ['spotify'],
    });
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
  facts.push(...mailRhythmFacts(agg.mail, timeZone, now));
  facts.push(...pursuitFacts(agg.calendar, agg.pursuits, timeZone, now, agg.mail));
  if (agg.calendar) facts.push(...peopleFacts(agg.calendar, timeZone, now));
  facts.push(...mailPeopleFacts(agg.mail, timeZone, now));
  if (agg.spotify) facts.push(...tasteFacts(agg.spotify));
  const forgotten = new Set(agg.forgotten);
  return mergeById(facts).filter((f) => !forgotten.has(f.id) && !findTaboo(`${f.label} ${f.value}`));
}

/** The same person seen in Calendar and Mail becomes one fact with both sources. */
function mergeById(facts: DossierFact[]): DossierFact[] {
  const byId = new Map<string, DossierFact>();
  for (const f of facts) {
    const seen = byId.get(f.id);
    byId.set(f.id, seen ? { ...seen, value: `${seen.value} · ${f.value}`, sources: [...new Set([...seen.sources, ...f.sources])] } : f);
  }
  return [...byId.values()];
}
