import type { ApiErrorBody, ApiErrorCode } from '@morrow/core';

const STATUS: Record<ApiErrorCode, number> = {
  reading_sealed: 409,
  question_limit: 429,
  bad_request: 400,
  unauthorized: 401,
  not_found: 404,
  server_error: 500,
  network_error: 502,
  unknown: 500,
};

export function apiError(code: ApiErrorCode, message: string, status = STATUS[code]): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

export const ok = () => Response.json({ ok: true as const });

/** Wraps a handler so unexpected throws become `server_error` JSON bodies. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error('[morrow] api error', e);
      return apiError('server_error', 'Something went wrong on our side.');
    }
  };
}

/** Bearer check for Vercel Cron. With no CRON_SECRET set, only non-production requests pass. */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}
