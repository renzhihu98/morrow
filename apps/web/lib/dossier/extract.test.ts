import { describe, expect, it } from 'vitest';
import type { RawEvent } from '../sources/types';
import { contactCadence, countReschedules, extractFacts, mergeDossier } from './extract';

const TZ = 'America/Los_Angeles';
let n = 0;
const base = { userId: 'u_iris', expiresAt: '2026-10-01T00:00:00Z' };

const coffee = (movedFrom: string | null, start: string, attendees = ['sam']): RawEvent => ({
  ...base,
  id: `e${++n}`,
  sourceKind: 'calendar',
  occurredAt: start,
  payload: { type: 'calendar_event', eventId: `c${n}`, title: 'Coffee', attendees, start, end: start, status: 'confirmed', movedFrom },
});

const email = (contact: string, at: string, threadId: string, firstInThread = true, direction: 'inbound' | 'outbound' = 'inbound'): RawEvent => ({
  ...base,
  id: `m${++n}`,
  sourceKind: 'mail',
  occurredAt: at,
  payload: { type: 'email', threadId, contact, direction, firstInThread },
});

describe('countReschedules', () => {
  it('counts moves per contact with dates and usual weekday', () => {
    // Four Monday-morning coffees with Sam, each moved (local times, PDT/PST).
    const events = [
      coffee('2026-03-02T09:00:00-08:00', '2026-03-05T09:00:00-08:00'),
      coffee('2026-04-20T09:00:00-07:00', '2026-04-23T09:00:00-07:00'),
      coffee('2026-06-08T09:00:00-07:00', '2026-06-11T09:00:00-07:00'),
      coffee('2026-08-24T09:00:00-07:00', '2026-08-27T09:00:00-07:00'),
      coffee(null, '2026-09-03T09:00:00-07:00'),
      coffee('2026-09-01T18:00:00-07:00', '2026-09-02T18:00:00-07:00', ['mom']),
    ];
    const stats = countReschedules(events, TZ);
    expect(stats[0]).toEqual({
      contact: 'sam',
      count: 4,
      movedDates: ['2026-03-02', '2026-04-20', '2026-06-08', '2026-08-24'],
      usualWeekday: 'Monday',
    });
    expect(stats[1]).toMatchObject({ contact: 'mom', count: 1, usualWeekday: 'Tuesday' });
  });

  it('uses the local weekday, not UTC', () => {
    // 18:30 Sunday in LA is already Monday in UTC.
    const [stat] = countReschedules([coffee('2026-09-13T18:30:00-07:00', '2026-09-14T09:00:00-07:00')], TZ);
    expect(stat?.usualWeekday).toBe('Sunday');
  });

  it('ignores non-calendar events and unmoved events', () => {
    expect(countReschedules([email('sam', '2026-09-30T08:47:00-07:00', 't1'), coffee(null, '2026-09-01T09:00:00-07:00')], TZ)).toEqual([]);
  });
});

describe('contactCadence', () => {
  it('computes mean gap, weekday and who writes first from inbound mail only', () => {
    const events = [
      email('mom', '2026-08-30T10:00:00-07:00', 't1'), // Sunday
      email('mom', '2026-09-08T10:00:00-07:00', 't2', false), // Tuesday, replies to Iris
      email('mom', '2026-09-13T10:00:00-07:00', 't3'), // Sunday
      email('mom', '2026-09-27T10:00:00-07:00', 't4'), // Sunday
      email('mom', '2026-09-20T10:00:00-07:00', 't9', true, 'outbound'),
    ];
    const [mom] = contactCadence(events, TZ);
    expect(mom).toEqual({ contact: 'mom', messages: 4, everyDays: 9, usualWeekday: 'Sunday', writesFirst: 0.75 });
  });

  it('returns null cadence for a single message', () => {
    expect(contactCadence([email('sam', '2026-09-30T08:47:00-07:00', 't1')], TZ)[0]?.everyDays).toBeNull();
  });
});

describe('extractFacts + mergeDossier', () => {
  it('produces people facts and replaces facts with the same id', () => {
    const events = [
      coffee('2026-03-02T09:00:00-08:00', '2026-03-05T09:00:00-08:00'),
      coffee('2026-04-20T09:00:00-07:00', '2026-04-23T09:00:00-07:00'),
      email('sam', '2026-09-20T08:00:00-07:00', 't1'),
      email('sam', '2026-09-30T08:47:00-07:00', 't2'),
    ];
    const facts = extractFacts(events, TZ);
    expect(facts).toEqual([
      {
        id: 'people.sam',
        category: 'people',
        label: 'Sam',
        value: 'Moved 2 times, mostly Mondays (03.02 · 04.20) · Every 10 days or so, usually Sunday',
        sources: ['calendar', 'mail'],
      },
    ]);

    const now = new Date('2026-09-30T11:00:00Z');
    const merged = mergeDossier(
      {
        userId: 'u_iris',
        sizeBytes: 0,
        rebuiltAt: '2026-09-29T11:00:00Z',
        facts: [
          { id: 'people.sam', category: 'people', label: 'Sam', value: 'old', sources: ['calendar'] },
          { id: 'rhythms.first_light', category: 'rhythms', label: 'First light', value: '06:10', sources: ['calendar'] },
        ],
        patterns: [],
      },
      'u_iris',
      facts,
      now,
    );
    expect(merged.facts.map((f) => f.id)).toEqual(['people.sam', 'rhythms.first_light']);
    expect(merged.facts[0]?.value).toContain('Moved 2 times');
    expect(merged.rebuiltAt).toBe(now.toISOString());
    expect(merged.sizeBytes).toBeGreaterThan(0);
  });
});
