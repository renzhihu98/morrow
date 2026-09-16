import { getRepository } from '@/lib/data';
import { runSync } from '@/lib/jobs/sync';
import { now } from '@/lib/server/env';
import { apiError, handle, isAuthorizedCron } from '@/lib/server/http';

export const maxDuration = 300;

/** Hourly: sync every connected source for every user, then purge expired raw events. */
export const GET = handle(async (req: Request) => {
  if (!isAuthorizedCron(req)) return apiError('unauthorized', 'Bad cron secret.');
  return Response.json(await runSync(getRepository(), now()));
});
