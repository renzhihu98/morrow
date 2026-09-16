/**
 * Postgres schema (SPEC §5.3). IDs that are human-readable in the API (`r_2026-09-30`, `p_0047`)
 * are only unique per user, so those tables use composite primary keys with `user_id`.
 */
import type { CheckCondition, DossierFact, DossierPattern, MessagePart, SourceKind } from '@morrow/core';
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type { RawEventPayload } from '../sources/types';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const sources = pgTable(
  'sources',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<SourceKind>().notNull(),
    status: text('status').$type<'linked' | 'not_linked' | 'error'>().notNull(),
    accessTokenEnc: text('access_token_enc'),
    refreshTokenEnc: text('refresh_token_enc'),
    lastSyncedAt: ts('last_synced_at'),
    stats: jsonb('stats').$type<{ value: number; label: string } | null>(),
  },
  (t) => [unique('sources_user_kind').on(t.userId, t.kind)],
);

export const rawEvents = pgTable(
  'raw_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceKind: text('source_kind').$type<SourceKind>().notNull(),
    occurredAt: ts('occurred_at').notNull(),
    payload: jsonb('payload').$type<RawEventPayload>().notNull(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('raw_events_expires_at').on(t.expiresAt), index('raw_events_user_occurred').on(t.userId, t.occurredAt)],
);

export const dossiers = pgTable('dossiers', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  facts: jsonb('facts').$type<DossierFact[]>().notNull(),
  patterns: jsonb('patterns').$type<DossierPattern[]>().notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  rebuiltAt: ts('rebuilt_at').notNull(),
});

export const readings = pgTable(
  'readings',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    timezone: text('timezone').notNull(),
    status: text('status').$type<'open' | 'sealed'>().notNull(),
    headline: text('headline').notNull(),
    prophecyId: text('prophecy_id'),
    summary: text('summary'),
    questionCount: integer('question_count').notNull().default(0),
    openedAt: ts('opened_at').notNull(),
    sealedAt: ts('sealed_at'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), unique('readings_user_local_date').on(t.userId, t.localDate)],
);

export const messages = pgTable(
  'messages',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readingId: text('reading_id').notNull(),
    role: text('role').$type<'user' | 'assistant'>().notNull(),
    parts: jsonb('parts').$type<MessagePart[]>().notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('messages_reading').on(t.userId, t.readingId, t.createdAt)],
);

export const prophecies = pgTable(
  'prophecies',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    madeInReadingId: text('made_in_reading_id').notNull(),
    fulfilledInReadingId: text('fulfilled_in_reading_id'),
    statement: text('statement').notNull(),
    title: text('title').notNull(),
    checkCondition: jsonb('check_condition').$type<CheckCondition>().notNull(),
    windowStart: ts('window_start').notNull(),
    windowEnd: ts('window_end').notNull(),
    likelihood: doublePrecision('likelihood').notNull(),
    watching: text('watching').array().$type<SourceKind[]>().notNull(),
    status: text('status').$type<'open' | 'fulfilled' | 'expired'>().notNull(),
    madeOn: text('made_on').notNull(),
    resolvedAt: ts('resolved_at'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), unique('prophecies_user_number').on(t.userId, t.number)],
);
