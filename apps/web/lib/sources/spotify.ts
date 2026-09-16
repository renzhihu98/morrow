import { buildAuthorizeUrl, NotImplementedError } from './oauth';
import type { SourceAdapter } from './types';

/** Spotify Web API (recently played, top items). */
export const spotifyAdapter: SourceAdapter = {
  kind: 'spotify',
  authorizeUrl(state, redirectUri) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    if (!clientId) return null;
    return buildAuthorizeUrl('https://accounts.spotify.com/authorize', {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'user-read-recently-played user-top-read',
      state,
    });
  },
  async exchangeCode() {
    // TODO(oauth): POST https://accounts.spotify.com/api/token (basic auth with client secret).
    throw new NotImplementedError('Spotify token exchange');
  },
  async sync() {
    // TODO(sync): GET /v1/me/player/recently-played?after=<since> → PlayPayload (track id, artist, ms played).
    throw new NotImplementedError('Spotify sync');
  },
};
