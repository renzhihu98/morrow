/**
 * Spotify Web API (`user-read-recently-played user-top-read`). Recently played returns at most 50 items,
 * so the hourly sync polls with the `after` cursor to accumulate history (SPEC §12.3).
 */
import { getJson, type FetchLike } from './errors';
import type { PlayPayload, TopItemsPayload } from './types';

const API = 'https://api.spotify.com/v1';
const MAX_PAGES = 5;

type SpotifyArtist = { id: string; name: string };
type SpotifyTrack = { id: string; name: string; duration_ms: number; artists: SpotifyArtist[] };

export type SpotifyPlayHistory = { track: SpotifyTrack; played_at: string };

type RecentlyPlayedPage = {
  items: SpotifyPlayHistory[];
  next: string | null;
  cursors: { after: string; before: string } | null;
};

type TopPage<T> = { items: T[] };

export type PlayItem = { playedAt: string; payload: PlayPayload };

export function toPlay(item: SpotifyPlayHistory): PlayItem | null {
  if (!item.track?.id || !item.played_at) return null;
  const artist = item.track.artists?.[0];
  return {
    playedAt: item.played_at,
    payload: {
      type: 'play',
      trackId: item.track.id,
      track: item.track.name,
      artist: artist?.name ?? 'Unknown',
      artistId: artist?.id ?? null,
      msPlayed: item.track.duration_ms ?? 0,
    },
  };
}

/**
 * Plays strictly after `afterMs` (oldest → newest). With no cursor Spotify returns the latest 50.
 * Follows `next` for a few pages when more than 50 accumulated since the last poll.
 */
export async function fetchRecentlyPlayed(accessToken: string, afterMs: number | null, fetchImpl?: FetchLike): Promise<PlayItem[]> {
  const plays: PlayItem[] = [];
  let url: string | null = `${API}/me/player/recently-played?limit=50${afterMs ? `&after=${afterMs}` : ''}`;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const body: RecentlyPlayedPage = await getJson<RecentlyPlayedPage>(url, accessToken, fetchImpl);
    for (const item of body.items ?? []) {
      const play = toPlay(item);
      if (play && (!afterMs || Date.parse(play.playedAt) > afterMs)) plays.push(play);
    }
    url = afterMs ? body.next : null;
  }
  const unique = new Map(plays.map((p) => [`${p.playedAt}:${p.payload.trackId}`, p]));
  return [...unique.values()].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
}

/** Short-term (≈4 weeks) top artists + tracks, and medium-term (≈6 months) artists to tell what's new in rotation. */
export async function fetchTopItems(accessToken: string, fetchImpl?: FetchLike): Promise<TopItemsPayload[]> {
  const [artists, tracks, settled] = await Promise.all([
    getJson<TopPage<SpotifyArtist>>(`${API}/me/top/artists?time_range=short_term&limit=10`, accessToken, fetchImpl),
    getJson<TopPage<SpotifyTrack>>(`${API}/me/top/tracks?time_range=short_term&limit=10`, accessToken, fetchImpl),
    getJson<TopPage<SpotifyArtist>>(`${API}/me/top/artists?time_range=medium_term&limit=20`, accessToken, fetchImpl),
  ]);
  return [
    { type: 'top_items', itemType: 'artists', timeRange: 'short_term', items: artists.items.map((a) => ({ id: a.id, name: a.name })) },
    {
      type: 'top_items',
      itemType: 'tracks',
      timeRange: 'short_term',
      items: tracks.items.map((t) => ({ id: t.id, name: t.name, artist: t.artists?.[0]?.name })),
    },
    { type: 'top_items', itemType: 'artists', timeRange: 'medium_term', items: settled.items.map((a) => ({ id: a.id, name: a.name })) },
  ];
}
