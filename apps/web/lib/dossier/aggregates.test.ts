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
      value:
        'You make room for them about every 7 days, and have since 06.01 (14 times) · and it keeps moving rather than being dropped — 4 times, usually away from a Monday (07.13 · 08.10 · 08.24) · last together 08.31',
      sources: ['calendar'],
    });
    expect(byId['people.mom']?.value).toBe('You make room for them about every 14 days, and have since 06.14 (6 times) · last together 08.23');
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

describe('pursuits and calendar search', async () => {
  const { pursuitFacts } = await import('./pursuits');
  const { searchCalendar } = await import('./calendar-search');
  const day = (n: number, hour = 10) => new Date(NOW.getTime() + n * 86_400_000 + (hour - 12) * 3_600_000).toISOString();
  const event = (id: string, n: number, title: string, extra: Partial<CalendarEventPayload> = {}): CalendarEventPayload => ({
    type: 'calendar_event',
    eventId: id,
    title,
    attendees: [],
    start: day(n),
    end: day(n, 11),
    status: 'confirmed',
    movedFrom: null,
    calendarId: 'jobs@group.calendar.google.com',
    calendarName: 'Job search',
    accessRole: 'owner',
    selfInvolved: true,
    ...extra,
  });
  const cal = foldCalendar(
    null,
    [
      event('a', -40, 'Application sent'),
      event('b', -10, 'Recruiter call'),
      event('c', -5, 'Portfolio review', { details: 'Bring the case study' }),
      event('d', -3, 'Recruiter call'),
      event('e', 4, 'Final interview', { location: 'Studio, 2nd floor' }),
      event('f', -2, 'Dentist'),
    ],
    NOW,
  );
  const index = {
    pursuits: [{ key: 'job_search', label: 'Job search', summary: 'applications, recruiter calls and interviews' }],
    titles: { 'application sent': 'job_search', 'recruiter call': 'job_search', 'portfolio review': 'job_search', 'final interview': 'job_search', dentist: null },
    at: NOW.toISOString(),
  };

  it('keeps calendar names, details and locations on own events', () => {
    expect(cal.calendars).toEqual({ 'jobs@group.calendar.google.com': 'Job search' });
    expect(cal.events.e).toMatchObject({ t: 'Final interview', l: 'Studio, 2nd floor', k: 'jobs@group.calendar.google.com' });
  });

  it('builds a pursuit fact with momentum and what is ahead', () => {
    const [fact] = pursuitFacts(cal, index, TZ, NOW);
    expect(fact).toMatchObject({ id: 'pursuits.job_search', category: 'pursuits', label: 'Job search', sources: ['calendar'] });
    expect(fact!.value).toContain('(4 on the calendar)');
    expect(fact!.value).toContain('picking up');
    expect(fact!.value).toContain('The next step is already set for 09.05');
  });

  it('searches by pursuit and words, and hides taboo events', () => {
    expect(searchCalendar(cal, index, { pursuit: 'job_search', when: 'upcoming' }, TZ, NOW).events.map((e) => e.title)).toEqual(['Final interview']);
    const found = searchCalendar(cal, index, { query: 'case study', when: 'past' }, TZ, NOW);
    expect(found.events[0]).toMatchObject({ title: 'Portfolio review', calendar: 'Job search', partOfDay: 'late morning' });
    expect(searchCalendar(cal, index, { query: null, when: 'all' }, TZ, NOW).events.map((e) => e.title)).not.toContain('Dentist');
  });
});

describe('mail facts and search', async () => {
  const { foldMail, mailPeopleFacts, mailRhythmFacts, threadInputs } = await import('./mail');
  const { searchMail } = await import('./mail-search');
  const at = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
  const msg = (id: string, th: string, n: number, dir: 'inbound' | 'outbound', extra: Record<string, unknown> = {}) => ({
    type: 'email' as const, messageId: id, threadId: th, contact: 'sam_okafor', direction: dir, firstInThread: id === th,
    people: [{ key: 'sam_okafor', email: 'sam@studio.co', displayName: 'Sam Okafor' }], subject: `Subject ${th}`, snippet: '', body: `body ${id}`, sentAt: at(n), ...extra,
  });
  const messages = [msg('a', 'a', -10, 'inbound'), msg('b', 'a', -9, 'outbound'), msg('c', 'c', -3, 'inbound'), msg('d', 'd', -2, 'outbound', { subject: 'Therapy notes' })];
  const notes = new Map([
    ['a', { note: 'Sam asked about a second interview; you said Thursday works.', kind: 'pursuit' as const, status: 'waiting_on_them' as const }],
    ['c', { note: 'Sam sent the offer details and asked for a call.', kind: 'pursuit' as const, status: 'waiting_on_you' as const }],
  ]);
  const mail = foldMail(null, messages, notes, NOW);
  const index = { pursuits: [{ key: 'job_search', label: 'Job search', summary: 'interviews' }], titles: {}, threads: { a: 'job_search', c: 'job_search' }, at: NOW.toISOString() };

  it('keeps timing, people and notes but never bodies', () => {
    expect(JSON.stringify(mail)).not.toContain('body a');
    expect(mail.threads.a).toMatchObject({ s: 'Subject a', n: notes.get('a')!.note, st: 'waiting_on_them' });
    expect(mail.cursorMs).toBe(Date.parse(at(-2)));
  });

  it('never sends taboo threads to the note writer, and skips threads already noted', () => {
    expect(threadInputs(messages, null).map((t) => t.threadId)).toEqual(['c', 'a']);
    expect(threadInputs(messages.slice(0, 2), mail)).toEqual([]);
  });

  it('builds people and waiting facts', () => {
    const [person] = mailPeopleFacts(mail, TZ, NOW);
    expect(person).toMatchObject({ id: 'people.sam_okafor', label: 'Sam', sources: ['mail'] });
    expect(person!.value).toContain('3 threads');
    expect(mailRhythmFacts(mail, TZ, NOW).map((f) => f.id)).toEqual(['rhythms.mail_unanswered', 'rhythms.mail_waiting']);
  });

  it('merges calendar and mail into one pursuit fact', async () => {
    const { pursuitFacts } = await import('./pursuits');
    const [fact] = pursuitFacts(null, index, TZ, NOW, mail);
    expect(fact).toMatchObject({ id: 'pursuits.job_search', sources: ['mail'] });
    expect(fact!.value).toContain('2 by mail');
    expect(fact!.value).toContain('One answer has not come back yet');
  });

  it('searches threads by pursuit, person and words', () => {
    expect(searchMail(mail, index, { pursuit: 'job_search', when: 'all' }, TZ, NOW).threads.map((t) => t.subject)).toEqual(['Subject c', 'Subject a']);
    expect(searchMail(mail, index, { query: 'offer', when: 'last_week' }, TZ, NOW).threads[0]).toMatchObject({ subject: 'Subject c', youWroteLast: false, status: 'waiting_on_you' });
    expect(searchMail(mail, index, { contact: 'sam', when: 'all' }, TZ, NOW).total).toBe(2); // the taboo thread never comes back
  });
});
