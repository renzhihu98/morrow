import { TimezoneRequest } from '@morrow/core';
import { authed, isAuthEnabled } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { apiError, ok } from '@/lib/server/http';

const isValidTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** POST /api/me/timezone `{ timezone }` — IANA zone captured from the browser/device. */
export const POST = authed(async (user, req) => {
  const body = TimezoneRequest.safeParse(await req.json().catch(() => null));
  if (!body.success || !isValidTimeZone(body.data.timezone)) return apiError('bad_request', 'Expected { timezone } as an IANA zone.');
  if (isAuthEnabled()) await getRepository().setUserTimezone(user.id, body.data.timezone);
  return ok();
});
