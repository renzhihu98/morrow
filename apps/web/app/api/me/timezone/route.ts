import { TimezoneRequest } from '@morrow/core';
import { authed, isAuthEnabled, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { apiError, ok } from '@/lib/server/http';
import { applyTimezone, isValidTimeZone } from '@/lib/server/timezone';

/**
 * POST /api/me/timezone `{ timezone }` — IANA zone captured from the browser/device. When it differs from the
 * stored zone the dossier is rebuilt, so rhythms read in local time straight away.
 */
export const POST = authed(async (user, req) => {
  const body = TimezoneRequest.safeParse(await req.json().catch(() => null));
  if (!body.success || !isValidTimeZone(body.data.timezone)) return apiError('bad_request', 'Expected { timezone } as an IANA zone.');
  if (isAuthEnabled()) await applyTimezone(getRepository(), toCoreUser(user), body.data.timezone, now());
  return ok();
});
