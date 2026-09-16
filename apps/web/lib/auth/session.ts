import { FIXTURE_NOW_ISO, fixtures, type AccountUser, type User } from '@morrow/core';
import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { DEFAULT_TIMEZONE } from '../data/drizzle';
import { hasDatabase } from '../server/env';
import { apiError } from '../server/http';
import { getAuth } from './auth';

/** Auth is on whenever there is a database (SPEC §12.2). Demo mode has one implicit person. */
export const isAuthEnabled = hasDatabase;

export type SessionUser = AccountUser & { firstName: string };

const DEMO_USER: SessionUser = {
  id: fixtures.user.id,
  name: fixtures.user.name,
  firstName: fixtures.user.name,
  email: 'iris@demo.morrow',
  image: null,
  timezone: fixtures.user.timezone,
  onboardedAt: FIXTURE_NOW_ISO,
};

/** Shape the readings layer uses (`User` from @morrow/core). */
export const toCoreUser = (u: SessionUser): User => ({ id: u.id, name: u.firstName, timezone: u.timezone });

/** The signed-in person, or null. In demo mode (no DATABASE_URL) always the fixture user. */
export async function getSessionUser(requestHeaders?: Headers): Promise<SessionUser | null> {
  if (!isAuthEnabled()) return DEMO_USER;
  const session = await getAuth().api.getSession({ headers: requestHeaders ?? (await nextHeaders()) });
  if (!session) return null;
  const u = session.user as typeof session.user & { timezone?: string | null; onboardedAt?: Date | string | null };
  const onboardedAt = u.onboardedAt ? new Date(u.onboardedAt).toISOString() : null;
  return {
    id: u.id,
    name: u.name,
    firstName: u.name.split(/\s+/)[0] || u.name,
    email: u.email,
    image: u.image ?? null,
    timezone: u.timezone || DEFAULT_TIMEZONE,
    onboardedAt,
  };
}

export const toAccountUser = ({ firstName: _f, ...u }: SessionUser): AccountUser => u;

/** Request-scoped (deduped across layout + page) session lookup for server components. */
export const currentUser = cache(() => getSessionUser());

const UNAUTHORIZED = () => apiError('unauthorized', 'Sign in to talk to Morrow.');

/**
 * Route-handler guard: `authed(async (user, req, ctx) => …)`. Unauthenticated → `401 { error: { code: "unauthorized" } }`.
 * Unexpected throws become `server_error` (same as `handle`).
 */
export function authed<A extends [Request, ...unknown[]]>(fn: (user: SessionUser, ...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      const user = await getSessionUser(args[0].headers);
      if (!user) return UNAUTHORIZED();
      return await fn(user, ...args);
    } catch (e) {
      console.error('[morrow] api error', e);
      return apiError('server_error', 'Something went wrong on our side.');
    }
  };
}

/**
 * Page guard for the app screens: no session → /sign-in; not onboarded → /welcome/sources.
 * Pass `{ onboarding: true }` from onboarding pages to skip the onboarding redirect.
 */
export async function requirePageUser(options: { onboarding?: boolean } = {}): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  if (!options.onboarding && !user.onboardedAt) redirect('/welcome/sources');
  return user;
}
