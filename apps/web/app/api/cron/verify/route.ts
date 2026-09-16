import { getRepository } from '@/lib/data';
import { runVerify } from '@/lib/jobs/verify';
import { now } from '@/lib/server/env';
import { apiError, handle, isAuthorizedCron } from '@/lib/server/http';

export const maxDuration = 300;

/** Every 30 min: check open prophecies against new raw events; purge expired raw events. */
export const GET = handle(async (req: Request) => {
  if (!isAuthorizedCron(req)) return apiError('unauthorized', 'Bad cron secret.');
  return Response.json(await runVerify(getRepository(), now()));
});
