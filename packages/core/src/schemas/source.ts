import { z } from 'zod';
import { IsoDateTime } from './common';

export const SourceKind = z.enum(['calendar', 'spotify', 'mail', 'instagram']);
export type SourceKind = z.infer<typeof SourceKind>;

export const SourceStatus = z.enum(['linked', 'not_linked', 'error']);
export type SourceStatus = z.infer<typeof SourceStatus>;

/**
 * Sync state of a linked source (v0.2, optional for backward compatibility).
 * `needs_reauth`: the provider rejected the stored grant — reconnect the source.
 */
export const SourceSyncState = z.enum(['pending', 'syncing', 'ok', 'needs_reauth', 'error']);
export type SourceSyncState = z.infer<typeof SourceSyncState>;

export const Source = z.object({
  kind: SourceKind,
  /** Display name, e.g. "Calendar". */
  name: z.string(),
  /** Provider, e.g. "Google", "Gmail". */
  provider: z.string(),
  status: SourceStatus,
  /** What Morrow reads from it, e.g. "Moods, late nights, the songs you return to." */
  reads: z.string(),
  /** Headline stat, e.g. { value: 214, label: "events" }. Null when not linked / not applicable. */
  stat: z.object({ value: z.number().int().nonnegative(), label: z.string() }).nullable(),
  /** Number of open prophecies watching this source. */
  watchingCount: z.number().int().nonnegative(),
  lastSyncedAt: IsoDateTime.nullable(),
  /** v0.2: sync state for linked sources (absent in demo fixtures). */
  syncState: SourceSyncState.optional(),
  /** v0.2: events Morrow has distilled from this source (calendar events in window, Spotify plays). */
  eventCount: z.number().int().nonnegative().optional(),
});
export type Source = z.infer<typeof Source>;
