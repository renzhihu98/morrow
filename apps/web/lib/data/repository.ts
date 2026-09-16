import type {
  Dossier,
  Message,
  Prophecy,
  Reading,
  ReadingSummary,
  Source,
  SourceKind,
  SourceStatus,
  User,
} from '@morrow/core';
import type { RawEvent } from '../sources/types';

export type ReserveQuestionResult =
  | { ok: true; used: number }
  | { ok: false; reason: 'sealed' | 'limit' | 'not_found' };

export class ReadingExistsError extends Error {
  constructor(localDate: string) {
    super(`A reading already exists for ${localDate}`);
    this.name = 'ReadingExistsError';
  }
}

/**
 * Persistence boundary. `memoryRepository` (fixtures, demo) and `drizzleRepository` (Postgres)
 * implement the same contract; all domain rules live in lib/server services on top of it.
 */
export interface Repository {
  readonly kind: 'memory' | 'drizzle';

  // users
  getDemoUser(): Promise<User>;
  listUsers(): Promise<User[]>;

  // readings — unique on (userId, localDate)
  getReadingByDate(userId: string, localDate: string): Promise<Reading | null>;
  getReading(userId: string, readingId: string): Promise<Reading | null>;
  /** Newest first. */
  listReadings(userId: string, limit?: number): Promise<{ readings: Reading[]; total: number }>;
  listOpenReadings(userId: string): Promise<Reading[]>;
  /** Throws ReadingExistsError when the (user, localDate) reading already exists. */
  createReading(userId: string, reading: Reading, opening: Message[]): Promise<Reading>;
  sealReading(userId: string, readingId: string, summary: string, sealedAt: string): Promise<void>;
  /** Atomically consumes one question if the reading is open and under the limit. */
  reserveQuestion(userId: string, readingId: string, limit: number): Promise<ReserveQuestionResult>;
  listSummaries(userId: string, limit: number): Promise<ReadingSummary[]>;

  // messages
  listMessages(userId: string, readingId: string): Promise<Message[]>;
  appendMessage(userId: string, message: Message): Promise<void>;

  // prophecies
  /** Ordered by number ascending. */
  listProphecies(userId: string): Promise<Prophecy[]>;
  nextProphecyNumber(userId: string): Promise<number>;
  createProphecy(userId: string, prophecy: Prophecy): Promise<void>;
  resolveProphecy(
    userId: string,
    prophecyId: string,
    patch: Pick<Prophecy, 'status' | 'resolvedAt' | 'fulfilledInReadingId'>,
  ): Promise<void>;

  // sources
  listSources(userId: string): Promise<Source[]>;
  setSourceStatus(userId: string, kind: SourceKind, status: SourceStatus): Promise<void>;

  // dossier
  getDossier(userId: string): Promise<Dossier | null>;
  saveDossier(dossier: Dossier): Promise<void>;
  /** Returns false when the fact did not exist. */
  forgetFact(userId: string, factId: string): Promise<boolean>;

  // raw events (TTL)
  addRawEvents(events: RawEvent[]): Promise<void>;
  listRawEvents(userId: string, since?: string): Promise<RawEvent[]>;
  purgeExpiredRawEvents(now: Date): Promise<number>;

  /** Deletes readings, messages, prophecies, dossier, raw events and source links. */
  forgetEverything(userId: string): Promise<void>;
}
