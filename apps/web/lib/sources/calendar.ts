import { RAW_EVENT_TTL_HOURS } from '@morrow/core';
import { buildAuthorizeUrl, NotImplementedError } from './oauth';
import type { SourceAdapter } from './types';

/** Google Calendar (read-only). */
export const calendarAdapter: SourceAdapter = {
  kind: 'calendar',
  authorizeUrl(state, redirectUri) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return null;
    return buildAuthorizeUrl('https://accounts.google.com/o/oauth2/v2/auth', {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
      state,
    });
  },
  async exchangeCode() {
    // TODO(oauth): POST https://oauth2.googleapis.com/token, encrypt tokens with TOKEN_ENCRYPTION_KEY.
    throw new NotImplementedError('Google Calendar token exchange');
  },
  async sync() {
    // TODO(sync): events.list (updatedMin = since, showDeleted) → CalendarEventPayload.
    //  - attendees → dossier contact keys (email → contact map, never store addresses in facts)
    //  - movedFrom from the previous synced start of the same eventId
    //  - expiresAt = occurredAt + RAW_EVENT_TTL_HOURS
    void RAW_EVENT_TTL_HOURS;
    throw new NotImplementedError('Google Calendar sync');
  },
};
