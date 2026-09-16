/**
 * Google Calendar (read-only, `calendar.readonly`). SPEC §12.3: events from the last 90 days and next 30 on every
 * calendar in the user's list (except Google-generated ones and free/busy-only calendars), `singleEvents=true`,
 * and only the whitelisted fields — requested with the `fields` parameter so the rest (descriptions,
 * attachments, conferencing, locations, calendar names) never leaves Google.
 */
import { SourceAuthError, SourceSyncError, getJson, type FetchLike } from './errors';
import type { CalendarAccessRole, CalendarEventPayload, CalendarPerson } from './types';

export const CALENDAR_PAST_DAYS = 90;
export const CALENDAR_FUTURE_DAYS = 30;
const DAY_MS = 86_400_000;
const MAX_PAGES = 20;

const MAX_LIST_PAGES = 10;
const CALENDAR_CONCURRENCY = 4;

export const CALENDAR_FIELDS =
  'nextPageToken,items(id,iCalUID,status,summary,start,end,created,updated,recurringEventId,originalStartTime,' +
  'organizer(email,displayName,self),attendees(email,displayName,responseStatus,self,resource))';

/** calendarList whitelist: ids and roles only (never calendar names or descriptions). */
export const CALENDAR_LIST_FIELDS = 'nextPageToken,items(id,accessRole,primary,deleted)';

type GTime = { dateTime?: string; date?: string; timeZone?: string };
type GPerson = { email?: string; displayName?: string; responseStatus?: string; self?: boolean; resource?: boolean };

/** One item of `events.list` restricted to CALENDAR_FIELDS. */
export type GoogleCalendarEvent = {
  id: string;
  iCalUID?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  start?: GTime;
  end?: GTime;
  created?: string;
  updated?: string;
  recurringEventId?: string;
  originalStartTime?: GTime;
  organizer?: GPerson;
  attendees?: GPerson[];
};

type EventsPage = { items?: GoogleCalendarEvent[]; nextPageToken?: string };

export type GoogleCalendarListEntry = { id: string; accessRole?: CalendarAccessRole; primary?: boolean; deleted?: boolean };
type CalendarListPage = { items?: GoogleCalendarListEntry[]; nextPageToken?: string };

/** Where an event copy was read from. `selfEmails` identify the user (the primary calendar id is their address). */
export type CalendarSource = { calendarId: string; accessRole: CalendarAccessRole; primary: boolean; selfEmails: string[] };

/**
 * Stable dossier key for a person: display name if present, else the email local part.
 * `Sam Lee` → `sam_lee`, `sam@studio.co` → `sam`.
 */
export function contactKey(p: { email?: string | null; displayName?: string | null }): string | null {
  const raw = p.displayName?.trim() || p.email?.split('@')[0]?.replace(/[._+-]+/g, ' ') || '';
  const key = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || null;
}

/** All-day `2026-09-30` → midnight UTC ISO; timed → as given (RFC 3339 with offset). */
const timeOf = (t: GTime | undefined): string | null => (t?.dateTime ? t.dateTime : t?.date ? `${t.date}T00:00:00Z` : null);

const RESPONSE = new Set(['needsAction', 'declined', 'tentative', 'accepted']);

/** Owner/writer calendars hold the user's own time; reader calendars are other people's. */
export const isOwnCalendarRole = (role: CalendarAccessRole | undefined) => role === undefined || role === 'owner' || role === 'writer';

/**
 * Maps a Calendar API item to the whitelisted raw payload. Returns null for items without timing.
 * Google's `self` flags mean "the calendar this copy is on", not the signed-in user — on someone else's calendar
 * they mark that person — so the user is matched by `source.selfEmails` there.
 */
export function toCalendarPayload(item: GoogleCalendarEvent, source?: CalendarSource): CalendarEventPayload | null {
  const start = timeOf(item.start ?? item.originalStartTime);
  const end = timeOf(item.end) ?? start;
  if (!item.id || !start || !end) return null;

  const own = isOwnCalendarRole(source?.accessRole);
  const selfEmails = new Set((source?.selfEmails ?? []).map((e) => e.toLowerCase()));
  const isUser = (p: GPerson | undefined) =>
    Boolean(p && ((p.email && selfEmails.has(p.email.toLowerCase())) || (own && p.self)));

  const people: CalendarPerson[] = (item.attendees ?? [])
    .filter((a) => !isUser(a) && !(own && a.self) && !a.resource && !a.email?.endsWith('resource.calendar.google.com'))
    .flatMap((a) => {
      const key = contactKey(a);
      return key
        ? [
            {
              key,
              email: a.email ?? null,
              displayName: a.displayName ?? null,
              responseStatus: RESPONSE.has(a.responseStatus ?? '') ? (a.responseStatus as CalendarPerson['responseStatus']) : null,
            },
          ]
        : [];
    });

  const originalStart = timeOf(item.originalStartTime);
  const self = item.attendees?.find(isUser);
  const organizerIsUser = isUser(item.organizer);
  const selfResponse = RESPONSE.has(self?.responseStatus ?? '') ? (self?.responseStatus as CalendarPerson['responseStatus']) : null;
  return {
    type: 'calendar_event',
    eventId: item.id,
    title: (item.summary ?? '').slice(0, 120),
    attendees: [...new Set(people.map((p) => p.key))],
    people,
    organizer: item.organizer
      ? { email: item.organizer.email ?? null, displayName: item.organizer.displayName ?? null, self: organizerIsUser }
      : null,
    start,
    end,
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
    created: item.created ?? null,
    updated: item.updated ?? null,
    status: item.status ?? 'confirmed',
    selfResponse,
    recurringEventId: item.recurringEventId ?? null,
    originalStart,
    // A recurring instance whose start differs from its original slot was moved.
    movedFrom: originalStart && Date.parse(originalStart) !== Date.parse(start) ? originalStart : null,
    ...(source
      ? {
          calendarId: source.calendarId,
          accessRole: source.accessRole,
          iCalUID: item.iCalUID ?? null,
          shared: !own,
          selfInvolved: own || Boolean(self) || organizerIsUser,
        }
      : {}),
  };
}

export type CalendarSkipReason = 'holidays' | 'birthdays' | 'week_numbers' | 'generated' | 'free_busy_only' | 'forbidden' | 'not_found';

export type CalendarSyncSummary = {
  /** Calendars in the user's list. */
  found: number;
  /** Calendars whose events were read. */
  used: number;
  skipped: Partial<Record<CalendarSkipReason, number>>;
  /** Calendars read, by access role (owner/writer = the user's own time; reader = someone else's calendar). */
  roles: Partial<Record<CalendarAccessRole, number>>;
};

/** Why a calendar-list entry is not read, or null to read it. */
export function calendarSkipReason(entry: GoogleCalendarListEntry): CalendarSkipReason | null {
  const id = entry.id.toLowerCase();
  if (id.endsWith('#holiday@group.v.calendar.google.com')) return 'holidays';
  if (id.endsWith('#contacts@group.v.calendar.google.com')) return 'birthdays';
  if (id.endsWith('#weeknum@group.v.calendar.google.com')) return 'week_numbers';
  // Other Google-generated calendars (sports, phases of the moon, …) live on the same `.v.` domain.
  if (id.endsWith('.v.calendar.google.com')) return 'generated';
  if (entry.accessRole === 'freeBusyReader') return 'free_busy_only';
  return null;
}

/** `calendarList.list` (ids + roles), following `nextPageToken`. */
export async function fetchCalendarList(accessToken: string, fetchImpl?: FetchLike): Promise<GoogleCalendarListEntry[]> {
  const entries: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('fields', CALENDAR_LIST_FIELDS);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const body = await getJson<CalendarListPage>(url.toString(), accessToken, fetchImpl);
    entries.push(...(body.items ?? []).filter((e) => e.id && !e.deleted));
    pageToken = body.nextPageToken;
    if (!pageToken) return entries;
  }
  return entries;
}

/** `events.list` on one calendar over the sync window, following `nextPageToken`. */
export async function fetchCalendarEventsFor(
  accessToken: string,
  calendarId: string,
  now: Date,
  fetchImpl?: FetchLike,
): Promise<GoogleCalendarEvent[]> {
  const items: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('showDeleted', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '2500');
    url.searchParams.set('timeMin', new Date(now.getTime() - CALENDAR_PAST_DAYS * DAY_MS).toISOString());
    url.searchParams.set('timeMax', new Date(now.getTime() + CALENDAR_FUTURE_DAYS * DAY_MS).toISOString());
    url.searchParams.set('fields', CALENDAR_FIELDS);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const body = await getJson<EventsPage>(url.toString(), accessToken, fetchImpl);
    items.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    if (!pageToken) return items;
  }
  throw new SourceSyncError(`Calendar returned more than ${MAX_PAGES} pages`);
}

const ROLE_RANK: Record<CalendarAccessRole, number> = { owner: 0, writer: 1, reader: 2, freeBusyReader: 3 };

/**
 * One copy per meeting: the same event shows up on every calendar it's on (same iCalUID + start). The copy on
 * the user's own calendar wins (primary first), so an invitation mirrored on a colleague's shared calendar still
 * counts as the user's time.
 */
export function dedupeCalendarEvents(events: CalendarEventPayload[]): CalendarEventPayload[] {
  const rank = (e: CalendarEventPayload) =>
    (e.calendarId && e.accessRole ? ROLE_RANK[e.accessRole] * 2 : 0) + (e.selfInvolved === false ? 1 : 0);
  const best = new Map<string, CalendarEventPayload>();
  for (const e of events) {
    const key = `${e.iCalUID || e.eventId}|${Date.parse(e.originalStart ?? e.start)}`;
    const current = best.get(key);
    if (!current || rank(e) < rank(current)) best.set(key, e);
  }
  return [...best.values()];
}

/**
 * Every readable calendar's events over the sync window, mapped to whitelisted payloads and deduped.
 * A calendar that answers 403/404 is skipped; a rejected grant (401, or 403 on the calendar list) throws
 * SourceAuthError for the whole source.
 */
export async function fetchCalendarEvents(
  accessToken: string,
  now: Date,
  fetchImpl?: FetchLike,
): Promise<{ events: CalendarEventPayload[]; fetched: number; calendars: CalendarSyncSummary }> {
  const list = await fetchCalendarList(accessToken, fetchImpl);
  const primary = list.find((c) => c.primary);
  const selfEmails = primary?.id.includes('@') ? [primary.id] : [];
  const summary: CalendarSyncSummary = { found: list.length, used: 0, skipped: {}, roles: {} };
  const skip = (reason: CalendarSkipReason) => (summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1);

  const readable = list.filter((c) => {
    const reason = calendarSkipReason(c);
    if (reason) skip(reason);
    return !reason;
  });
  // Primary first so its copies are seen first; order is otherwise stable.
  readable.sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)));

  const payloads: CalendarEventPayload[] = [];
  let fetched = 0;
  for (let i = 0; i < readable.length; i += CALENDAR_CONCURRENCY) {
    const batch = readable.slice(i, i + CALENDAR_CONCURRENCY);
    type Result = { calendar: GoogleCalendarListEntry; items: GoogleCalendarEvent[] } | { calendar: GoogleCalendarListEntry; skipped: CalendarSkipReason };
    const results = await Promise.all(
      batch.map(async (calendar): Promise<Result> => {
        try {
          return { calendar, items: await fetchCalendarEventsFor(accessToken, calendar.id, now, fetchImpl) };
        } catch (e) {
          if (e instanceof SourceAuthError && e.status === 403) return { calendar, skipped: 'forbidden' };
          if (e instanceof SourceSyncError && e.status === 404) return { calendar, skipped: 'not_found' };
          throw e;
        }
      }),
    );
    for (const r of results) {
      if ('skipped' in r) {
        skip(r.skipped);
        continue;
      }
      summary.used += 1;
      fetched += r.items.length;
      const role = r.calendar.accessRole ?? 'reader';
      summary.roles[role] = (summary.roles[role] ?? 0) + 1;
      const source: CalendarSource = {
        calendarId: r.calendar.id,
        accessRole: r.calendar.accessRole ?? 'reader',
        primary: Boolean(r.calendar.primary),
        selfEmails,
      };
      for (const item of r.items) {
        const payload = toCalendarPayload(item, source);
        if (payload) payloads.push(payload);
      }
    }
  }
  // Every calendar refused: the grant itself is the problem, not one shared calendar.
  if (summary.used === 0 && (summary.skipped.forbidden ?? 0) > 0) throw new SourceAuthError('calendar rejected the grant (403)', 403);
  return { events: dedupeCalendarEvents(payloads), fetched, calendars: summary };
}
