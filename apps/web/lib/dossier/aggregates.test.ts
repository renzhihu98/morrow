import { describe, expect, it } from 'vitest';
import calendarPage1 from '../sources/__fixtures__/google-calendar-events.page1.json';
import calendarPage2 from '../sources/__fixtures__/google-calendar-events.page2.json';
import recentlyPlayed from '../sources/__fixtures__/spotify-recently-played.json';
import topArtists from '../sources/__fixtures__/spotify-top-artists.json';
import topTracks from '../sources/__fixtures__/spotify-top-tracks.json';
import { contactKey, toCalendarPayload, type GoogleCalendarEvent } from '../sources/google-calendar';
import { toPlay, type SpotifyPlayHistory } from '../sources/spotify';
import type { CalendarEventPayload, TopItemsPayload } from '../sources/types';
import { calendarEventChanged, emptyAggregates, foldCalendar, foldSpotify, listeningDays, normalizeAggregates, type DossierAggregates } from './aggregates';
import { buildFacts, contactStats, recurringSeries } from './facts';

const TZ = 'America/Los_Angeles';
const NOW = new Date('2026-09-01T12:00:00-07:00');

const calendarItems = [...calendarPage1.items, ...calendarPage2.items] as GoogleCalendarEvent[];
const calendarPayloads = () => calendarItems.map((i) => toCalendarPayload(i)).filter((p): p is CalendarEventPayload => p !== null);
const plays = () => (recentlyPlayed.items as SpotifyPlayHistory[]).map(toPlay).filter((p) => p !== null);
const top: TopItemsPayload[] = [
  { type: 'top_items', itemType: 'artists', timeRange: 'short_term', items: topArtists.items.map((a) => ({ id: a.id, name: a.name })) },
  { type: 'top_items', itemType: 'tracks', timeRange: 'short_term', items: topTracks.items.map((t) => ({ id: t.id, name: t.name, artist: t.artists[0]?.name })) },
];

function fullAggregates(): DossierAggregates {
  const agg = emptyAggregates();
  agg.calendar = foldCalendar(null, calendarPayloads(), NOW);
  agg.spotify = foldSpotify(null, plays(), top, NOW);
  return agg;
}

describe('Google Calendar payload mapping (field whitelist)', () => {
  it('keeps only timing, people and status; drops self and resource attendees', () => {
    const payloads = calendarPayloads();
    expect(payloads).toHaveLength(calendarItems.length);
    const moved = payloads.find((p) => p.eventId.startsWith('4f0coffee_20260608'))!;
    expect(moved).toMatchObject({
      title: 'Coffee — Sam',
      attendees: ['sam_okafor'],
      start: '2026-06-11T09:00:00-07:00',
      originalStart: '2026-06-08T09:00:00-07:00',
      movedFrom: '2026-06-08T09:00:00-07:00',
      recurringEventId: '4f0coffee',
      selfResponse: 'accepted',
    });
    const standup = payloads.find((p) => p.title === 'Standup')!;
    expect(standup.attendees).toEqual(['dev']);
    expect(Object.keys(standup).sort()).not.toContain('description');
    const cancelled = payloads.find((p) => p.status === 'cancelled')!;
    expect(cancelled.start).toBe(cancelled.originalStart);
    expect(payloads.find((p) => p.eventId === 'allday0815')?.allDay).toBe(true);
  });

  it('derives stable contact keys', () => {
    expect(contactKey({ displayName: 'Sam Okafor', email: 'sam.okafor@studio.co' })).toBe('sam_okafor');
    expect(contactKey({ email: 'jo.anne+work@x.com' })).toBe('jo_anne_work');
    expect(contactKey({ displayName: 'Zoë' })).toBe('zoe');
    expect(contactKey({})).toBeNull();
  });
});

describe('foldCalendar', () => {
  it('counts recurring-instance moves once, even across repeated syncs', () => {
    const first = foldCalendar(null, calendarPayloads(), NOW);
    expect(first.moves.map((m) => m.from.slice(0, 10))).toEqual(['2026-06-08', '2026-07-13', '2026-08-10', '2026-08-24']);
    const again = foldCalendar(first, calendarPayloads(), new Date(NOW.getTime() + 3_600_000));
    expect(again.moves).toHaveLength(4);
    expect(again.names.sam_okafor).toBe('Sam Okafor');
  });

  it('detects a one-off event moved between syncs and flags it as changed', () => {
    const base = foldCalendar(null, calendarPayloads(), NOW);
    const dinner = calendarPayloads().find((p) => p.eventId === 'future0915')!;
    const moved = { ...dinner, start: '2026-09-17T19:30:00-07:00', end: '2026-09-17T21:00:00-07:00' };
    expect(calendarEventChanged(base.events.future0915, dinner)).toBe(false);
    expect(calendarEventChanged(base.events.future0915, moved)).toBe(true);
    const next = foldCalendar(base, [moved], NOW);
    expect(next.moves.at(-1)).toMatchObject({ eventId: 'future0915', from: '2026-09-15T19:30:00-07:00', contacts: ['sam_okafor'] });
  });

  it('keeps what it knew about an instance that later comes back cancelled without attendees', () => {
    const base = foldCalendar(null, calendarPayloads(), NOW);
    const coffee = calendarPayloads().find((p) => p.eventId.startsWith('4f0coffee_20260831'))!;
    const next = foldCalendar(base, [{ ...coffee, status: 'cancelled', attendees: [], people: [] }], NOW);
    expect(next.events[coffee.eventId]).toMatchObject({ st: 'x', p: ['sam_okafor'] });
  });

  it('prunes events older than the retention window', () => {
    const later = new Date('2027-03-01T12:00:00-08:00');
    expect(Object.keys(foldCalendar(null, calendarPayloads(), later).events).length).toBeLessThan(10);
  });
});

describe('foldSpotify', () => {
  it('buckets plays by UTC hour (timezone-free), and advances the cursor', () => {
    const agg = foldSpotify(null, plays(), top, NOW);
    expect(agg.plays).toBe(29);
    expect(Object.values(agg.hours).reduce((n, h) => n + h.count, 0)).toBe(29);
    expect(Object.keys(agg.hours).every((k) => /^\d{4}-\d\d-\d\dT\d\d$/.test(k))).toBe(true);
    expect(agg.cursorMs).toBe(Date.parse(recentlyPlayed.items[0]!.played_at));
    expect(agg.top?.artists).toEqual(['Phoebe Bridgers', 'Bon Iver', 'Frank Ocean']);

    // Polling again with the same page adds nothing (cursor dedupe).
    const again = foldSpotify(agg, plays(), null, NOW);
    expect(again.plays).toBe(29);
    expect(again.top).toEqual(agg.top);
  });

  it('derives local listening days for whatever timezone the person has now', () => {
    const agg = foldSpotify(null, plays(), top, NOW);
    const la = listeningDays(agg, TZ);
    expect(la['2026-08-23']).toMatchObject({ plays: 4, late: 4, firstMin: null });
    expect(la['2026-08-24']).toMatchObject({ plays: 3, late: 0, firstMin: 7 * 60 + 20 });
    // The same instants read in UTC: the LA late-night plays of 08.23 become a UTC morning — nothing about LA was stored.
    const utc = listeningDays(agg, 'UTC');
    expect(utc['2026-08-24']).toMatchObject({ late: 0, firstMin: 6 * 60 + 10 });
  });

  it('prunes hours older than the retention window', () => {
    const agg = foldSpotify(null, plays(), null, new Date('2026-12-01T00:00:00Z'));
    expect(Object.keys(agg.hours)).toHaveLength(0);
    expect(agg.plays).toBe(29);
  });

  it('drops v1 (timezone-baked) listening aggregates but keeps calendar and forgotten ids', () => {
    const v1 = { version: 1, forgotten: ['people.mom'], calendar: foldCalendar(null, calendarPayloads(), NOW), spotify: { cursorMs: 1, plays: 3, days: {}, artists: {}, top: null } };
    const up = normalizeAggregates(JSON.parse(JSON.stringify(v1)))!;
    expect(up).toMatchObject({ version: 2, forgotten: ['people.mom'], spotify: null });
    expect(Object.keys(up.calendar!.events).length).toBeGreaterThan(0);
    expect(normalizeAggregates(null)).toBeNull();
  });
});

describe('buildFacts', () => {
  it('produces grounded people, rhythm and taste facts', () => {
    const facts = buildFacts(fullAggregates(), TZ, NOW);
    const byId = Object.fromEntries(facts.map((f) => [f.id, f]));

    expect(byId['people.sam_okafor']).toMatchObject({
      category: 'people',
      label: 'Sam',
      value: 'Moved 4 times, mostly Mondays (06.08 · 07.13 · 08.10 · 08.24) · Met 14 times since 06.01, every 7 days or so · last 08.31',
      sources: ['calendar'],
    });
    expect(byId['people.mom']?.value).toBe('Met 6 times since 06.14, every 14 days or so · last 08.23');
    expect(byId['rhythms.protected_time']?.value).toBe('Thursday mornings — never moved or cancelled, kept 13 times since 06.04');
    expect(byId['rhythms.slipping_slot']?.value).toBe('Monday mornings — moved or cancelled 4 times out of 14');
    expect(byId['rhythms.late_nights']?.value).toBe(
      'Music playing late at night on 4 nights this past month, mostly Sundays (08.16 · 08.23 · 08.26 · 08.30)',
    );
    expect(byId['rhythms.first_activity']).toMatchObject({ label: 'First light', sources: ['calendar', 'spotify'] });
    expect(byId['rhythms.first_activity']?.value).toBe('The first thing on a weekday usually lands in the early morning, noticeably earlier than last month');
    expect(byId['rhythms.busiest_day']?.value).toBe('Thursdays are clearly the fullest day of the week, over the last two months');
    // No clock times or averages reach the model.
    for (const f of facts.filter((f) => f.category === 'rhythms')) expect(f.value).not.toMatch(/\d{1,2}:\d\d|average|min\b/);
    expect(byId['tastes.top_artists']?.value).toBe('Lately: Phoebe Bridgers, Bon Iver, Frank Ocean');

    // The declined launch party is not a meeting with Sam; all-day events never count.
    const sam = contactStats(fullAggregates().calendar!, TZ, NOW).find((s) => s.contact === 'sam_okafor')!;
    expect(sam.meetings.some((m) => m.startsWith('2026-08-19'))).toBe(false);
  });

  it('reads recurring series by their original slot', () => {
    const series = recurringSeries(fullAggregates().calendar!, TZ, NOW);
    const standup = series.find((s) => s.id === '2standup')!;
    expect({ kept: standup.kept.length, cancelled: standup.cancelled.length, weekday: standup.weekday }).toEqual({ kept: 7, cancelled: 2, weekday: 2 });
  });

  it('derives rhythms in the current timezone from the same stored aggregates', () => {
    const stored = JSON.parse(JSON.stringify(fullAggregates())) as DossierAggregates;
    const la = Object.fromEntries(buildFacts(stored, TZ, NOW).map((f) => [f.id, f.value]));
    const utc = Object.fromEntries(buildFacts(stored, 'UTC', NOW).map((f) => [f.id, f.value]));
    expect(la['rhythms.first_activity']).toMatch(/^The first thing on a weekday usually lands in the early morning/);
    expect(utc['rhythms.first_activity']).not.toBe(la['rhythms.first_activity']);
  });

  it('names artists new in rotation against the six-month list', () => {
    const agg = fullAggregates();
    agg.spotify!.top = { artists: ['Phoebe Bridgers', 'Ms Ray', 'Bon Iver'], tracks: [], settled: ['Bon Iver', 'Phoebe Bridgers'], at: NOW.toISOString() };
    expect(buildFacts(agg, TZ, NOW).find((f) => f.id === 'tastes.new_in_rotation')?.value).toMatch(/^Ms Ray — /);
    agg.spotify!.top.settled = [];
    expect(buildFacts(agg, TZ, NOW).find((f) => f.id === 'tastes.new_in_rotation')).toBeUndefined();
  });

  it('skips forgotten facts and taboo values, and survives an empty dossier', () => {
    const agg = fullAggregates();
    agg.forgotten = ['people.mom'];
    agg.spotify!.top = { artists: ['Death Cab for Cutie', 'Bon Iver'], tracks: [], at: NOW.toISOString() };
    const facts = buildFacts(agg, TZ, NOW);
    expect(facts.find((f) => f.id === 'people.mom')).toBeUndefined();
    expect(facts.find((f) => f.id === 'tastes.top_artists')?.value).toBe('Lately: Bon Iver');
    expect(buildFacts(emptyAggregates(), TZ, NOW)).toEqual([]);
  });

  it('aggregates survive the raw-event purge: facts rebuild from a JSON round-trip alone', () => {
    const stored = JSON.parse(JSON.stringify(fullAggregates())) as DossierAggregates;
    expect(buildFacts(stored, TZ, NOW)).toEqual(buildFacts(fullAggregates(), TZ, NOW));
  });
});
