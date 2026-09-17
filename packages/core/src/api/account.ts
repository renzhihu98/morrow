import { z } from 'zod';
import { IsoDateTime } from '../schemas/common';
import { Source } from '../schemas/source';

/**
 * v0.2 account contracts (SPEC §12). Session-authenticated; unauthenticated calls get
 * `401 { error: { code: "unauthorized" } }`.
 */

/** The signed-in person as returned by `GET /api/me`. */
export const AccountUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  /** IANA timezone; `UTC` until the client reports one via `POST /api/me/timezone`. */
  timezone: z.string(),
  /** Set by `POST /api/onboarding/complete`; null → client shows onboarding. */
  onboardedAt: IsoDateTime.nullable(),
});
export type AccountUser = z.infer<typeof AccountUser>;

/** GET /api/me */
export const MeResponse = z.object({ user: AccountUser, sources: z.array(Source) });
export type MeResponse = z.infer<typeof MeResponse>;

/** POST /api/me/timezone */
export const TimezoneRequest = z.object({ timezone: z.string().min(1).max(64) });
export type TimezoneRequest = z.infer<typeof TimezoneRequest>;

/** POST /api/sources/[kind]/connect (optional body). `callbackURL` is where the OAuth flow lands afterwards. */
export const ConnectSourceRequest = z.object({ callbackURL: z.string().optional() });
export type ConnectSourceRequest = z.infer<typeof ConnectSourceRequest>;

/** Scopes requested when linking each source (mirrored server-side). Calendar and Mail share the Google account. */
export const SOURCE_OAUTH = {
  calendar: { provider: 'google', scopes: ['https://www.googleapis.com/auth/calendar.readonly'] },
  mail: { provider: 'google', scopes: ['https://www.googleapis.com/auth/gmail.readonly'] },
  spotify: { provider: 'spotify', scopes: ['user-read-recently-played', 'user-top-read'] },
} as const;
