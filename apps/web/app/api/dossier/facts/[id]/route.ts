import { authed } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { apiError, ok } from '@/lib/server/http';

/** DELETE /api/dossier/facts/[id] — forget a single fact (or inferred pattern); rebuilds never bring it back. */
export const DELETE = authed(async (user, _req: Request, ctx: RouteContext<'/api/dossier/facts/[id]'>) => {
  const { id } = await ctx.params;
  return (await getRepository().forgetFact(user.id, decodeURIComponent(id))) ? ok() : apiError('not_found', 'No such fact.');
});
