import type { SourceKind } from '@morrow/core';
import { and, eq } from 'drizzle-orm';
import { getAuth } from '../auth/auth';
import { sourceKindForAccount } from '../auth/grants';
import { getDb } from '../db/client';
import { accounts } from '../db/schema';
import { SourceAuthError } from './errors';

export const PROVIDER_FOR: Partial<Record<SourceKind, 'google' | 'spotify'>> = { calendar: 'google', spotify: 'spotify' };

/** The Better Auth account row granting `kind` for this user, if any. */
export async function findSourceAccount(userId: string, kind: SourceKind) {
  const providerId = PROVIDER_FOR[kind];
  if (!providerId) return null;
  const rows = await getDb()
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, providerId)));
  return rows.find((a) => sourceKindForAccount(a) === kind && (a.accessToken || a.refreshToken)) ?? null;
}

/**
 * A valid provider access token for the source, refreshed and re-encrypted by Better Auth when it is about
 * to expire. Any failure to obtain one means the grant is unusable → SourceAuthError (needs_reauth).
 */
export async function getSourceAccessToken(userId: string, kind: SourceKind): Promise<string> {
  const account = await findSourceAccount(userId, kind);
  if (!account) throw new SourceAuthError(`${kind} is not linked`);
  try {
    const tokens = await getAuth().api.getAccessToken({ body: { accountId: account.id, userId } });
    if (!tokens?.accessToken) throw new Error('empty access token');
    return tokens.accessToken;
  } catch (e) {
    throw new SourceAuthError(`could not refresh ${kind} token: ${e instanceof Error ? e.message : String(e)}`);
  }
}
