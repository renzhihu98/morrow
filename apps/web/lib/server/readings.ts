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
  const sealed: Reading[] = [];
  for (const reading of await repo.listOpenReadings(user.id)) {
    if (isReadingOpen(reading, now)) continue;
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
  const [dossier, summaries, prophecies, number] = await Promise.all([
    repo.getDossier(user.id),
    repo.listSummaries(user.id, SUMMARY_MEMORY),
    repo.listProphecies(user.id),
    repo.nextProphecyNumber(user.id),
  ]);
  const output = await generateDailyReading({ user, now, localDate, dossier, summaries, prophecies });
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

/** get-or-create today's reading (sealing yesterday's first). */
export async function ensureTodayReading(repo: Repository, user: User, now: Date): Promise<Reading> {
  const localDate = getReadingDate(now, user.timezone);
  const existing = await repo.getReadingByDate(user.id, localDate);
  if (existing) return existing;
  await sealStaleReadings(repo, user, now);
  return openReading(repo, user, localDate, now);
}

export async function getTodayView(repo: Repository, now: Date): Promise<TodayResponse> {
  const user = await repo.getDemoUser();
  const reading = await ensureTodayReading(repo, user, now);
  const [messages, all] = await Promise.all([repo.listMessages(user.id, reading.id), repo.listProphecies(user.id)]);
  return {
    user,
    now: now.toISOString(),
    reading,
    messages,
    prophecies: referencedProphecies(messages, all),
    questionLimit: QUESTION_LIMIT,
    questionsLeft: questionsLeft(reading),
  };
}

export async function getReadingsView(repo: Repository, now: Date): Promise<ReadingsResponse> {
  const user = await repo.getDemoUser();
  await ensureTodayReading(repo, user, now);
  return repo.listReadings(user.id);
}

export async function getReadingDetailView(
  repo: Repository,
  now: Date,
  localDate: string,
): Promise<ReadingDetailResponse | null> {
  const user = await repo.getDemoUser();
  await sealStaleReadings(repo, user, now);
  const reading = await repo.getReadingByDate(user.id, localDate);
  if (!reading) return null;
  const [messages, all] = await Promise.all([repo.listMessages(user.id, reading.id), repo.listProphecies(user.id)]);
  return { reading, messages, prophecies: referencedProphecies(messages, all) };
}

export async function getProphecyListView(repo: Repository): Promise<ProphecyListResponse> {
  const user = await repo.getDemoUser();
  const all = await repo.listProphecies(user.id);
  const newestFirst = (a: Prophecy, b: Prophecy) => b.number - a.number;
  return {
    open: all.filter((p) => p.status === 'open').sort(newestFirst),
    resolved: all.filter((p) => p.status !== 'open').sort(newestFirst),
    record: prophecyRecord(all),
  };
}

export async function getSourcesView(repo: Repository): Promise<SourcesResponse> {
  const user = await repo.getDemoUser();
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
