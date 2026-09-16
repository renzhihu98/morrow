import type { SourceKind } from '@morrow/core';

/**
 * Raw, short-lived source data (TTL: RAW_EVENT_TTL_HOURS). Never shown to the LLM —
 * deterministic extractors fold it into dossier aggregates, then it is deleted.
 * Payloads keep only the SPEC §12.3 field whitelist: timing, people, status — never bodies,
 * descriptions, attachments or conferencing notes.
 */
export type CalendarPerson = {
  /** Dossier contact key, e.g. `sam` (see `contactKey`). */
  key: string;
  email: string | null;
  displayName: string | null;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted' | null;
};

export type CalendarEventPayload = {
  type: 'calendar_event';
  eventId: string;
  /** Event summary (title). */
  title: string;
  /** Contact keys of the other attendees (never the user). */
  attendees: string[];
  people?: CalendarPerson[];
  organizer?: { email: string | null; displayName: string | null; self: boolean } | null;
  start: string;
  end: string;
  allDay?: boolean;
  created?: string | null;
  updated?: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
  /** The user's own RSVP (null when they organise or weren't listed). */
  selfResponse?: CalendarPerson['responseStatus'];
  recurringEventId?: string | null;
  /** For instances of recurring events: the slot this instance originally occupied. */
  originalStart?: string | null;
  /** Previous start when the event was moved; null if never moved (as far as Morrow can tell). */
  movedFrom: string | null;
};

export type EmailPayload = {
  type: 'email';
  threadId: string;
  /** Contact key of the other party. */
  contact: string;
  direction: 'inbound' | 'outbound';
  /** True when this message started the thread. */
  firstInThread: boolean;
};

export type PlayPayload = {
  type: 'play';
  trackId: string;
  track?: string;
  artist: string;
  artistId?: string | null;
  /** Track duration (Spotify does not report actual ms played). */
  msPlayed: number;
};

export type TopItemsPayload = {
  type: 'top_items';
  itemType: 'artists' | 'tracks';
  timeRange: 'short_term' | 'medium_term' | 'long_term';
  items: { id: string; name: string; artist?: string }[];
};

export type RawEventPayload = CalendarEventPayload | EmailPayload | PlayPayload | TopItemsPayload;

export type RawEvent = {
  id: string;
  userId: string;
  sourceKind: SourceKind;
  occurredAt: string;
  payload: RawEventPayload;
  expiresAt: string;
};
