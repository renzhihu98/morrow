import { SourceKind } from '@morrow/core';
import { getRepository } from '@/lib/data';
import { apiError, handle, ok } from '@/lib/server/http';

/** DELETE /api/sources/[kind] — disconnect (tokens and stats are cleared). */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<'/api/sources/[kind]'>) => {
  const parsed = SourceKind.safeParse((await ctx.params).kind);
  if (!parsed.success) return apiError('bad_request', 'Unknown source.');
  const repo = getRepository();
  const user = await repo.getDemoUser();
  await repo.setSourceStatus(user.id, parsed.data, 'not_linked');
  return ok();
});
