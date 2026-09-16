import { SOURCE_OAUTH, type SourceKind } from '@morrow/core';
import { and, eq } from 'drizzle-orm';
import { getAuth } from '../auth/auth';
import { parseScopes } from '../auth/grants';
import { getDb } from '../db/client';
import { accounts } from '../db/schema';
import { getRepository } from '../data';
import { findSourceAccount } from './tokens';

/**
 * Unlinks a source grant (SPEC §12.3 "Disconnect = unlink account + delete that source's raw events + rebuild").
 * - Spotify: the account row is deleted (Spotify is never a sign-in method).
 * - Calendar: the Google account is also the sign-in, so the grant is revoked at Google and the stored tokens
 *   and calendar scope are removed instead of deleting the account.
 * With `purge`, raw events/sync state are removed too (callers that rebuild the dossier pass false and purge).
 */
export async function disconnectSource(userId: string, kind: SourceKind, { purge }: { purge: boolean }): Promise<void> {
  const account = await findSourceAccount(userId, kind);
  const db = getDb();
  if (account) {
    if (kind === 'spotify') {
      await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'spotify')));
    } else if (kind === 'calendar') {
      try {
        const { accessToken } = await getAuth().api.getAccessToken({ body: { accountId: account.id, userId } });
        if (accessToken) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
          });
        }
      } catch (e) {
        console.warn('[morrow] google revoke failed (tokens are dropped anyway)', e);
      }
      const remove = new Set<string>(SOURCE_OAUTH.calendar.scopes);
      const scope = parseScopes(account.scope).filter((s) => !remove.has(s)).join(',');
      await db
        .update(accounts)
        .set({ accessToken: null, refreshToken: null, idToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null, scope, updatedAt: new Date() })
        .where(eq(accounts.id, account.id));
    }
  }
  if (purge) {
    const repo = getRepository();
    await repo.deleteRawEvents(userId, kind);
    await repo.clearSourceState(userId, kind);
  }
}
