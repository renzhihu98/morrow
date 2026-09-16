import { expo } from '@better-auth/expo';
import { SOURCE_OAUTH } from '@morrow/core';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { getDb } from '../db/client';
import { TZ_COOKIE, isValidTimeZone, timezoneFromCookieHeader } from '../server/timezone';
import { authSchema } from '../db/schema';
import { onAccountGranted } from './grants';

/** Sign-in asks for identity only (SPEC §12.2); sources add scopes via linkSocial (§12.3). */
export const GOOGLE_SIGN_IN_SCOPES = ['openid', 'email', 'profile'];

/** Scopes + params Better Auth's linkSocial must use per provider, whichever client calls it (web or Expo). */
export const LINK_PARAMS: Record<string, { scopes: string[]; additionalParams?: Record<string, string> }> = {
  google: {
    scopes: [...SOURCE_OAUTH.calendar.scopes],
    // Refresh tokens are only issued with offline access + an explicit consent screen.
    additionalParams: { access_type: 'offline', prompt: 'consent' },
  },
  spotify: { scopes: [...SOURCE_OAUTH.spotify.scopes] },
};

function trustedOrigins(): string[] {
  const origins = ['morrow://'];
  if (process.env.BETTER_AUTH_URL) origins.push(new URL(process.env.BETTER_AUTH_URL).origin);
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV !== 'production') {
    origins.push('exp://', 'exp://**', 'http://127.0.0.1:3000', 'http://localhost:3000', 'http://127.0.0.1:8081', 'http://localhost:8081');
  }
  return origins;
}

function createAuth() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

  return betterAuth({
    appName: 'Morrow',
    // baseURL ← BETTER_AUTH_URL, secret ← BETTER_AUTH_SECRET (read by Better Auth). basePath: /api/auth (default).
    database: drizzleAdapter(getDb(), { provider: 'pg', schema: authSchema }),
    trustedOrigins: trustedOrigins(),
    user: {
      additionalFields: {
        timezone: { type: 'string', required: false, input: false },
        onboardedAt: { type: 'date', required: false, input: false },
      },
    },
    session: {
      // Onboarding state changes server-side; read sessions from the DB rather than a stale cookie cache.
      cookieCache: { enabled: false },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        // Sources are only linked explicitly with linkSocial while signed in — never by matching emails.
        disableImplicitLinking: true,
        // Spotify never reports verified emails, and a Spotify/Calendar login may use another address.
        trustedProviders: ['google', 'spotify'],
        allowDifferentEmails: true,
      },
    },
    socialProviders: {
      ...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: GOOGLE_CLIENT_ID,
              clientSecret: GOOGLE_CLIENT_SECRET,
              // Default scopes are openid email profile; Calendar is added by linkSocial.
              accessType: 'offline' as const,
              prompt: 'select_account' as const,
            },
          }
        : {}),
      ...(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET
        ? {
            spotify: {
              clientId: SPOTIFY_CLIENT_ID,
              clientSecret: SPOTIFY_CLIENT_SECRET,
              scope: [...SOURCE_OAUTH.spotify.scopes],
              // Spotify is a source, not a way in.
              disableSignUp: true,
            },
          }
        : {}),
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-in/social' && ctx.body?.provider !== 'google') {
          throw new APIError('BAD_REQUEST', { message: 'Morrow signs in with Google only.' });
        }
        // Enforce source scopes on linkSocial regardless of what the client asked for.
        if (ctx.path === '/link-social') {
          const params = LINK_PARAMS[ctx.body?.provider as string];
          if (!params) throw new APIError('BAD_REQUEST', { message: 'This source cannot be linked.' });
          const requested: string[] = Array.isArray(ctx.body?.scopes) ? ctx.body.scopes : [];
          return {
            context: {
              body: {
                ...ctx.body,
                scopes: [...new Set([...requested, ...params.scopes])],
                additionalParams: { ...(ctx.body?.additionalParams ?? {}), ...(params.additionalParams ?? {}) },
              },
            },
          };
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Capture the browser zone set by the sign-in page (`morrow_tz`), so readings and rhythms start local.
          before: async (user, ctx) => {
            const fromCookie = ctx?.getCookie?.(TZ_COOKIE) ?? null;
            const timezone = isValidTimeZone(fromCookie) ? fromCookie : timezoneFromCookieHeader(ctx?.headers?.get('cookie'));
            return timezone ? { data: { ...user, timezone } } : undefined;
          },
        },
      },
      account: {
        // A source grant just landed (OAuth callback) → sync it in the background.
        create: { after: async (account, ctx) => onAccountGranted(account, ctx?.path ?? null) },
        update: { after: async (account, ctx) => onAccountGranted(account, ctx?.path ?? null) },
      },
    },
    plugins: [expo(), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const g = globalThis as typeof globalThis & { __morrowAuth?: Auth };

/** Better Auth instance. Only valid when DATABASE_URL is set (auth mode). */
export function getAuth(): Auth {
  g.__morrowAuth ??= createAuth();
  return g.__morrowAuth;
}
