import { getRepository } from '@/lib/data';
import { runDawn } from '@/lib/jobs/dawn';
import { now } from '@/lib/server/env';
import { apiError, handle, isAuthorizedCron } from '@/lib/server/http';

export const maxDuration = 300;

/** Hourly: seal → summarize → create → open, for users whose local day turned over. */
export const GET = handle(async (req: Request) => {
  if (!isAuthorizedCron(req)) return apiError('unauthorized', 'Bad cron secret.');
  return Response.json(await runDawn(getRepository(), now()));
});
