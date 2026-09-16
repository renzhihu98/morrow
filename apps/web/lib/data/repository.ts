import type {
  Dossier,
  Message,
  Prophecy,
  Reading,
  ReadingSummary,
  Source,
  SourceKind,
  SourceSyncState,
  User,
} from '@morrow/core';
import type { DossierAggregates } from '../dossier/aggregates';
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

/** Per-user source sync metadata (the OAuth grant itself lives in Better Auth's `accounts`). */
export type SourceState = {
  kind: SourceKind;
  syncState: SourceSyncState;
  lastError: string | null;
  lastSyncedAt: string | null;
  eventCount: number;
  cursor: string | null;
  /** Calendar: calendars read on the last sync (null for other sources / before the first multi-calendar sync). */
  calendarCount?: number | null;
};

export type SourceStatePatch = Partial<Omit<SourceState, 'kind'>>;

/**
 * Persistence boundary. `memoryRepository` (fixtures, demo) and `drizzleRepository` (Postgres)
 * implement the same contract; every method is scoped to a user id. Domain rules live in lib/server.
 */
export interface Repository {
  readonly kind: 'memory' | 'drizzle';

  // users
  getUser(userId: string): Promise<User | null>;
  /** Users the crons work for (onboarded users in Postgres). */
  listUsers(): Promise<User[]>;
  setUserTimezone(userId: string, timezone: string): Promise<void>;
  markOnboarded(userId: string, at: string): Promise<void>;

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
  /** All source kinds in display order with link status (from grants) and sync state. */
  listSources(userId: string): Promise<Source[]>;
  getSourceState(userId: string, kind: SourceKind): Promise<SourceState | null>;
  updateSourceState(userId: string, kind: SourceKind, patch: SourceStatePatch): Promise<void>;
  /** Clears sync state for a kind (after disconnect). */
  clearSourceState(userId: string, kind: SourceKind): Promise<void>;
  /** Demo mode only: flips the fixture link status (no OAuth). */
  setDemoSourceLinked(userId: string, kind: SourceKind, linked: boolean): Promise<void>;

  // dossier
  getDossier(userId: string): Promise<Dossier | null>;
  getAggregates(userId: string): Promise<DossierAggregates | null>;
  /** Saves facts/patterns; aggregates are saved too when given. */
  saveDossier(dossier: Dossier, aggregates?: DossierAggregates): Promise<void>;
  /** Returns false when the fact did not exist. Forgotten ids are remembered so rebuilds skip them. */
  forgetFact(userId: string, factId: string): Promise<boolean>;

  // raw events (TTL)
  /** Upserts by id (payload + expiry refreshed). */
  addRawEvents(events: RawEvent[]): Promise<void>;
  listRawEvents(userId: string, since?: string): Promise<RawEvent[]>;
  deleteRawEvents(userId: string, kind: SourceKind): Promise<number>;
  purgeExpiredRawEvents(now: Date): Promise<number>;

  /** Deletes readings, messages, prophecies, dossier (+aggregates), raw events and source sync state. */
  forgetEverything(userId: string): Promise<void>;
}
