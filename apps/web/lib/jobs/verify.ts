import { getReadingDate, type Message, type Prophecy, type User } from '@morrow/core';
import type { Repository } from '../data';
import type { DossierAggregates } from '../dossier/aggregates';
import type { CalendarEventPayload, EmailPayload, RawEvent } from '../sources/types';

export type Outcome =
  | { prophecy: Prophecy; status: 'fulfilled'; resolvedAt: string; evidence: RawEvent }
  | { prophecy: Prophecy; status: 'expired'; resolvedAt: string };

const inWindow = (p: Prophecy, at: string) => {
  const t = Date.parse(at);
  return t >= Date.parse(p.windowStart) && t <= Date.parse(p.windowEnd);
};

const sameContact = (expected: string, actual: string) =>
  expected === 'any' || expected.trim().toLowerCase() === actual.trim().toLowerCase();

/**
 * Finds the first raw event (oldest first) that satisfies the prophecy's checkCondition inside its window.
 * `listening_pattern` and `generic` need a model-based classifier and are never auto-fulfilled here.
 */
export function findEvidence(prophecy: Prophecy, events: RawEvent[]): RawEvent | null {
  const cc = prophecy.checkCondition;
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  for (const e of sorted) {
    if (!inWindow(prophecy, e.occurredAt)) continue;
    const payload = e.payload;
    switch (cc.type) {
      case 'email_from_contact': {
        if (payload.type !== 'email') continue;
        const email: EmailPayload = payload;
        if (email.direction !== 'inbound') continue;
        if (cc.contact === 'any' ? !cc.subjectIncludes : !sameContact(cc.contact, email.contact)) continue;
        if (cc.subjectIncludes && !`${email.subject ?? ''} ${email.snippet ?? ''}`.toLowerCase().includes(cc.subjectIncludes.toLowerCase())) continue;
        if (cc.firstInThread && !email.firstInThread) continue;
        return e;
      }
      case 'calendar_event_with': {
        if (payload.type !== 'calendar_event') continue;
        const event: CalendarEventPayload = payload;
        if (event.status !== 'confirmed') continue;
        // `any` + titleIncludes is a pursuit check (an interview gets booked); `any` alone means "with someone".
        const withContact =
          cc.contact === 'any' ? Boolean(cc.titleIncludes) || event.attendees.length > 0 : event.attendees.some((a) => sameContact(cc.contact, a));
        if (!withContact) continue;
        if (cc.titleIncludes && !event.title.toLowerCase().includes(cc.titleIncludes.toLowerCase())) continue;
        return e;
      }
      case 'listening_pattern':
      case 'generic':
        // TODO(verify): classify with MODELS.summary over distilled events once sources sync.
        return null;
    }
  }
  return null;
}

/**
 * Calendar events that already left raw_events (24h TTL) but are still in the aggregate index — a meeting
 * booked last week that happens inside a prophecy window still counts.
 */
export function indexedCalendarEvents(userId: string, aggregates: DossierAggregates | null, raw: RawEvent[]): RawEvent[] {
  const inRaw = new Set(raw.flatMap((e) => (e.payload.type === 'calendar_event' ? [e.payload.eventId] : [])));
  return Object.entries(aggregates?.calendar?.events ?? {})
    .filter(([id, e]) => !inRaw.has(id) && !e.a && !e.d)
    .map(([eventId, e]) => ({
      id: `idx:${eventId}`,
      userId,
      sourceKind: 'calendar' as const,
      occurredAt: e.s,
      expiresAt: e.e,
      payload: {
        type: 'calendar_event' as const,
        eventId,
        title: e.t ?? '',
        attendees: e.p,
        start: e.s,
        end: e.e,
        status: e.st === 'x' ? ('cancelled' as const) : e.st === 't' ? ('tentative' as const) : ('confirmed' as const),
        movedFrom: null,
      },
    }));
}

/** Pure verification step: which open prophecies are fulfilled or expired at `now`. */
export function verifyProphecies(prophecies: Prophecy[], events: RawEvent[], now: Date): Outcome[] {
  const outcomes: Outcome[] = [];
  for (const prophecy of prophecies) {
    if (prophecy.status !== 'open') continue;
    const evidence = findEvidence(prophecy, events);
    if (evidence && Date.parse(evidence.occurredAt) <= now.getTime()) {
      outcomes.push({ prophecy, status: 'fulfilled', resolvedAt: evidence.occurredAt, evidence });
    } else if (now.getTime() >= Date.parse(prophecy.windowEnd)) {
      outcomes.push({ prophecy, status: 'expired', resolvedAt: prophecy.windowEnd });
    }
  }
  return outcomes;
}

/**
 * Applies outcomes for one user. Fulfilled prophecies are attached to the reading of the day they
 * came true; if that reading is already open, Morrow announces it there immediately.
 */
export async function verifyUser(repo: Repository, user: User, now: Date): Promise<Outcome[]> {
  const [prophecies, raw, aggregates] = await Promise.all([repo.listProphecies(user.id), repo.listRawEvents(user.id), repo.getAggregates(user.id)]);
  if (!prophecies.some((p) => p.status === 'open')) return [];
  const events = [...raw, ...indexedCalendarEvents(user.id, aggregates, raw)];
  const outcomes = verifyProphecies(prophecies, events, now);
  for (const o of outcomes) {
    if (o.status === 'expired') {
      await repo.resolveProphecy(user.id, o.prophecy.id, { status: 'expired', resolvedAt: o.resolvedAt, fulfilledInReadingId: null });
      continue;
    }
    const localDate = getReadingDate(new Date(o.resolvedAt), user.timezone);
    const readingId = `r_${localDate}`;
    await repo.resolveProphecy(user.id, o.prophecy.id, { status: 'fulfilled', resolvedAt: o.resolvedAt, fulfilledInReadingId: readingId });
    const reading = await repo.getReadingByDate(user.id, localDate);
    if (reading?.status === 'open') {
      const announcement: Message = {
        id: `m_${localDate}_fulfilled_${o.prophecy.id}`,
        readingId,
        role: 'assistant',
        parts: [
          { type: 'prophecyRef', prophecyId: o.prophecy.id, event: 'fulfilled' },
          { type: 'text', text: `It came true, ${user.name}.` },
        ],
        createdAt: now.toISOString(),
      };
      await repo.appendMessage(user.id, announcement);
    }
  }
  return outcomes;
}

export async function runVerify(repo: Repository, now: Date) {
  const users = await repo.listUsers();
  const results = [];
  for (const user of users) {
    const outcomes = await verifyUser(repo, user, now);
    results.push({
      userId: user.id,
      fulfilled: outcomes.filter((o) => o.status === 'fulfilled').map((o) => o.prophecy.id),
      expired: outcomes.filter((o) => o.status === 'expired').map((o) => o.prophecy.id),
    });
  }
  const purged = await repo.purgeExpiredRawEvents(now);
  return { users: results, purgedRawEvents: purged };
}
