import type { MeResponse } from '@morrow/core';
import { authed, toAccountUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';

/** GET /api/me → `{ user: { id, name, email, image, timezone, onboardedAt }, sources }` */
export const GET = authed(async (user) => {
  const sources = await getRepository().listSources(toCoreUser(user).id);
  return Response.json({ user: toAccountUser(user), sources } satisfies MeResponse);
});
