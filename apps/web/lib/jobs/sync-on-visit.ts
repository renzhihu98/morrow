import type { User } from '@morrow/core';
import type { Repository } from '../data';
import { hasDatabase } from '../server/env';

const STALE_MS = 60 * 60 * 1000;
const g = globalThis as typeof globalThis & { __morrowVisitSync?: Set<string> };
const running = (g.__morrowVisitSync ??= new Set());

/**
 * Syncs the user's linked sources when any of them is more than an hour old (crons only run daily on Hobby).
 * Meant for `after()`: never throws, and one run per user at a time.
 */
export async function syncIfStale(repo: Repository, user: User, now: Date): Promise<void> {
  if (!hasDatabase() || running.has(user.id)) return;
  try {
    const sources = (await repo.listSources(user.id)).filter((s) => s.status !== 'not_linked' && s.syncState !== 'needs_reauth');
    const stale = sources.filter((s) => s.syncState !== 'syncing' && (!s.lastSyncedAt || now.getTime() - Date.parse(s.lastSyncedAt) > STALE_MS));
    if (stale.length === 0) return;
    running.add(user.id);
    const { syncUser } = await import('../sources/sync');
    await syncUser(repo, user, now, { kinds: stale.map((s) => s.kind) });
  } catch (e) {
    console.error('[morrow] sync on visit failed', e);
  } finally {
    running.delete(user.id);
  }
}
