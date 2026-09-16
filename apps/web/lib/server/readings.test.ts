import {
  FIXTURE_NOW,
  ProphecyListResponse,
  ReadingDetailResponse,
  ReadingsResponse,
  SourcesResponse,
  TodayResponse,
  fixtures,
} from '@morrow/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRepository } from '../data/memory';
import {
  getProphecyListView,
  getReadingDetailView,
  getReadingsView,
  getSourcesView,
  getTodayView,
} from './readings';
import { readingDayEnd } from './time';

beforeEach(() => {
  vi.stubEnv('AI_GATEWAY_API_KEY', '');
  vi.stubEnv('VERCEL_OIDC_TOKEN', '');
});

describe('views over the memory repository (demo mode)', () => {
  it('match the shared API schemas and the fixture story', async () => {
    const repo = createMemoryRepository();
    const today = TodayResponse.parse(await getTodayView(repo, FIXTURE_NOW));
    expect(today.reading.id).toBe('r_2026-09-30');
    expect(today.prophecies.map((p) => p.id)).toEqual(['p_0047', 'p_0052']);
    expect(today.questionsLeft).toBe(15);

    const readings = ReadingsResponse.parse(await getReadingsView(repo, FIXTURE_NOW));
    expect(readings.total).toBe(fixtures.readingsTotal);

    const detail = ReadingDetailResponse.parse(await getReadingDetailView(repo, FIXTURE_NOW, '2026-09-16'));
    expect(detail.messages).toHaveLength(4);

    const prophecies = ProphecyListResponse.parse(await getProphecyListView(repo));
    expect(prophecies.record).toMatchObject({ fulfilled: 7, open: 3, expired: 2 });

    SourcesResponse.parse(await getSourcesView(repo));
  });

  it('seals yesterday and opens a new reading with a prophecy after the 04:00 boundary', async () => {
    const repo = createMemoryRepository();
    const nextDawn = new Date(readingDayEnd('2026-09-30', fixtures.timezone).getTime() + 60_000); // 10.01 04:01
    const today = TodayResponse.parse(await getTodayView(repo, nextDawn));

    expect(today.reading).toMatchObject({ id: 'r_2026-10-01', localDate: '2026-10-01', status: 'open', questionCount: 0 });
    expect(today.messages[0]?.parts[0]?.type).toBe('observation');
    expect(today.prophecies.map((p) => p.id)).toEqual(['p_0053']);

    const sealed = await repo.getReadingByDate(fixtures.user.id, '2026-09-30');
    expect(sealed?.status).toBe('sealed');
    expect(sealed?.summary).toBeTruthy();
    expect(sealed?.sealedAt).toBe(readingDayEnd('2026-09-30', fixtures.timezone).toISOString());

    // Idempotent: a second call returns the same reading, no second prophecy.
    await getTodayView(repo, nextDawn);
    expect((await repo.listProphecies(fixtures.user.id)).filter((p) => p.madeOn === '2026-10-01')).toHaveLength(1);
  });

  it('enforces the question limit and rejects sealed readings', async () => {
    const repo = createMemoryRepository();
    const user = fixtures.user;
    for (let i = 0; i < 15; i++) expect((await repo.reserveQuestion(user.id, 'r_2026-09-30', 15)).ok).toBe(true);
    expect(await repo.reserveQuestion(user.id, 'r_2026-09-30', 15)).toEqual({ ok: false, reason: 'limit' });
    expect(await repo.reserveQuestion(user.id, 'r_2026-09-16', 15)).toEqual({ ok: false, reason: 'sealed' });
  });
});
