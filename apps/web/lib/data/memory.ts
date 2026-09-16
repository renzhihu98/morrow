import { fixtures, type Dossier, type Message, type Prophecy, type Reading, type Source, type SourceKind } from '@morrow/core';
import { emptyAggregates, type DossierAggregates } from '../dossier/aggregates';
import type { RawEvent } from '../sources/types';
import { ReadingExistsError, type Repository, type SourceState } from './repository';

type Store = {
  users: typeof fixtures.user[];
  readings: Reading[];
  /** Readings older than the fixture window that are counted but not materialised ("23 readings"). */
  unlistedReadings: number;
  messages: Map<string, Message[]>;
  prophecies: Prophecy[];
  sources: Omit<Source, 'watchingCount'>[];
  dossier: Dossier | null;
  aggregates: DossierAggregates | null;
  sourceStates: Map<SourceKind, SourceState>;
  rawEvents: RawEvent[];
};

function seed(): Store {
  const f = structuredClone(fixtures);
  return {
    users: [f.user],
    readings: f.readings,
    unlistedReadings: f.readingsTotal - f.readings.length,
    messages: new Map(Object.entries(f.messages)),
    prophecies: f.prophecies,
    sources: f.sources.map(({ watchingCount: _w, ...s }) => s),
    dossier: f.dossier,
    aggregates: null,
    sourceStates: new Map(),
    rawEvents: [],
  };
}

const factBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const byDateDesc = (a: Reading, b: Reading) => b.localDate.localeCompare(a.localDate);

/**
 * In-memory repository seeded from `@morrow/core` fixtures (demo mode: one person, Iris).
 * User ids are accepted for interface parity but there is only one story. Survives hot reloads via globalThis.
 */
export function createMemoryRepository(store: Store = seed()): Repository {
  const watching = (s: Omit<Source, 'watchingCount'>): Source => ({
    ...s,
    watchingCount: store.prophecies.filter((p) => p.status === 'open' && p.watching.includes(s.kind)).length,
  });

  return {
    kind: 'memory',

    async getUser() {
      return structuredClone(store.users[0] ?? fixtures.user);
    },
    async listUsers() {
      return structuredClone(store.users);
    },
    async setUserTimezone() {
      // The demo story is pinned to its fixture timezone.
    },
    async markOnboarded() {},

    async getReadingByDate(_userId, localDate) {
      return structuredClone(store.readings.find((r) => r.localDate === localDate) ?? null);
    },
    async getReading(_userId, readingId) {
      return structuredClone(store.readings.find((r) => r.id === readingId) ?? null);
    },
    async listReadings(_userId, limit = 50) {
      const sorted = [...store.readings].sort(byDateDesc);
      return { readings: structuredClone(sorted.slice(0, limit)), total: sorted.length + store.unlistedReadings };
    },
    async listOpenReadings() {
      return structuredClone(store.readings.filter((r) => r.status === 'open'));
    },
    async createReading(_userId, reading, opening) {
      if (store.readings.some((r) => r.localDate === reading.localDate)) throw new ReadingExistsError(reading.localDate);
      store.readings.push(structuredClone(reading));
      store.messages.set(reading.id, structuredClone(opening));
      return reading;
    },
    async sealReading(_userId, readingId, summary, sealedAt) {
      const r = store.readings.find((x) => x.id === readingId);
      if (r && r.status === 'open') Object.assign(r, { status: 'sealed', summary, sealedAt });
    },
    async reserveQuestion(_userId, readingId, limit) {
      const r = store.readings.find((x) => x.id === readingId);
      if (!r) return { ok: false, reason: 'not_found' };
      if (r.status !== 'open') return { ok: false, reason: 'sealed' };
      if (r.questionCount >= limit) return { ok: false, reason: 'limit' };
      r.questionCount += 1;
      return { ok: true, used: r.questionCount };
    },
    async listSummaries(_userId, limit) {
      return [...store.readings]
        .sort(byDateDesc)
        .filter((r) => r.summary !== null)
        .slice(0, limit)
        .map((r) => ({ readingId: r.id, localDate: r.localDate, summary: r.summary ?? '' }));
    },

    async listMessages(_userId, readingId) {
      return structuredClone(store.messages.get(readingId) ?? []);
    },
    async appendMessage(_userId, message) {
      const list = store.messages.get(message.readingId) ?? [];
      list.push(structuredClone(message));
      store.messages.set(message.readingId, list);
    },

    async listProphecies() {
      return structuredClone([...store.prophecies].sort((a, b) => a.number - b.number));
    },
    async nextProphecyNumber() {
      return Math.max(0, ...store.prophecies.map((p) => p.number)) + 1;
    },
    async createProphecy(_userId, prophecy) {
      store.prophecies.push(structuredClone(prophecy));
    },
    async resolveProphecy(_userId, prophecyId, patch) {
      const p = store.prophecies.find((x) => x.id === prophecyId);
      if (p && p.status === 'open') Object.assign(p, patch);
    },

    async listSources() {
      return structuredClone(store.sources.map(watching));
    },
    async getSourceState(_userId, kind) {
      return structuredClone(store.sourceStates.get(kind) ?? null);
    },
    async updateSourceState(_userId, kind, patch) {
      const prev = store.sourceStates.get(kind) ?? {
        kind,
        syncState: 'pending' as const,
        lastError: null,
        lastSyncedAt: null,
        eventCount: 0,
        cursor: null,
      };
      store.sourceStates.set(kind, { ...prev, ...patch });
    },
    async clearSourceState(_userId, kind) {
      store.sourceStates.delete(kind);
    },
    async setDemoSourceLinked(_userId, kind, linked) {
      const s = store.sources.find((x) => x.kind === kind);
      if (!s) return;
      s.status = linked ? 'linked' : 'not_linked';
      if (!linked) {
        s.stat = null;
        s.lastSyncedAt = null;
      }
    },

    async getDossier() {
      return structuredClone(store.dossier);
    },
    async getAggregates() {
      return structuredClone(store.aggregates);
    },
    async saveDossier(dossier, aggregates) {
      store.dossier = structuredClone(dossier);
      if (aggregates) store.aggregates = structuredClone(aggregates);
    },
    async forgetFact(_userId, factId) {
      const d = store.dossier;
      if (!d) return false;
      const idx = d.facts.findIndex((f) => f.id === factId);
      const patternIdx = d.patterns.findIndex((p) => p.id === factId);
      if (idx >= 0 || patternIdx >= 0) {
        const agg = store.aggregates ?? emptyAggregates();
        store.aggregates = { ...agg, forgotten: [...new Set([...agg.forgotten, factId])] };
      }
      if (idx >= 0) {
        const [removed] = d.facts.splice(idx, 1);
        d.sizeBytes = Math.max(0, d.sizeBytes - factBytes(removed));
        return true;
      }
      if (patternIdx >= 0) {
        const [removed] = d.patterns.splice(patternIdx, 1);
        d.sizeBytes = Math.max(0, d.sizeBytes - factBytes(removed));
        return true;
      }
      return false;
    },

    async addRawEvents(events) {
      const ids = new Set(events.map((e) => e.id));
      store.rawEvents = [...store.rawEvents.filter((e) => !ids.has(e.id)), ...structuredClone(events)];
    },
    async listRawEvents(_userId, since) {
      return structuredClone(since ? store.rawEvents.filter((e) => e.occurredAt >= since) : store.rawEvents);
    },
    async deleteRawEvents(_userId, kind) {
      const before = store.rawEvents.length;
      store.rawEvents = store.rawEvents.filter((e) => e.sourceKind !== kind);
      return before - store.rawEvents.length;
    },
    async purgeExpiredRawEvents(now) {
      const before = store.rawEvents.length;
      store.rawEvents = store.rawEvents.filter((e) => Date.parse(e.expiresAt) > now.getTime());
      return before - store.rawEvents.length;
    },

    async forgetEverything() {
      store.readings = [];
      store.unlistedReadings = 0;
      store.messages.clear();
      store.prophecies = [];
      store.dossier = null;
      store.aggregates = null;
      store.sourceStates.clear();
      store.rawEvents = [];
      for (const s of store.sources) {
        s.status = 'not_linked';
        s.stat = null;
        s.lastSyncedAt = null;
      }
    },
  };
}

const g = globalThis as typeof globalThis & { __morrowMemoryRepo?: Repository };

/** Process-wide singleton (route handlers and server components share it in dev). */
export function memoryRepository(): Repository {
  g.__morrowMemoryRepo ??= createMemoryRepository();
  return g.__morrowMemoryRepo;
}
