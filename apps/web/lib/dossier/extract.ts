/**
 * Raw-event extractors (no LLM) for window-based analysis — reschedules and mail cadence over a list of
 * raw events. The live pipeline folds sync results into aggregates (aggregates.ts → facts.ts); these stay for
 * Gmail (v0.3) and for ad-hoc analysis in tests.
 */
import { formatShortDate, getLocalParts, getReadingDate, type Dossier, type DossierFact, type SourceKind } from '@morrow/core';
import type { CalendarEventPayload, EmailPayload, RawEvent } from '../sources/types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 86_400_000;

const capitalize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function localWeekday(iso: string, timeZone: string): number {
  const { year, month, day } = getLocalParts(new Date(iso), timeZone);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function mostCommon<T>(items: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const [k, n] of counts) if (n > bestCount) [best, bestCount] = [k, n];
  return best;
}

export type RescheduleStat = {
  contact: string;
  count: number;
  /** Local dates (YYYY-MM-DD) of the original slots that were moved. */
  movedDates: string[];
  /** Most common weekday of the original slots, e.g. "Monday". */
  usualWeekday: string | null;
};

/** How many times meetings with each contact were moved (an event counts once per move). */
export function countReschedules(events: RawEvent[], timeZone: string): RescheduleStat[] {
  const byContact = new Map<string, string[]>();
  for (const e of events) {
    if (e.payload.type !== 'calendar_event') continue;
    const cal: CalendarEventPayload = e.payload;
    if (!cal.movedFrom) continue;
    for (const contact of cal.attendees) {
      const list = byContact.get(contact) ?? [];
      list.push(cal.movedFrom);
      byContact.set(contact, list);
    }
  }
  return [...byContact.entries()]
    .map(([contact, moved]) => {
      const sorted = [...moved].sort();
      const weekday = mostCommon(sorted.map((m) => localWeekday(m, timeZone)));
      return {
        contact,
        count: sorted.length,
        movedDates: sorted.map((m) => getReadingDate(new Date(m), timeZone, 0)),
        usualWeekday: weekday === undefined ? null : WEEKDAYS[weekday]!,
      };
    })
    .sort((a, b) => b.count - a.count || a.contact.localeCompare(b.contact));
}

export type CadenceStat = {
  contact: string;
  /** Inbound messages considered. */
  messages: number;
  /** Mean days between inbound messages (rounded), null with fewer than two messages. */
  everyDays: number | null;
  usualWeekday: string | null;
  /** Share of threads the contact started (0–1). */
  writesFirst: number;
};

/** How often each contact writes, on which weekday, and how often they start the thread. */
export function contactCadence(events: RawEvent[], timeZone: string): CadenceStat[] {
  const byContact = new Map<string, { at: string; email: EmailPayload }[]>();
  for (const e of events) {
    if (e.payload.type !== 'email' || e.payload.direction !== 'inbound') continue;
    const list = byContact.get(e.payload.contact) ?? [];
    list.push({ at: e.occurredAt, email: e.payload });
    byContact.set(e.payload.contact, list);
  }
  return [...byContact.entries()]
    .map(([contact, list]) => {
      const sorted = list.sort((a, b) => a.at.localeCompare(b.at));
      const gaps = sorted.slice(1).map((m, i) => (Date.parse(m.at) - Date.parse(sorted[i]!.at)) / DAY_MS);
      const everyDays = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;
      const weekday = mostCommon(sorted.map((m) => localWeekday(m.at, timeZone)));
      const threads = new Map<string, boolean>();
      for (const { email } of sorted) threads.set(email.threadId, (threads.get(email.threadId) ?? false) || email.firstInThread);
      const started = [...threads.values()].filter(Boolean).length;
      return {
        contact,
        messages: sorted.length,
        everyDays,
        usualWeekday: weekday === undefined ? null : WEEKDAYS[weekday]!,
        writesFirst: threads.size ? started / threads.size : 0,
      };
    })
    .sort((a, b) => b.messages - a.messages || a.contact.localeCompare(b.contact));
}

/** Turns extractor stats into `people.*` dossier facts in the dossier's voice. */
export function extractFacts(events: RawEvent[], timeZone: string): DossierFact[] {
  const facts = new Map<string, DossierFact>();
  const upsert = (contact: string, value: string, sources: SourceKind[]) => {
    const id = `people.${contact}`;
    const prev = facts.get(id);
    facts.set(id, {
      id,
      category: 'people',
      label: capitalize(contact),
      value: prev ? `${prev.value} · ${value}` : value,
      sources: [...new Set([...(prev?.sources ?? []), ...sources])],
    });
  };

  for (const r of countReschedules(events, timeZone)) {
    if (r.count < 2) continue;
    const dates = r.movedDates.map(formatShortDate).join(' · ');
    upsert(r.contact, `Moved ${r.count} times${r.usualWeekday ? `, mostly ${r.usualWeekday}s` : ''} (${dates})`, ['calendar']);
  }
  for (const c of contactCadence(events, timeZone)) {
    if (c.everyDays === null) continue;
    const when = c.usualWeekday ? `, usually ${c.usualWeekday}` : '';
    upsert(c.contact, `Every ${c.everyDays} days or so${when}`, ['mail']);
  }
  return [...facts.values()];
}

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

/** Merges freshly extracted facts into a dossier (same id → replaced). */
export function mergeDossier(existing: Dossier | null, userId: string, facts: DossierFact[], now: Date): Dossier {
  const byId = new Map((existing?.facts ?? []).map((f) => [f.id, f]));
  for (const f of facts) byId.set(f.id, f);
  const merged = { facts: [...byId.values()], patterns: existing?.patterns ?? [] };
  return { userId, ...merged, sizeBytes: bytes(merged), rebuiltAt: now.toISOString() };
}
