import {
  getReadingDate,
  isReadingOpen,
  prophecyRecord,
  QUESTION_LIMIT,
  questionsLeft,
  formatProphecyNumber,
  type Message,
  type MessagePart,
  type Prophecy,
  type ProphecyListResponse,
  type Reading,
  type ReadingDetailResponse,
  type ReadingsResponse,
  type SourcesResponse,
  type TodayResponse,
  type User,
} from '@morrow/core';
import { generateDailyReading, summarizeReading } from '../ai/reading';
import { ReadingExistsError, type Repository } from '../data';
import { readingDayEnd } from './time';

const SUMMARY_MEMORY = 7;
const DAY_MS = 86_400_000;

export const readingIdFor = (localDate: string) => `r_${localDate}`;

/** Every prophecy referenced by `messages`, in first-reference order. */
export function referencedProphecies(messages: Message[], all: Prophecy[]): Prophecy[] {
  const ids = new Set<string>();
  for (const m of messages) for (const p of m.parts) if (p.type === 'prophecyRef') ids.add(p.prophecyId);
  return [...ids].map((id) => all.find((p) => p.id === id)).filter((p): p is Prophecy => Boolean(p));
}

/** Seals every open reading whose day has ended, writing its memory summary. */
export async function sealStaleReadings(repo: Repository, user: User, now: Date): Promise<Reading[]> {
  return sealReadings(repo, user, await repo.listOpenReadings(user.id), now);
}

/** Seals the given readings whose day has ended; readings still in their day are skipped. */
async function sealReadings(repo: Repository, user: User, candidates: Reading[], now: Date): Promise<Reading[]> {
  const sealed: Reading[] = [];
  for (const reading of candidates) {
    if (reading.status !== 'open' || isReadingOpen(reading, now)) continue;
    const messages = await repo.listMessages(user.id, reading.id);
    const summary = await summarizeReading(user, reading, messages);
    const sealedAt = new Date(Math.min(now.getTime(), readingDayEnd(reading.localDate, reading.timezone).getTime()));
    await repo.sealReading(user.id, reading.id, summary, sealedAt.toISOString());
    sealed.push({ ...reading, status: 'sealed', summary, sealedAt: sealedAt.toISOString() });
  }
  return sealed;
}

/** Creates and opens the reading for `localDate`: generates the opening, issues the day's prophecy. */
export async function openReading(repo: Repository, user: User, localDate: string, now: Date): Promise<Reading> {
  const [dossier, summaries, prophecies, number, linked] = await Promise.all([
    repo.getDossier(user.id),
    repo.listSummaries(user.id, SUMMARY_MEMORY),
    repo.listProphecies(user.id),
    repo.nextProphecyNumber(user.id),
    repo.listSources(user.id),
  ]);
  const sources = linked.filter((s) => s.status !== 'not_linked').map((s) => s.kind);
  const output = await generateDailyReading({ user, now, localDate, dossier, summaries, prophecies, sources });
  const readingId = readingIdFor(localDate);
  const prophecyId = `p_${formatProphecyNumber(number)}`;

  const fulfilled = prophecies.filter((p) => p.status === 'fulfilled' && p.fulfilledInReadingId === readingId);
  const parts: MessagePart[] = [
    { type: 'observation', ...output.observation },
    ...fulfilled.map((p): MessagePart => ({ type: 'prophecyRef', prophecyId: p.id, event: 'fulfilled' })),
    ...(fulfilled.length > 0 ? [{ type: 'text' as const, text: `It came true, ${user.name}.` }] : []),
    { type: 'prophecyRef', prophecyId, event: 'made' },
  ];

  const reading: Reading = {
    id: readingId,
    localDate,
    timezone: user.timezone,
    status: 'open',
    headline: output.observation.text,
    prophecyId,
    summary: null,
    questionCount: 0,
    openedAt: now.toISOString(),
    sealedAt: null,
  };
  const opening: Message = {
    id: `m_${localDate}_open`,
    readingId,
    role: 'assistant',
    parts,
    createdAt: now.toISOString(),
  };

  try {
    await repo.createReading(user.id, reading, [opening]);
  } catch (e) {
    // Another request opened the day first — unique (user, local_date) wins.
    if (e instanceof ReadingExistsError) {
      const existing = await repo.getReadingByDate(user.id, localDate);
      if (existing) return existing;
    }
    throw e;
  }

  const { prophecy: p } = output;
  const statement = p.statement.trim();
  await repo.createProphecy(user.id, {
    id: prophecyId,
    number,
    statement,
    title: statement.length <= 48 ? statement : `${statement.split(/[,—–;]/)[0]!.trim()}.`,
    checkCondition: p.checkCondition,
    windowStart: now.toISOString(),
    windowEnd: new Date(now.getTime() + p.windowDays * DAY_MS).toISOString(),
    likelihood: Math.round(p.likelihood * 100) / 100,
    watching: p.watching,
    status: 'open',
    madeOn: localDate,
    madeInReadingId: readingId,
    fulfilledInReadingId: null,
    resolvedAt: null,
  });
  return reading;
}

const g = globalThis as typeof globalThis & { __morrowOpening?: Map<string, Promise<Reading>> };
/** Readings being drawn right now, per user and day (a draw takes tens of seconds; every page load would start one). */
const opening = (g.__morrowOpening ??= new Map());

/**
 * get-or-create today's reading (sealing yesterday's first). Concurrent requests for the same day share one draw
 * instead of each generating their own; the unique (user, local_date) row still guards across instances.
 */
export async function ensureTodayReading(repo: Repository, user: User, now: Date): Promise<Reading> {
  const localDate = getReadingDate(now, user.timezone);
  const existing = await repo.getReadingByDate(user.id, localDate);
  if (existing) return existing;
  const key = `${user.id}:${localDate}`;
  let draw = opening.get(key);
  if (!draw) {
    draw = (async () => {
      await sealStaleReadings(repo, user, now);
      return openReading(repo, user, localDate, now);
    })().finally(() => opening.delete(key));
    opening.set(key, draw);
  }
  return draw;
}

/**
 * Today's payload plus every prophecy (the page also needs the track record). An existing reading, its
 * messages and the prophecies load in parallel: reading ids are `r_<localDate>`, so messages don't wait on
 * the reading row. Only the first visit of the day (no reading yet) takes the slower draw path.
 */
export async function loadToday(
  repo: Repository,
  user: User,
  now: Date,
): Promise<{ view: TodayResponse; prophecies: Prophecy[] }> {
  const localDate = getReadingDate(now, user.timezone);
  const [existing, preloaded, all] = await Promise.all([
    repo.getReadingByDate(user.id, localDate),
    repo.listMessages(user.id, readingIdFor(localDate)),
    repo.listProphecies(user.id),
  ]);
  let reading = existing;
  let messages = preloaded;
  let prophecies = all;
  if (!reading) {
    reading = await ensureTodayReading(repo, user, now);
    // Drawing wrote the opening and issued a prophecy; read both back.
    [messages, prophecies] = await Promise.all([repo.listMessages(user.id, reading.id), repo.listProphecies(user.id)]);
  }
  return {
    view: {
      user,
      now: now.toISOString(),
      reading,
      messages,
      prophecies: referencedProphecies(messages, prophecies),
      questionLimit: QUESTION_LIMIT,
      questionsLeft: questionsLeft(reading),
    },
    prophecies,
  };
}

export async function getTodayView(repo: Repository, user: User, now: Date): Promise<TodayResponse> {
  return (await loadToday(repo, user, now)).view;
}

/**
 * Past readings list. Never draws today's reading (Today does); yesterday's is sealed so it shows as past.
 * Seals from the listed rows instead of a separate open-readings query, so the common case is one round trip.
 */
export async function getReadingsView(repo: Repository, user: User, now: Date): Promise<ReadingsResponse> {
  const list = await repo.listReadings(user.id);
  const sealed = await sealReadings(repo, user, list.readings, now);
  if (sealed.length === 0) return list;
  const byId = new Map(sealed.map((r) => [r.id, r]));
  return { ...list, readings: list.readings.map((r) => byId.get(r.id) ?? r) };
}

/**
 * One sealed (or past) reading. Sealing stale readings, the reading row, its messages and the prophecies all
 * load in parallel (reading ids are `r_<localDate>`); if this very reading was just sealed, the sealed copy wins.
 */
export async function getReadingDetailView(
  repo: Repository,
  user: User,
  now: Date,
  localDate: string,
): Promise<ReadingDetailResponse | null> {
  const [sealed, row, messages, all] = await Promise.all([
    sealStaleReadings(repo, user, now),
    repo.getReadingByDate(user.id, localDate),
    repo.listMessages(user.id, readingIdFor(localDate)),
    repo.listProphecies(user.id),
  ]);
  if (!row) return null;
  const reading = sealed.find((r) => r.id === row.id) ?? row;
  return { reading, messages, prophecies: referencedProphecies(messages, all) };
}

export async function getProphecyListView(repo: Repository, user: User): Promise<ProphecyListResponse> {
  const all = await repo.listProphecies(user.id);
  const newestFirst = (a: Prophecy, b: Prophecy) => b.number - a.number;
  return {
    open: all.filter((p) => p.status === 'open').sort(newestFirst),
    resolved: all.filter((p) => p.status !== 'open').sort(newestFirst),
    record: prophecyRecord(all),
  };
}

export async function getSourcesView(repo: Repository, user: User): Promise<SourcesResponse> {
  const [sources, dossier] = await Promise.all([repo.listSources(user.id), repo.getDossier(user.id)]);
  return {
    sources,
    dossier: {
      sizeBytes: dossier?.sizeBytes ?? 0,
      rebuiltAt: dossier?.rebuiltAt ?? new Date(0).toISOString(),
      factCount: dossier?.facts.length ?? 0,
    },
  };
}
