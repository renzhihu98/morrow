/**
 * Postgres schema (SPEC §5.3 + §12). Two groups of tables:
 *
 * - Better Auth (`users`, `sessions`, `accounts`, `verifications`) — property names follow Better Auth's
 *   field names (the Drizzle adapter maps by property), columns are snake_case. OAuth tokens in `accounts`
 *   are encrypted by Better Auth (`account.encryptOAuthTokens`).
 * - Morrow data, all keyed to `users.id` with cascade deletes. IDs that are human-readable in the API
 *   (`r_2026-09-30`, `p_0047`) are only unique per user, so those tables use composite primary keys.
 */
import type { CheckCondition, DossierFact, DossierPattern, MessagePart, SourceKind, SourceSyncState } from '@morrow/core';
import {
  boolean,
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
import type { DossierAggregates } from '../dossier/aggregates';
import type { RawEventPayload } from '../sources/types';

/** Morrow tables use ISO strings; Better Auth tables use Date objects. */
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });
const date = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// ─── Better Auth ────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: date('created_at').notNull().defaultNow(),
  updatedAt: date('updated_at').notNull().defaultNow(),
  /** additionalField — IANA timezone reported by the client; null until captured (treated as UTC). */
  timezone: text('timezone'),
  /** additionalField — set when onboarding completes ("Draw my first reading" / "Skip for now"). */
  onboardedAt: date('onboarded_at'),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: date('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: date('created_at').notNull().defaultNow(),
    updatedAt: date('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [index('sessions_user_id').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: date('access_token_expires_at'),
    refreshTokenExpiresAt: date('refresh_token_expires_at'),
    /** Comma-separated granted scopes (merged across incremental grants). */
    scope: text('scope'),
    password: text('password'),
    createdAt: date('created_at').notNull().defaultNow(),
    updatedAt: date('updated_at').notNull().defaultNow(),
  },
  (t) => [index('accounts_user_id').on(t.userId), index('accounts_provider_account').on(t.providerId, t.accountId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: date('expires_at').notNull(),
    createdAt: date('created_at').notNull().defaultNow(),
    updatedAt: date('updated_at').notNull().defaultNow(),
  },
  (t) => [index('verifications_identifier').on(t.identifier)],
);

/** Model map handed to the Better Auth Drizzle adapter. */
export const authSchema = { user: users, session: sessions, account: accounts, verification: verifications };

// ─── Morrow ─────────────────────────────────────────────────────────────────

/**
 * Per-user source connection metadata. The OAuth grant itself lives in `accounts`; this row holds
 * sync state, cursors and stats. A source is "linked" when the grant exists and has the source's scopes.
 */
export const sources = pgTable(
  'sources',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<SourceKind>().notNull(),
    syncState: text('sync_state').$type<SourceSyncState>().notNull().default('pending'),
    lastError: text('last_error'),
    lastSyncedAt: ts('last_synced_at'),
    eventCount: integer('event_count').notNull().default(0),
    stats: jsonb('stats').$type<{ value: number; label: string } | null>(),
    /** Provider cursor, e.g. Spotify `after` (ms) for recently-played. */
    cursor: text('cursor'),
    connectedAt: ts('connected_at'),
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
    /** TTL (RAW_EVENT_TTL_HOURS after sync); purged by /api/cron/sync and /api/cron/verify. */
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
  /** Incremental extractor state that outlives the 24h raw-event purge. Never shown to the LLM. */
  aggregates: jsonb('aggregates').$type<DossierAggregates>(),
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
