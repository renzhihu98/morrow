import type { SourceKind } from '@morrow/core';
import { SOURCE_OAUTH } from '@morrow/core';

type AccountLike = { userId: string; providerId: string; scope?: string | null };

/** Which Morrow source (if any) a Better Auth account row grants. */
export function sourceKindForAccount(account: AccountLike): SourceKind | null {
  const scopes = parseScopes(account.scope);
  if (account.providerId === 'spotify') return 'spotify';
  if (account.providerId === 'google' && SOURCE_OAUTH.calendar.scopes.every((s) => scopes.includes(s))) return 'calendar';
  return null;
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
  const kind = sourceKindForAccount(account);
  if (!kind) return;
  const run = async () => {
    try {
      const { syncAfterConnect } = await import('../sources/sync');
      await syncAfterConnect(account.userId, kind);
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
