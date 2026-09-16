import { fixtures } from '@morrow/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRepository } from '../data/memory';
import { indexedCalendarEvents, verifyProphecies } from '../jobs/verify';
import calendarPage1 from './__fixtures__/google-calendar-events.page1.json';
import calendarPage2 from './__fixtures__/google-calendar-events.page2.json';
import recentlyPlayed from './__fixtures__/spotify-recently-played.json';
import topArtists from './__fixtures__/spotify-top-artists.json';
import topTracks from './__fixtures__/spotify-top-tracks.json';
import { CALENDAR_FIELDS } from './google-calendar';
import { syncUser, type SyncDeps } from './sync';

const NOW = new Date('2026-09-01T12:00:00-07:00');
const user = fixtures.user; // America/Los_Angeles; calendar + spotify linked in the fixture story

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(overrides: { calendarStatus?: number } = {}) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: string) => {
    calls.push(input);
    const url = new URL(input);
    if (url.host === 'www.googleapis.com') {
      if (overrides.calendarStatus) return json({ error: { code: overrides.calendarStatus } }, overrides.calendarStatus);
      return json(url.searchParams.get('pageToken') ? calendarPage2 : calendarPage1);
    }
    if (url.pathname === '/v1/me/player/recently-played') {
      return json(url.searchParams.get('after') ? { items: [], next: null, cursors: null } : recentlyPlayed);
    }
    if (url.pathname === '/v1/me/top/artists') return json(topArtists);
    if (url.pathname === '/v1/me/top/tracks') return json(topTracks);
    return json({}, 404);
  });
  return { fetch, calls };
}

beforeEach(() => {
  vi.stubEnv('AI_GATEWAY_API_KEY', '');
  vi.stubEnv('VERCEL_OIDC_TOKEN', '');
});

describe('syncUser', () => {
  it('syncs Calendar (paginated, whitelisted fields) and Spotify, stores stats, and rebuilds the dossier', async () => {
    const repo = createMemoryRepository();
    const { fetch, calls } = fakeFetch();
    const deps: SyncDeps = { getAccessToken: async () => 'token', fetch };

    const results = await syncUser(repo, user, NOW, { deps });
    expect(results.map((r) => [r.kind, r.ok])).toEqual([
      ['calendar', true],
      ['spotify', true],
    ]);

    const calendarCalls = calls.filter((c) => c.includes('googleapis'));
    expect(calendarCalls).toHaveLength(2);
    const first = new URL(calendarCalls[0]!);
    expect(first.searchParams.get('singleEvents')).toBe('true');
    expect(first.searchParams.get('fields')).toBe(CALENDAR_FIELDS);
    expect(new URL(calendarCalls[1]!).searchParams.get('pageToken')).toBe(calendarPage1.nextPageToken);
    expect(Date.parse(first.searchParams.get('timeMin')!)).toBe(NOW.getTime() - 90 * 86_400_000);

    expect(await repo.getSourceState(user.id, 'calendar')).toMatchObject({ syncState: 'ok', eventCount: 45, lastSyncedAt: NOW.toISOString() });
    const spotify = await repo.getSourceState(user.id, 'spotify');
    expect(spotify).toMatchObject({ syncState: 'ok', eventCount: 29, cursor: String(Date.parse(recentlyPlayed.items[0]!.played_at)) });

    const raw = await repo.listRawEvents(user.id);
    expect(raw.every((e) => Date.parse(e.expiresAt) === NOW.getTime() + 24 * 3_600_000)).toBe(true);
    expect(raw.filter((e) => e.sourceKind === 'calendar')).toHaveLength(47);

    const dossier = await repo.getDossier(user.id);
    expect(dossier?.facts.map((f) => f.id)).toContain('people.sam_okafor');
    expect(dossier?.facts.map((f) => f.id)).toContain('rhythms.late_nights');
    expect((await repo.getAggregates(user.id))?.calendar?.moves).toHaveLength(4);

    // Hourly poll: Spotify asks with the `after` cursor; unchanged calendar events are not re-stored raw.
    calls.length = 0;
    await repo.purgeExpiredRawEvents(new Date(NOW.getTime() + 25 * 3_600_000));
    await syncUser(repo, user, new Date(NOW.getTime() + 3_600_000), { deps });
    expect(calls.find((c) => c.includes('recently-played'))).toContain(`after=${spotify?.cursor}`);
    expect((await repo.listRawEvents(user.id)).filter((e) => e.sourceKind === 'calendar')).toHaveLength(0);
    expect((await repo.getAggregates(user.id))?.spotify?.plays).toBe(29);
  });

  it('marks a source needs_reauth when the provider rejects the grant, and skips it next time', async () => {
    const repo = createMemoryRepository();
    const { fetch } = fakeFetch({ calendarStatus: 401 });
    const results = await syncUser(repo, user, NOW, { deps: { getAccessToken: async () => 'expired', fetch } });
    expect(results[0]).toMatchObject({ kind: 'calendar', ok: false, state: 'needs_reauth' });
    expect(results[1]).toMatchObject({ kind: 'spotify', ok: true });
    expect(await repo.getSourceState(user.id, 'calendar')).toMatchObject({ syncState: 'needs_reauth' });
  });

  it('treats a failed token refresh as needs_reauth', async () => {
    const repo = createMemoryRepository();
    const { SourceAuthError } = await import('./errors');
    const results = await syncUser(repo, user, NOW, {
      kinds: ['spotify'],
      deps: {
        getAccessToken: async () => {
          throw new SourceAuthError('invalid_grant');
        },
        fetch: fakeFetch().fetch,
      },
    });
    expect(results).toEqual([{ kind: 'spotify', ok: false, state: 'needs_reauth', error: 'invalid_grant' }]);
  });
});

describe('verification over the calendar index', () => {
  it('fulfils calendar_event_with from indexed events after raw events were purged', async () => {
    const repo = createMemoryRepository();
    await syncUser(repo, user, NOW, { deps: { getAccessToken: async () => 'token', fetch: fakeFetch().fetch }, kinds: ['calendar'] });
    await repo.purgeExpiredRawEvents(new Date(NOW.getTime() + 25 * 3_600_000));
    const raw = await repo.listRawEvents(user.id);
    const events = [...raw, ...indexedCalendarEvents(user.id, await repo.getAggregates(user.id), raw)];
    const [outcome] = verifyProphecies(
      [
        {
          ...fixtures.prophecies[0]!,
          status: 'open',
          checkCondition: { type: 'calendar_event_with', contact: 'sam_okafor', titleIncludes: 'dinner' },
          windowStart: '2026-09-02T00:00:00-07:00',
          windowEnd: '2026-09-20T00:00:00-07:00',
          resolvedAt: null,
        },
      ],
      events,
      new Date('2026-09-16T08:00:00-07:00'),
    );
    expect(outcome).toMatchObject({ status: 'fulfilled', resolvedAt: '2026-09-15T19:30:00-07:00' });
  });
});
