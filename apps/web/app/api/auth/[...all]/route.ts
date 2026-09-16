import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth/auth';
import { isAuthEnabled } from '@/lib/auth/session';
import { apiError } from '@/lib/server/http';

/** Better Auth (SPEC §12.2) — basePath `/api/auth`. Demo mode (no DATABASE_URL) has no auth. */
const handler = (req: Request) =>
  isAuthEnabled() ? getAuth().handler(req) : Promise.resolve(apiError('not_found', 'Auth is disabled in demo mode.'));

export const { GET, POST } = toNextJsHandler(handler);
