import { buildAuthorizeUrl, NotImplementedError } from './oauth';
import type { SourceAdapter } from './types';

/**
 * Gmail — metadata only (senders and timing, never bodies).
 * Restricted scope: requires Google CASA review before public launch (SPEC §5.1).
 */
export const mailAdapter: SourceAdapter = {
  kind: 'mail',
  authorizeUrl(state, redirectUri) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return null;
    return buildAuthorizeUrl('https://accounts.google.com/o/oauth2/v2/auth', {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/gmail.metadata',
      state,
    });
  },
  async exchangeCode() {
    // TODO(oauth): shared Google token exchange with calendar.ts; request incremental scope.
    throw new NotImplementedError('Gmail token exchange');
  },
  async sync() {
    // TODO(sync): users.messages.list (q=after:<since>) + format=metadata (From, Date, threadId)
    //  → EmailPayload { contact, direction, firstInThread }. Map addresses to contact keys; drop the rest.
    throw new NotImplementedError('Gmail sync');
  },
};
