import type { Dossier, Message, Prophecy, Reading, Source, User } from '@morrow/core';
import { and, asc, count, desc, eq, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { sourceKindForAccount } from '../auth/grants';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import { emptyAggregates, normalizeAggregates } from '../dossier/aggregates';
import { SOURCE_CATALOG, SOURCE_ORDER } from '../sources/catalog';
import { ReadingExistsError, type Repository, type SourceState } from './repository';

const { users, accounts, sources, rawEvents, dossiers, readings, messages, prophecies } = schema;

/** Postgres returns `2026-09-30 16:12:00+00`; the API contract wants ISO 8601. */
const iso = (v: string) => new Date(v).toISOString();
const isoOrNull = (v: string | null) => (v === null ? null : iso(v));

/** Users without a captured timezone are treated as UTC until the client reports one. */
export const DEFAULT_TIMEZONE = 'UTC';

type ReadingRow = typeof readings.$inferSelect;
type ProphecyRow = typeof prophecies.$inferSelect;
type SourceRow = typeof sources.$inferSelect;

const toReading = (r: ReadingRow): Reading => ({
  id: r.id,
  localDate: r.localDate,
  timezone: r.timezone,
  status: r.status,
  headline: r.headline,
  prophecyId: r.prophecyId,
  summary: r.summary,
  questionCount: r.questionCount,
  openedAt: iso(r.openedAt),
  sealedAt: isoOrNull(r.sealedAt),
});

const toProphecy = (p: ProphecyRow): Prophecy => ({
  id: p.id,
  number: p.number,
  statement: p.statement,
  title: p.title,
  checkCondition: p.checkCondition,
  windowStart: iso(p.windowStart),
  windowEnd: iso(p.windowEnd),
  likelihood: p.likelihood,
  watching: p.watching,
  status: p.status,
  madeOn: p.madeOn,
  madeInReadingId: p.madeInReadingId,
  fulfilledInReadingId: p.fulfilledInReadingId,
  resolvedAt: isoOrNull(p.resolvedAt),
});

const toSourceState = (r: SourceRow): SourceState => ({
  kind: r.kind,
  syncState: r.syncState,
  lastError: r.lastError,
  lastSyncedAt: isoOrNull(r.lastSyncedAt),
  eventCount: r.eventCount,
  cursor: r.cursor,
  calendarCount: calendarCountOf(r),
});

/** `sources.stats` holds `{ value, label: 'calendars' }` for Calendar. */
const calendarCountOf = (r: SourceRow) => (r.stats?.label === 'calendars' ? r.stats.value : null);

const toUser = (u: { id: string; name: string; timezone: string | null }): User => ({
  id: u.id,
  name: u.name.split(/\s+/)[0] || u.name,
  timezone: u.timezone ?? DEFAULT_TIMEZONE,
});

export function createDrizzleRepository(): Repository {
  const db = getDb();

  return {
    kind: 'drizzle',

    async getUser(userId) {
      const [row] = await db.select({ id: users.id, name: users.name, timezone: users.timezone }).from(users).where(eq(users.id, userId));
      return row ? toUser(row) : null;
    },
    async listUsers() {
      const rows = await db
        .select({ id: users.id, name: users.name, timezone: users.timezone })
        .from(users)
        .where(isNotNull(users.onboardedAt));
      return rows.map(toUser);
    },
    async setUserTimezone(userId, timezone) {
      await db.update(users).set({ timezone, updatedAt: new Date() }).where(eq(users.id, userId));
    },
    async markOnboarded(userId, at) {
      await db
        .update(users)
        .set({ onboardedAt: sql`coalesce(${users.onboardedAt}, ${at}::timestamptz)`, updatedAt: new Date() })
        .where(eq(users.id, userId));
    },

    async getReadingByDate(userId, localDate) {
      const [row] = await db
        .select()
        .from(readings)
        .where(and(eq(readings.userId, userId), eq(readings.localDate, localDate)));
      return row ? toReading(row) : null;
    },
    async getReading(userId, readingId) {
      const [row] = await db
        .select()
        .from(readings)
        .where(and(eq(readings.userId, userId), eq(readings.id, readingId)));
      return row ? toReading(row) : null;
    },
    async listReadings(userId, limit = 50) {
      const [rows, [total]] = await Promise.all([
        db.select().from(readings).where(eq(readings.userId, userId)).orderBy(desc(readings.localDate)).limit(limit),
        db.select({ n: count() }).from(readings).where(eq(readings.userId, userId)),
      ]);
      return { readings: rows.map(toReading), total: total?.n ?? rows.length };
    },
    async listOpenReadings(userId) {
      const rows = await db
        .select()
        .from(readings)
        .where(and(eq(readings.userId, userId), eq(readings.status, 'open')));
      return rows.map(toReading);
    },
    async createReading(userId, reading, opening) {
      const inserted = await db
        .insert(readings)
        .values({ ...reading, userId })
        .onConflictDoNothing()
        .returning({ id: readings.id });
      if (inserted.length === 0) throw new ReadingExistsError(reading.localDate);
      if (opening.length > 0) {
        await db.insert(messages).values(opening.map((m) => ({ ...m, userId })));
      }
      return reading;
    },
    async sealReading(userId, readingId, summary, sealedAt) {
      await db
        .update(readings)
        .set({ status: 'sealed', summary, sealedAt })
        .where(and(eq(readings.userId, userId), eq(readings.id, readingId), eq(readings.status, 'open')));
    },
    async reserveQuestion(userId, readingId, limit) {
      const updated = await db
        .update(readings)
        .set({ questionCount: sql`${readings.questionCount} + 1` })
        .where(
          and(
            eq(readings.userId, userId),
            eq(readings.id, readingId),
            eq(readings.status, 'open'),
            lt(readings.questionCount, limit),
          ),
        )
        .returning({ used: readings.questionCount });
      if (updated[0]) return { ok: true, used: updated[0].used };
      const [row] = await db
        .select({ status: readings.status })
        .from(readings)
        .where(and(eq(readings.userId, userId), eq(readings.id, readingId)));
      if (!row) return { ok: false, reason: 'not_found' };
      return { ok: false, reason: row.status === 'sealed' ? 'sealed' : 'limit' };
    },
    async listSummaries(userId, limit) {
      const rows = await db
        .select({ readingId: readings.id, localDate: readings.localDate, summary: readings.summary })
        .from(readings)
        .where(and(eq(readings.userId, userId), isNotNull(readings.summary)))
        .orderBy(desc(readings.localDate))
        .limit(limit);
      return rows.map((r) => ({ ...r, summary: r.summary ?? '' }));
    },

    async listMessages(userId, readingId) {
      const rows = await db
        .select()
        .from(messages)
        .where(and(eq(messages.userId, userId), eq(messages.readingId, readingId)))
        .orderBy(asc(messages.createdAt));
      return rows.map(
        (m): Message => ({ id: m.id, readingId: m.readingId, role: m.role, parts: m.parts, createdAt: iso(m.createdAt) }),
      );
    },
    async appendMessage(userId, message) {
      await db.insert(messages).values({ ...message, userId }).onConflictDoNothing();
    },

    async listProphecies(userId) {
      const rows = await db.select().from(prophecies).where(eq(prophecies.userId, userId)).orderBy(asc(prophecies.number));
      return rows.map(toProphecy);
    },
    async nextProphecyNumber(userId) {
      const [row] = await db
        .select({ max: sql<number | null>`max(${prophecies.number})` })
        .from(prophecies)
        .where(eq(prophecies.userId, userId));
      return Number(row?.max ?? 0) + 1;
    },
    async createProphecy(userId, prophecy) {
      await db.insert(prophecies).values({ ...prophecy, userId });
    },
    async resolveProphecy(userId, prophecyId, patch) {
      await db
        .update(prophecies)
        .set(patch)
        .where(and(eq(prophecies.userId, userId), eq(prophecies.id, prophecyId), eq(prophecies.status, 'open')));
    },

    async listSources(userId) {
      const [grants, rows, open] = await Promise.all([
        db
          .select({ userId: accounts.userId, providerId: accounts.providerId, scope: accounts.scope, accessToken: accounts.accessToken, refreshToken: accounts.refreshToken })
          .from(accounts)
          .where(eq(accounts.userId, userId)),
        db.select().from(sources).where(eq(sources.userId, userId)),
        db
          .select({ watching: prophecies.watching })
          .from(prophecies)
          .where(and(eq(prophecies.userId, userId), eq(prophecies.status, 'open'))),
      ]);
      const granted = new Set(
        grants.filter((g) => g.accessToken || g.refreshToken).map((g) => sourceKindForAccount(g)),
      );
      return SOURCE_ORDER.map((kind): Source => {
        const row = rows.find((r) => r.kind === kind);
        const linked = granted.has(kind);
        const needsReauth = linked && row?.syncState === 'needs_reauth';
        return {
          ...SOURCE_CATALOG[kind],
          status: !linked ? 'not_linked' : needsReauth || row?.syncState === 'error' ? 'error' : 'linked',
          stat: linked && row && row.eventCount > 0 ? { value: row.eventCount, label: kind === 'spotify' ? 'plays' : 'events' } : null,
          watchingCount: open.filter((p) => p.watching.includes(kind)).length,
          lastSyncedAt: linked ? isoOrNull(row?.lastSyncedAt ?? null) : null,
          ...(linked ? { syncState: row?.syncState ?? 'pending', eventCount: row?.eventCount ?? 0 } : {}),
          ...(linked && row && calendarCountOf(row) ? { calendarCount: calendarCountOf(row)! } : {}),
        };
      });
    },
    async getSourceState(userId, kind) {
      const [row] = await db.select().from(sources).where(and(eq(sources.userId, userId), eq(sources.kind, kind)));
      return row ? toSourceState(row) : null;
    },
    async updateSourceState(userId, kind, patch) {
      const values = {
        ...(patch.syncState !== undefined ? { syncState: patch.syncState } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.lastSyncedAt !== undefined ? { lastSyncedAt: patch.lastSyncedAt } : {}),
        ...(patch.eventCount !== undefined ? { eventCount: patch.eventCount } : {}),
        ...(patch.cursor !== undefined ? { cursor: patch.cursor } : {}),
        ...(patch.calendarCount !== undefined ? { stats: patch.calendarCount === null ? null : { value: patch.calendarCount, label: 'calendars' } } : {}),
      };
      await db
        .insert(sources)
        .values({ id: `${userId}:${kind}`, userId, kind, connectedAt: new Date().toISOString(), ...values })
        .onConflictDoUpdate({ target: [sources.userId, sources.kind], set: values });
    },
    async clearSourceState(userId, kind) {
      await db.delete(sources).where(and(eq(sources.userId, userId), eq(sources.kind, kind)));
    },
    async setDemoSourceLinked() {
      throw new Error('Sources are linked through OAuth when a database is configured.');
    },

    async getDossier(userId) {
      const [row] = await db
        .select({ userId: dossiers.userId, facts: dossiers.facts, patterns: dossiers.patterns, sizeBytes: dossiers.sizeBytes, rebuiltAt: dossiers.rebuiltAt })
        .from(dossiers)
        .where(eq(dossiers.userId, userId));
      if (!row) return null;
      return { ...row, rebuiltAt: iso(row.rebuiltAt) } satisfies Dossier;
    },
    async getAggregates(userId) {
      const [row] = await db.select({ aggregates: dossiers.aggregates }).from(dossiers).where(eq(dossiers.userId, userId));
      return normalizeAggregates(row?.aggregates ?? null);
    },
    async saveDossier(dossier, aggregates) {
      const { userId, ...rest } = dossier;
      const set = aggregates ? { ...rest, aggregates } : rest;
      await db
        .insert(dossiers)
        .values({ ...dossier, aggregates: aggregates ?? null })
        .onConflictDoUpdate({ target: dossiers.userId, set });
    },
    async forgetFact(userId, factId) {
      const [row] = await db.select().from(dossiers).where(eq(dossiers.userId, userId));
      if (!row) return false;
      const facts = row.facts.filter((f) => f.id !== factId);
      const patterns = row.patterns.filter((p) => p.id !== factId);
      if (facts.length === row.facts.length && patterns.length === row.patterns.length) return false;
      const sizeBytes = new TextEncoder().encode(JSON.stringify({ facts, patterns })).length;
      const agg = normalizeAggregates(row.aggregates) ?? emptyAggregates();
      const aggregates = { ...agg, forgotten: [...new Set([...agg.forgotten, factId])] };
      await db.update(dossiers).set({ facts, patterns, sizeBytes, aggregates }).where(eq(dossiers.userId, userId));
      return true;
    },

    async addRawEvents(events) {
      // neon-http caps request size; insert in chunks.
      for (let i = 0; i < events.length; i += 200) {
        await db
          .insert(rawEvents)
          .values(events.slice(i, i + 200))
          .onConflictDoUpdate({
            target: rawEvents.id,
            // expires_at is kept from the first insert: raw data never lives longer than the TTL.
            set: { payload: sql`excluded.payload`, occurredAt: sql`excluded.occurred_at` },
          });
      }
    },
    async listRawEvents(userId, since) {
      const rows = await db
        .select()
        .from(rawEvents)
        .where(since ? and(eq(rawEvents.userId, userId), gte(rawEvents.occurredAt, since)) : eq(rawEvents.userId, userId))
        .orderBy(asc(rawEvents.occurredAt));
      return rows.map((e) => ({ ...e, occurredAt: iso(e.occurredAt), expiresAt: iso(e.expiresAt) }));
    },
    async deleteRawEvents(userId, kind) {
      const deleted = await db
        .delete(rawEvents)
        .where(and(eq(rawEvents.userId, userId), eq(rawEvents.sourceKind, kind)))
        .returning({ id: rawEvents.id });
      return deleted.length;
    },
    async purgeExpiredRawEvents(now) {
      const deleted = await db
        .delete(rawEvents)
        .where(lte(rawEvents.expiresAt, now.toISOString()))
        .returning({ id: rawEvents.id });
      return deleted.length;
    },

    async forgetEverything(userId) {
      // neon-http has no interactive transactions; batch runs these atomically in one request.
      await db.batch([
        db.delete(messages).where(eq(messages.userId, userId)),
        db.delete(prophecies).where(eq(prophecies.userId, userId)),
        db.delete(readings).where(eq(readings.userId, userId)),
        db.delete(dossiers).where(eq(dossiers.userId, userId)),
        db.delete(rawEvents).where(eq(rawEvents.userId, userId)),
        db.delete(sources).where(eq(sources.userId, userId)),
        // Starting from nothing includes onboarding.
        db.update(users).set({ onboardedAt: null, updatedAt: new Date() }).where(eq(users.id, userId)),
      ]);
    },
  };
}
