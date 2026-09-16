import { ForgetRequest } from '@morrow/core';
import { getRepository } from '@/lib/data';
import { apiError, handle, ok } from '@/lib/server/http';

/** POST /api/forget `{ confirm: "FORGET" }` — deletes everything Morrow knows. */
export const POST = handle(async (req: Request) => {
  const body = ForgetRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError('bad_request', 'Type FORGET to confirm.');
  const repo = getRepository();
  const user = await repo.getDemoUser();
  await repo.forgetEverything(user.id);
  return ok();
});
