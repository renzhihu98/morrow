/**
 * Google Calendar (read-only, `calendar.readonly`). SPEC §12.3: events from the last 90 days and next 30,
 * `singleEvents=true`, and only the whitelisted fields — requested with the `fields` parameter so the rest
 * (descriptions, attachments, conferencing, locations) never leaves Google.
 */
import { SourceSyncError, getJson, type FetchLike } from './errors';
import type { CalendarEventPayload, CalendarPerson } from './types';

export const CALENDAR_PAST_DAYS = 90;
export const CALENDAR_FUTURE_DAYS = 30;
const DAY_MS = 86_400_000;
const MAX_PAGES = 20;

export const CALENDAR_FIELDS =
  'nextPageToken,items(id,status,summary,start,end,created,updated,recurringEventId,originalStartTime,' +
  'organizer(email,displayName,self),attendees(email,displayName,responseStatus,self,resource))';

type GTime = { dateTime?: string; date?: string; timeZone?: string };
type GPerson = { email?: string; displayName?: string; responseStatus?: string; self?: boolean; resource?: boolean };

/** One item of `events.list` restricted to CALENDAR_FIELDS. */
export type GoogleCalendarEvent = {
  id: string;
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

/** Maps a Calendar API item to the whitelisted raw payload. Returns null for items without timing. */
export function toCalendarPayload(item: GoogleCalendarEvent): CalendarEventPayload | null {
  const start = timeOf(item.start ?? item.originalStartTime);
  const end = timeOf(item.end) ?? start;
  if (!item.id || !start || !end) return null;

  const people: CalendarPerson[] = (item.attendees ?? [])
    .filter((a) => !a.self && !a.resource && !a.email?.endsWith('resource.calendar.google.com'))
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
  const self = item.attendees?.find((a) => a.self);
  return {
    type: 'calendar_event',
    eventId: item.id,
    title: (item.summary ?? '').slice(0, 120),
    attendees: [...new Set(people.map((p) => p.key))],
    people,
    organizer: item.organizer
      ? { email: item.organizer.email ?? null, displayName: item.organizer.displayName ?? null, self: Boolean(item.organizer.self) }
      : null,
    start,
    end,
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
    created: item.created ?? null,
    updated: item.updated ?? null,
    status: item.status ?? 'confirmed',
    selfResponse: RESPONSE.has(self?.responseStatus ?? '') ? (self?.responseStatus as CalendarPerson['responseStatus']) : null,
    recurringEventId: item.recurringEventId ?? null,
    originalStart,
    // A recurring instance whose start differs from its original slot was moved.
    movedFrom: originalStart && Date.parse(originalStart) !== Date.parse(start) ? originalStart : null,
  };
}

/** `events.list` on the primary calendar over the sync window, following `nextPageToken`. */
export async function fetchCalendarEvents(
  accessToken: string,
  now: Date,
  fetchImpl?: FetchLike,
): Promise<GoogleCalendarEvent[]> {
  const items: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
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
