import { ForgetRequest } from '@morrow/core';
import { getAuth } from '@/lib/auth/auth';
import { authed, isAuthEnabled } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { apiError, ok } from '@/lib/server/http';
import { disconnectSource } from '@/lib/sources/connect';

/**
 * POST /api/forget `{ confirm: "FORGET" }` — deletes the account completely. Google grants are revoked first
 * (while the OAuth tokens still exist), the session is signed out, then the user row goes and everything cascades
 * with it. The response carries Better Auth's cookie-clearing headers, so the browser is signed out.
 */
export const POST = authed(async (user, req) => {
  const body = ForgetRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError('bad_request', 'Type FORGET to confirm.');
  const repo = getRepository();
  if (isAuthEnabled()) {
    for (const kind of ['mail', 'calendar', 'spotify'] as const) await disconnectSource(user.id, kind, { purge: false });
  }
  // Sign out first (removes the session and returns Set-Cookie headers that clear it), then delete the account.
  const signedOut = isAuthEnabled()
    ? await getAuth().api.signOut({ headers: req.headers, asResponse: true })
    : null;
  await repo.forgetEverything(user.id);

  const res = ok();
  for (const cookie of signedOut?.headers.getSetCookie() ?? []) res.headers.append('Set-Cookie', cookie);
  return res;
});
