/**
 * Source sync (SPEC §12.4): fetch → raw_events (TTL) → incremental aggregates → dossier rebuild.
 * Runs on connect (Better Auth account hook → `after()`), hourly from /api/cron/sync, and during onboarding.
 */
import { RAW_EVENT_TTL_HOURS, getReadingDate, type SourceKind, type User } from '@morrow/core';
import { getRepository, type Repository } from '../data';
import { calendarEventChanged, calendarEventCount, emptyAggregates, foldCalendar, foldSpotify, type DossierAggregates } from '../dossier/aggregates';
import { rebuildDossier } from '../dossier/build';
import { SourceAuthError, type FetchLike } from './errors';
import { fetchCalendarEvents, type CalendarSyncSummary } from './google-calendar';
import { fetchRecentlyPlayed, fetchTopItems, type PlayItem } from './spotify';
import type { PlayPayload, RawEvent } from './types';

export const SYNCABLE: SourceKind[] = ['calendar', 'spotify'];

export type SyncDeps = {
  getAccessToken: (userId: string, kind: SourceKind) => Promise<string>;
  fetch?: FetchLike;
};

export type SyncResult =
  | { kind: SourceKind; ok: true; fetched: number; stored: number; eventCount: number; calendars?: CalendarSyncSummary }
  | { kind: SourceKind; ok: false; state: 'needs_reauth' | 'error'; error: string };

const HOUR_MS = 3_600_000;

async function defaultDeps(): Promise<SyncDeps> {
  const { getSourceAccessToken } = await import('./tokens');
  return { getAccessToken: getSourceAccessToken };
}

/** Syncs one source into `agg` (mutated) and raw_events; records sync state. Never throws. */
export async function syncSource(
  repo: Repository,
  user: User,
  kind: SourceKind,
  now: Date,
  agg: DossierAggregates,
  deps: SyncDeps,
): Promise<SyncResult> {
  const expiresAt = new Date(now.getTime() + RAW_EVENT_TTL_HOURS * HOUR_MS).toISOString();
  const raw = (id: string, occurredAt: string, payload: RawEvent['payload']): RawEvent => ({
    id,
    userId: user.id,
    sourceKind: kind,
    occurredAt,
    payload,
    expiresAt,
  });
  await repo.updateSourceState(user.id, kind, { syncState: 'syncing' });

  try {
    const token = await deps.getAccessToken(user.id, kind);

    if (kind === 'calendar') {
      const { events, fetched, calendars } = await fetchCalendarEvents(token, now, deps.fetch);
      // Only new or changed events the user is part of are kept raw (for verification); the index holds the rest.
      const changed = events.filter((p) => p.selfInvolved !== false && calendarEventChanged(agg.calendar?.events[p.eventId], p));
      await repo.addRawEvents(changed.map((p) => raw(`cal:${user.id}:${p.eventId}:${Date.parse(p.updated ?? p.start)}`, p.start, p)));
      agg.calendar = foldCalendar(agg.calendar, events, now);
      const eventCount = calendarEventCount(agg.calendar);
      await repo.updateSourceState(user.id, kind, {
        syncState: 'ok',
        lastError: null,
        lastSyncedAt: now.toISOString(),
        eventCount,
        calendarCount: calendars.used,
      });
      return { kind, ok: true, fetched, stored: changed.length, eventCount, calendars };
    }

    if (kind === 'spotify') {
      if (!agg.spotify) {
        // Fresh (or upgraded) listening aggregates: refold the plays still in raw_events before polling.
        const kept = (await repo.listRawEvents(user.id))
          .filter((e) => e.sourceKind === 'spotify' && e.payload.type === 'play')
          .map((e): PlayItem => ({ playedAt: e.occurredAt, payload: e.payload as PlayPayload }));
        if (kept.length > 0) agg.spotify = foldSpotify(null, kept, null, now);
      }
      const afterMs = agg.spotify?.cursorMs || null;
      const [plays, top] = await Promise.all([fetchRecentlyPlayed(token, afterMs, deps.fetch), fetchTopItems(token, deps.fetch)]);
      const date = getReadingDate(now, user.timezone);
      await repo.addRawEvents([
        ...plays.map((p) => raw(`sp:${user.id}:${Date.parse(p.playedAt)}:${p.payload.trackId}`, p.playedAt, p.payload)),
        ...top.map((t) => raw(`sp-top:${user.id}:${date}:${t.itemType}:${t.timeRange}`, now.toISOString(), t)),
      ]);
      agg.spotify = foldSpotify(agg.spotify, plays, top, now);
      const eventCount = agg.spotify.plays;
      await repo.updateSourceState(user.id, kind, {
        syncState: 'ok',
        lastError: null,
        lastSyncedAt: now.toISOString(),
        eventCount,
        cursor: String(agg.spotify.cursorMs),
      });
      return { kind, ok: true, fetched: plays.length, stored: plays.length + top.length, eventCount };
    }

    return { kind, ok: false, state: 'error', error: `${kind} sync is not implemented` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const state = e instanceof SourceAuthError ? 'needs_reauth' : 'error';
    console.error(`[morrow] ${kind} sync failed for ${user.id}: ${message}`);
    await repo.updateSourceState(user.id, kind, { syncState: state, lastError: message.slice(0, 500) });
    return { kind, ok: false, state, error: message };
  }
}

/** Syncs the user's linked sources (or `kinds`), then rebuilds the dossier from the updated aggregates. */
export async function syncUser(
  repo: Repository,
  user: User,
  now: Date,
  options: { kinds?: SourceKind[]; deps?: SyncDeps } = {},
): Promise<SyncResult[]> {
  const linked = (await repo.listSources(user.id))
    .filter((s) => s.status !== 'not_linked' && s.syncState !== 'needs_reauth' && SYNCABLE.includes(s.kind))
    .map((s) => s.kind);
  const kinds = options.kinds ? options.kinds.filter((k) => linked.includes(k)) : linked;
  if (kinds.length === 0) return [];
  const deps = options.deps ?? (await defaultDeps());
  const agg = (await repo.getAggregates(user.id)) ?? emptyAggregates();
  const results: SyncResult[] = [];
  for (const kind of kinds) results.push(await syncSource(repo, user, kind, now, agg, deps));
  if (results.some((r) => r.ok)) await rebuildDossier(repo, user, now, agg);
  return results;
}

/** First sync right after an OAuth grant lands (called from `after()`). */
export async function syncAfterConnect(userId: string, kind: SourceKind): Promise<void> {
  const repo = getRepository();
  const user = await repo.getUser(userId);
  if (!user) return;
  // A fresh grant clears a previous needs_reauth.
  await repo.updateSourceState(userId, kind, { syncState: 'pending', lastError: null });
  await syncUser(repo, user, new Date(), { kinds: [kind] });
}

/** Disconnect bookkeeping: drop raw events + aggregates for the source and rebuild the dossier. */
export async function purgeSource(repo: Repository, user: User, kind: SourceKind, now: Date): Promise<void> {
  await repo.deleteRawEvents(user.id, kind);
  await repo.clearSourceState(user.id, kind);
  const agg = (await repo.getAggregates(user.id)) ?? emptyAggregates();
  if (kind === 'calendar') agg.calendar = null;
  if (kind === 'spotify') agg.spotify = null;
  await rebuildDossier(repo, user, now, agg);
}
