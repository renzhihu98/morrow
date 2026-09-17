import type { SourceKind } from '@morrow/core';
import { SOURCE_OAUTH } from '@morrow/core';

type AccountLike = { userId: string; providerId: string; scope?: string | null };

/** Which Morrow sources a Better Auth account row grants (one Google account can grant Calendar and Mail). */
export function sourceKindsForAccount(account: AccountLike): SourceKind[] {
  const scopes = parseScopes(account.scope);
  if (account.providerId === 'spotify') return ['spotify'];
  if (account.providerId !== 'google') return [];
  return (['calendar', 'mail'] as const).filter((kind) => SOURCE_OAUTH[kind].scopes.every((s) => scopes.includes(s)));
}

export const parseScopes = (scope: string | null | undefined): string[] =>
  (scope ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Database hook for `accounts` create/update. When an OAuth callback grants a source, kick off its first
 * sync after the response is sent (Next `after()`), so the callback redirect stays fast.
 */
export async function onAccountGranted(account: AccountLike, path: string | null): Promise<void> {
  if (!path?.startsWith('/callback') && !path?.startsWith('/oauth2/callback')) return;
  const kinds = sourceKindsForAccount(account);
  if (kinds.length === 0) return;
  const run = async () => {
    try {
      const { syncAfterConnect } = await import('../sources/sync');
      const { getRepository } = await import('../data');
      const repo = getRepository();
      // One Google grant can carry Calendar and Mail: only sync what this grant newly added (or needs a retry),
      // so connecting Mail doesn't wait behind a full Calendar resync. Sequential: each sync saves the aggregates.
      const states = await Promise.all(kinds.map((kind) => repo.getSourceState(account.userId, kind)));
      const fresh = kinds.filter((_, i) => !states[i] || states[i]!.syncState === 'needs_reauth' || states[i]!.syncState === 'error');
      for (const kind of fresh.length > 0 ? fresh : kinds) await syncAfterConnect(account.userId, kind);
    } catch (e) {
      console.error('[morrow] on-connect sync failed', e);
    }
  };
  try {
    const { after } = await import('next/server');
    after(run);
  } catch {
    void run();
  }
}
