import {
  fixtures,
  type Dossier,
  type Message,
  type Prophecy,
  type Reading,
  type Source,
  type User,
} from '@morrow/core';
import { neon } from '@neondatabase/serverless';
import { and, asc, count, desc, eq, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
import { SOURCE_CATALOG, SOURCE_ORDER } from '../sources/catalog';
import { ReadingExistsError, type Repository } from './repository';

const { users, sources, rawEvents, dossiers, readings, messages, prophecies } = schema;

/** Postgres returns `2026-09-30 16:12:00+00`; the API contract wants ISO 8601. */
const iso = (v: string) => new Date(v).toISOString();
const isoOrNull = (v: string | null) => (v === null ? null : iso(v));

const DEMO_USER: User = {
  id: process.env.MORROW_DEMO_USER_ID ?? fixtures.user.id,
  name: process.env.MORROW_DEMO_USER_NAME ?? fixtures.user.name,
  timezone: process.env.MORROW_DEMO_USER_TIMEZONE ?? fixtures.user.timezone,
};

type ReadingRow = typeof readings.$inferSelect;
type ProphecyRow = typeof prophecies.$inferSelect;

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

export function createDrizzleRepository(databaseUrl: string): Repository {
  const db = drizzle({ client: neon(databaseUrl), schema });
  let demoUserReady: Promise<void> | null = null;

  /** Scaffold auth: a single demo user, provisioned (with the fixture dossier) on first use. */
  function ensureDemoUser(): Promise<void> {
    demoUserReady ??= (async () => {
      await db.insert(users).values(DEMO_USER).onConflictDoNothing();
      await db
        .insert(sources)
        .values(SOURCE_ORDER.map((kind) => ({ id: `${DEMO_USER.id}:${kind}`, userId: DEMO_USER.id, kind, status: 'not_linked' as const })))
        .onConflictDoNothing();
      const { facts, patterns, sizeBytes, rebuiltAt } = fixtures.dossier;
      await db.insert(dossiers).values({ userId: DEMO_USER.id, facts, patterns, sizeBytes, rebuiltAt }).onConflictDoNothing();
    })().catch((e) => {
      demoUserReady = null;
      throw e;
    });
    return demoUserReady;
  }

  return {
    kind: 'drizzle',

    async getDemoUser() {
      await ensureDemoUser();
      return DEMO_USER;
    },
    async listUsers() {
      const rows = await db.select({ id: users.id, name: users.name, timezone: users.timezone }).from(users);
      return rows;
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
      await db.insert(messages).values({ ...message, userId });
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
      const [rows, open] = await Promise.all([
        db.select().from(sources).where(eq(sources.userId, userId)),
        db
          .select({ watching: prophecies.watching })
          .from(prophecies)
          .where(and(eq(prophecies.userId, userId), eq(prophecies.status, 'open'))),
      ]);
      return SOURCE_ORDER.map((kind): Source => {
        const row = rows.find((r) => r.kind === kind);
        return {
          ...SOURCE_CATALOG[kind],
          status: row?.status ?? 'not_linked',
          stat: row?.stats ?? null,
          watchingCount: open.filter((p) => p.watching.includes(kind)).length,
          lastSyncedAt: isoOrNull(row?.lastSyncedAt ?? null),
        };
      });
    },
    async setSourceStatus(userId, kind, status) {
      const clear = status === 'linked' ? {} : { accessTokenEnc: null, refreshTokenEnc: null, stats: null, lastSyncedAt: null };
      await db
        .insert(sources)
        .values({ id: `${userId}:${kind}`, userId, kind, status })
        .onConflictDoUpdate({ target: [sources.userId, sources.kind], set: { status, ...clear } });
    },

    async getDossier(userId) {
      const [row] = await db.select().from(dossiers).where(eq(dossiers.userId, userId));
      if (!row) return null;
      return { ...row, rebuiltAt: iso(row.rebuiltAt) } satisfies Dossier;
    },
    async saveDossier(dossier) {
      const { userId, ...rest } = dossier;
      await db.insert(dossiers).values(dossier).onConflictDoUpdate({ target: dossiers.userId, set: rest });
    },
    async forgetFact(userId, factId) {
      const dossier = await this.getDossier(userId);
      if (!dossier) return false;
      const facts = dossier.facts.filter((f) => f.id !== factId);
      const patterns = dossier.patterns.filter((p) => p.id !== factId);
      if (facts.length === dossier.facts.length && patterns.length === dossier.patterns.length) return false;
      const sizeBytes = new TextEncoder().encode(JSON.stringify({ facts, patterns })).length;
      await db.update(dossiers).set({ facts, patterns, sizeBytes }).where(eq(dossiers.userId, userId));
      return true;
    },

    async addRawEvents(events) {
      if (events.length === 0) return;
      await db.insert(rawEvents).values(events).onConflictDoNothing();
    },
    async listRawEvents(userId, since) {
      const rows = await db
        .select()
        .from(rawEvents)
        .where(since ? and(eq(rawEvents.userId, userId), gte(rawEvents.occurredAt, since)) : eq(rawEvents.userId, userId))
        .orderBy(asc(rawEvents.occurredAt));
      return rows.map((e) => ({ ...e, occurredAt: iso(e.occurredAt), expiresAt: iso(e.expiresAt) }));
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
        db
          .update(sources)
          .set({ status: 'not_linked', accessTokenEnc: null, refreshTokenEnc: null, stats: null, lastSyncedAt: null })
          .where(eq(sources.userId, userId)),
      ]);
    },
  };
}
