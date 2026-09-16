import { SourceKind, type ConnectSourceResponse } from '@morrow/core';
import { getRepository } from '@/lib/data';
import { apiError, handle } from '@/lib/server/http';
import { SOURCE_ADAPTERS } from '@/lib/sources';

/**
 * POST /api/sources/[kind]/connect — OAuth stub. Returns the provider authorize URL when client
 * credentials are configured; in demo mode (no credentials) the source is marked linked directly.
 */
export const POST = handle(async (req: Request, ctx: RouteContext<'/api/sources/[kind]/connect'>) => {
  const parsed = SourceKind.safeParse((await ctx.params).kind);
  if (!parsed.success) return apiError('bad_request', 'Unknown source.');
  const kind = parsed.data;
  const repo = getRepository();
  const user = await repo.getDemoUser();

  const redirectUri = new URL(`/api/sources/${kind}/callback`, req.url).toString();
  // TODO(oauth): signed, expiring state bound to the session; callback route exchanges the code.
  const authorizeUrl = SOURCE_ADAPTERS[kind]?.authorizeUrl(`${user.id}:${kind}`, redirectUri) ?? null;
  if (!authorizeUrl) await repo.setSourceStatus(user.id, kind, 'linked');

  const body: ConnectSourceResponse = { kind, authorizeUrl };
  return Response.json(body);
});
