/**
 * Incremental dossier aggregates (SPEC §12.4). Raw events live 24 hours; these compact folds of them are
 * stored with the dossier so reschedule counts, contact cadence, first-activity trends, late-night
 * listening and protected recurring slots survive the purge. Pure functions, no I/O, no LLM.
 */
import { getLocalParts, getReadingDate } from '@morrow/core';
import type { CalendarEventPayload, PlayPayload, TopItemsPayload } from '../sources/types';
import type { MailAggregates } from './mail';
import type { PursuitIndex } from './pursuits';

const DAY_MS = 86_400_000;
/** Calendar events older than this (by end) are dropped from the index. */
export const CALENDAR_RETENTION_DAYS = 180;
/** Hourly listening buckets are kept this long. */
export const LISTENING_RETENTION_DAYS = 60;
const MAX_MOVES = 300;
const MAX_ARTISTS = 60;

/** Compact per-event state (short keys: this is persisted per user). */
export type CalendarEventState = {
  /** start / end ISO */
  s: string;
  e: string;
  /** status: c confirmed · t tentative · x cancelled */
  st: 'c' | 't' | 'x';
  /** contact keys of other attendees */
  p: string[];
  /** title, truncated (verification of `titleIncludes`, pursuits, calendar search) */
  t?: string;
  /** details: description as plain text, trimmed */
  x?: string;
  /** location */
  l?: string;
  /** calendar id (name in `CalendarAggregates.calendars`) */
  k?: string;
  /** declined by the user */
  d?: true;
  /** all-day */
  a?: true;
  /** recurring series id */
  r?: string;
  /** original slot of a recurring instance */
  o?: string;
  /**
   * On someone else's calendar the user can only read (accessRole reader). Never the user's own time: excluded
   * from rhythms. People are only kept (`p`) when the user is an attendee or organiser.
   */
  sh?: true;
};

export type CalendarMove = { eventId: string; from: string; to: string; contacts: string[]; seriesId: string | null };

export type CalendarAggregates = {
  events: Record<string, CalendarEventState>;
  moves: CalendarMove[];
  /** contact key → display name (first seen) */
  names: Record<string, string>;
  /** calendar id → the calendar's name as the user sees it (latest sync) */
  calendars?: Record<string, string>;
};

/**
 * Plays inside one UTC hour. Stored as instants so the aggregates never depend on the person's timezone;
 * local days, first-activity minutes and late nights are derived at fact-build time (`listeningDays`).
 */
export type ListeningHour = {
  /** earliest play in this hour (ISO) */
  firstAt: string;
  count: number;
};

export type SpotifyAggregates = {
  /** `played_at` (ms) of the newest play already folded in — also the API `after` cursor. */
  cursorMs: number;
  plays: number;
  /** UTC hour (`2026-09-16T15`) → plays in that hour. Pruned after LISTENING_RETENTION_DAYS. */
  hours: Record<string, ListeningHour>;
  artists: Record<string, number>;
  /**
   * Top artists/tracks. `artists`/`tracks` are the short-term (≈4 weeks) lists; `settled` are medium-term
   * (≈6 months) artists, so "new in rotation" = short-term artists missing from `settled`.
   */
  top: { artists: string[]; tracks: string[]; settled?: string[]; at: string } | null;
};

/** Current aggregates shape. v1 stored Spotify days keyed in the timezone at fold time (see `normalizeAggregates`). */
export const AGGREGATES_VERSION = 2;

export type DossierAggregates = {
  version: typeof AGGREGATES_VERSION;
  /** Fact / pattern ids the person asked Morrow to forget — never rebuilt. */
  forgotten: string[];
  calendar: CalendarAggregates | null;
  spotify: SpotifyAggregates | null;
  /** Gmail messages (timing, people) and thread notes (`mail.ts`). Optional: added without a version bump. */
  mail?: MailAggregates | null;
  /** Calendar titles grouped into pursuits (`pursuits.ts`). Optional: added without a version bump. */
  pursuits?: PursuitIndex | null;
};

export const emptyAggregates = (): DossierAggregates => ({ version: AGGREGATES_VERSION, forgotten: [], calendar: null, spotify: null });

/**
 * Upgrades stored aggregates to the current version. v1 Spotify listening days baked in whatever timezone the
 * user had at sync time (often UTC before the browser reported one), so they are dropped: they refill from
 * raw_events and the next sync. Calendar aggregates hold instants only and are kept.
 */
export function normalizeAggregates(stored: unknown): DossierAggregates | null {
  if (!stored || typeof stored !== 'object') return null;
  const agg = stored as Partial<DossierAggregates> & { version?: number };
  if (agg.version === AGGREGATES_VERSION) return agg as DossierAggregates;
  return { version: AGGREGATES_VERSION, forgotten: agg.forgotten ?? [], calendar: agg.calendar ?? null, spotify: null, mail: agg.mail ?? null, pursuits: agg.pursuits ?? null };
}

const STATUS: Record<CalendarEventPayload['status'], CalendarEventState['st']> = { confirmed: 'c', tentative: 't', cancelled: 'x' };

/**
 * Folds a Calendar sync into the aggregates. Moves are detected two ways:
 * a recurring instance whose start differs from its original slot, and an event whose start changed
 * since the previous sync. Each (event, from) move is counted once.
 */
export function foldCalendar(prev: CalendarAggregates | null, events: CalendarEventPayload[], now: Date): CalendarAggregates {
  const agg: CalendarAggregates = prev
    ? { events: { ...prev.events }, moves: [...prev.moves], names: { ...prev.names }, calendars: { ...prev.calendars } }
    : { events: {}, moves: [], names: {}, calendars: {} };
  const seen = new Set(agg.moves.map((m) => `${m.eventId}|${Date.parse(m.from)}`));
  const addMove = (e: CalendarEventPayload, from: string) => {
    const key = `${e.eventId}|${Date.parse(from)}`;
    if (seen.has(key) || Date.parse(from) === Date.parse(e.start)) return;
    seen.add(key);
    agg.moves.push({ eventId: e.eventId, from, to: e.start, contacts: e.attendees, seriesId: e.recurringEventId ?? null });
  };

  for (const e of events) {
    const before = agg.events[e.eventId];
    const othersOnly = e.shared === true && !e.selfInvolved;
    if (e.status !== 'cancelled' && !e.allDay && !othersOnly) {
      if (e.movedFrom) addMove(e, e.movedFrom);
      if (before && before.st !== 'x' && Date.parse(before.s) !== Date.parse(e.start)) addMove(e, before.s);
    }
    for (const person of othersOnly ? [] : (e.people ?? [])) {
      if (person.displayName && !agg.names[person.key]) agg.names[person.key] = person.displayName;
    }
    const state: CalendarEventState = { s: e.start, e: e.end, st: STATUS[e.status] ?? 'c', p: othersOnly ? [] : e.attendees };
    if (e.shared) state.sh = true;
    if (e.calendarId) {
      state.k = e.calendarId;
      if (e.calendarName) agg.calendars![e.calendarId] = e.calendarName;
    }
    // What an event is about is only kept for events the user is part of.
    if (!othersOnly) {
      if (e.title) state.t = e.title.slice(0, 120);
      if (e.details) state.x = e.details;
      if (e.location) state.l = e.location;
    }
    if (e.selfResponse === 'declined') state.d = true;
    if (e.allDay) state.a = true;
    if (e.recurringEventId) state.r = e.recurringEventId;
    if (e.originalStart) state.o = e.originalStart;
    // Cancelled instances returned without attendees keep what we knew about them.
    if (e.status === 'cancelled' && before && !othersOnly && state.p.length === 0) state.p = before.p;
    agg.events[e.eventId] = state;
  }

  const cutoff = now.getTime() - CALENDAR_RETENTION_DAYS * DAY_MS;
  for (const [id, state] of Object.entries(agg.events)) if (Date.parse(state.e) < cutoff) delete agg.events[id];
  agg.moves = agg.moves.filter((m) => Date.parse(m.from) >= cutoff).slice(-MAX_MOVES);
  return agg;
}

const hourKey = (at: number) => new Date(at).toISOString().slice(0, 13);

/**
 * Folds newly played tracks (any order) into listening aggregates; plays at or before the cursor are ignored.
 * Timezone-independent: plays are bucketed by UTC hour.
 */
export function foldSpotify(
  prev: SpotifyAggregates | null,
  plays: { playedAt: string; payload: PlayPayload }[],
  top: TopItemsPayload[] | null,
  now: Date,
): SpotifyAggregates {
  const agg: SpotifyAggregates = prev
    ? { ...prev, hours: { ...prev.hours }, artists: { ...prev.artists } }
    : { cursorMs: 0, plays: 0, hours: {}, artists: {}, top: null };

  for (const play of [...plays].sort((a, b) => a.playedAt.localeCompare(b.playedAt))) {
    const at = Date.parse(play.playedAt);
    if (!Number.isFinite(at) || at <= agg.cursorMs) continue;
    agg.cursorMs = at;
    agg.plays += 1;
    const key = hourKey(at);
    const bucket = agg.hours[key];
    const iso = new Date(at).toISOString();
    agg.hours[key] = bucket
      ? { firstAt: Date.parse(bucket.firstAt) <= at ? bucket.firstAt : iso, count: bucket.count + 1 }
      : { firstAt: iso, count: 1 };
    agg.artists[play.payload.artist] = (agg.artists[play.payload.artist] ?? 0) + 1;
  }

  if (top) {
    const short = (itemType: TopItemsPayload['itemType']) => top.find((t) => t.itemType === itemType && t.timeRange === 'short_term');
    const settled = top.find((t) => t.itemType === 'artists' && t.timeRange === 'medium_term');
    agg.top = {
      artists: short('artists')?.items.map((i) => i.name) ?? agg.top?.artists ?? [],
      tracks: short('tracks')?.items.map((i) => (i.artist ? `${i.name} — ${i.artist}` : i.name)) ?? agg.top?.tracks ?? [],
      settled: settled?.items.map((i) => i.name) ?? agg.top?.settled ?? [],
      at: now.toISOString(),
    };
  }

  const oldest = hourKey(now.getTime() - LISTENING_RETENTION_DAYS * DAY_MS);
  for (const key of Object.keys(agg.hours)) if (key < oldest) delete agg.hours[key];
  agg.artists = Object.fromEntries(
    Object.entries(agg.artists)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ARTISTS),
  );
  return agg;
}

export type ListeningDay = {
  plays: number;
  /** plays between 23:00 and 04:00 local (belonging to this reading day) */
  late: number;
  /** earliest play between 04:00 and 23:00, minutes since local midnight */
  firstMin: number | null;
};

/**
 * Local listening days for `timeZone`, derived from the hourly buckets: reading date (04:00 boundary) →
 * plays, late-night plays and the first daytime play. A bucket is placed by its first play (exact for
 * whole-hour offsets).
 */
export function listeningDays(sp: SpotifyAggregates, timeZone: string): Record<string, ListeningDay> {
  const days: Record<string, ListeningDay> = {};
  for (const bucket of Object.values(sp.hours ?? {})) {
    const instant = new Date(bucket.firstAt);
    const date = getReadingDate(instant, timeZone);
    const day = (days[date] ??= { plays: 0, late: 0, firstMin: null });
    day.plays += bucket.count;
    const { hour, minute } = getLocalParts(instant, timeZone);
    if (hour >= 23 || hour < 4) day.late += bucket.count;
    else day.firstMin = day.firstMin === null ? hour * 60 + minute : Math.min(day.firstMin, hour * 60 + minute);
  }
  return days;
}

/** True when a synced event is new or differs from the indexed state (worth keeping as a raw event). */
export function calendarEventChanged(prev: CalendarEventState | undefined, e: CalendarEventPayload): boolean {
  if (!prev) return true;
  return (
    Date.parse(prev.s) !== Date.parse(e.start) ||
    Date.parse(prev.e) !== Date.parse(e.end) ||
    prev.st !== STATUS[e.status] ||
    prev.p.join(',') !== e.attendees.join(',') ||
    (prev.t ?? '') !== (e.title ?? '').slice(0, 120) ||
    (prev.x ?? null) !== (e.details ?? null) ||
    Boolean(prev.d) !== (e.selfResponse === 'declined')
  );
}

/** Calendar events currently in the index that count as "found" (not cancelled). */
export const calendarEventCount = (agg: CalendarAggregates | null) =>
  agg ? Object.values(agg.events).filter((e) => e.st !== 'x').length : 0;
