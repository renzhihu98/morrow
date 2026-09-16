import { getRepository } from '@/lib/data';
import { apiError, handle, ok } from '@/lib/server/http';

/** DELETE /api/dossier/facts/[id] — forget a single fact (or inferred pattern). */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<'/api/dossier/facts/[id]'>) => {
  const { id } = await ctx.params;
  const repo = getRepository();
  const user = await repo.getDemoUser();
  return (await repo.forgetFact(user.id, decodeURIComponent(id))) ? ok() : apiError('not_found', 'No such fact.');
});
