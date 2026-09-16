import { SourceKind } from '@morrow/core';
import { authed, isAuthEnabled, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { apiError, ok } from '@/lib/server/http';
import { disconnectSource } from '@/lib/sources/connect';
import { purgeSource } from '@/lib/sources/sync';

/** DELETE /api/sources/[kind] — unlink the grant, delete the source's raw events, rebuild the dossier. */
export const DELETE = authed(async (user, _req: Request, ctx: RouteContext<'/api/sources/[kind]'>) => {
  const parsed = SourceKind.safeParse((await ctx.params).kind);
  if (!parsed.success) return apiError('bad_request', 'Unknown source.');
  const repo = getRepository();
  if (!isAuthEnabled()) {
    await repo.setDemoSourceLinked(user.id, parsed.data, false);
    return ok();
  }
  await disconnectSource(user.id, parsed.data, { purge: false });
  await purgeSource(repo, toCoreUser(user), parsed.data, now());
  return ok();
});
