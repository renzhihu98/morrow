import { ForgetRequest } from '@morrow/core';
import { authed, isAuthEnabled } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { apiError, ok } from '@/lib/server/http';
import { disconnectSource } from '@/lib/sources/connect';

/** POST /api/forget `{ confirm: "FORGET" }` — deletes everything Morrow knows and disconnects every source. */
export const POST = authed(async (user, req) => {
  const body = ForgetRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError('bad_request', 'Type FORGET to confirm.');
  const repo = getRepository();
  if (isAuthEnabled()) {
    for (const kind of ['calendar', 'spotify'] as const) await disconnectSource(user.id, kind, { purge: false });
  }
  await repo.forgetEverything(user.id);
  return ok();
});
