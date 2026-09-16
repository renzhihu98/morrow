import { describe, expect, it } from 'vitest';
import {
  Dossier,
  DossierResponse,
  FIXTURE_NOW,
  Message,
  Prophecy,
  ProphecyListResponse,
  Reading,
  ReadingDetailResponse,
  ReadingSummary,
  ReadingsResponse,
  Source,
  SourcesResponse,
  TodayResponse,
  User,
  fixtures,
  getReadingDate,
} from '../src';

describe('fixtures parse with their schemas', () => {
  it('entities', () => {
    User.parse(fixtures.user);
    fixtures.readings.forEach((r) => Reading.parse(r));
    fixtures.readingSummaries.forEach((s) => ReadingSummary.parse(s));
    Object.values(fixtures.messages).flat().forEach((m) => Message.parse(m));
    fixtures.prophecies.forEach((p) => Prophecy.parse(p));
    fixtures.sources.forEach((s) => Source.parse(s));
    Dossier.parse(fixtures.dossier);
  });

  it('API responses', () => {
    TodayResponse.parse(fixtures.api.today);
    ReadingsResponse.parse(fixtures.api.readings);
    Object.values(fixtures.api.readingDetails).forEach((d) => ReadingDetailResponse.parse(d));
    ProphecyListResponse.parse(fixtures.api.prophecies);
    SourcesResponse.parse(fixtures.api.sources);
    DossierResponse.parse(fixtures.api.dossier);
  });
});

describe('fixture story is consistent', () => {
  it('today is 2026-09-30 for Iris', () => {
    expect(getReadingDate(FIXTURE_NOW, fixtures.user.timezone)).toBe('2026-09-30');
    expect(fixtures.api.today.reading.localDate).toBe('2026-09-30');
    expect(fixtures.api.today.questionsLeft).toBe(15);
  });

  it('record is 7 fulfilled / 3 open / 2 expired with 12 marks', () => {
    const { record } = fixtures.api.prophecies;
    expect([record.fulfilled, record.open, record.expired]).toEqual([7, 3, 2]);
    expect(record.marks).toHaveLength(12);
  });

  it('every prophecyRef resolves and 0047 is fulfilled in today', () => {
    const ids = new Set(fixtures.prophecies.map((p) => p.id));
    for (const m of Object.values(fixtures.messages).flat())
      for (const part of m.parts) if (part.type === 'prophecyRef') expect(ids.has(part.prophecyId)).toBe(true);
    const p47 = fixtures.prophecies.find((p) => p.number === 47)!;
    expect(p47.status).toBe('fulfilled');
    expect(p47.fulfilledInReadingId).toBe(fixtures.api.today.reading.id);
  });

  it('mail is watching 2 prophecies', () => {
    expect(fixtures.sources.find((s) => s.kind === 'mail')!.watchingCount).toBe(2);
  });
});
