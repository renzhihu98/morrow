import type { SourceKind } from '@morrow/core';

/**
 * Raw, short-lived source data (TTL: RAW_EVENT_TTL_HOURS). Never shown to the LLM —
 * deterministic extractors distil it into dossier facts, then it is deleted.
 * Payloads keep only what Morrow needs: people as dossier contact keys, timing, no bodies.
 */
export type CalendarEventPayload = {
  type: 'calendar_event';
  eventId: string;
  title: string;
  /** Dossier contact keys, e.g. `sam`. */
  attendees: string[];
  start: string;
  end: string;
  status: 'confirmed' | 'cancelled';
  /** Previous start when the event was moved; null if never moved. */
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
  artist: string;
  msPlayed: number;
};

export type RawEventPayload = CalendarEventPayload | EmailPayload | PlayPayload;

export type RawEvent = {
  id: string;
  userId: string;
  sourceKind: SourceKind;
  occurredAt: string;
  payload: RawEventPayload;
  expiresAt: string;
};

export type OAuthTokens = { accessToken: string; refreshToken: string | null; expiresAt: string | null };

/** A connectable data source. Implementations live next to this file. */
export interface SourceAdapter {
  kind: SourceKind;
  /** OAuth authorize URL, or null when the provider isn't configured (demo mode). */
  authorizeUrl(state: string, redirectUri: string): string | null;
  /** Exchange the OAuth callback code for tokens. */
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  /** Fetch events since `since` and map them to RawEvent payloads. */
  sync(tokens: OAuthTokens, since: Date, userId: string): Promise<RawEvent[]>;
}
