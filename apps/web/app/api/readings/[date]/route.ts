import { LocalDate } from '@morrow/core';
import { authed, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { apiError } from '@/lib/server/http';
import { getReadingDetailView } from '@/lib/server/readings';

export const GET = authed(async (user, _req: Request, ctx: RouteContext<'/api/readings/[date]'>) => {
  const { date } = await ctx.params;
  if (!LocalDate.safeParse(date).success) return apiError('bad_request', 'Date must be YYYY-MM-DD.');
  const detail = await getReadingDetailView(getRepository(), toCoreUser(user), now(), date);
  return detail ? Response.json(detail) : apiError('not_found', `No reading on ${date}.`);
});
