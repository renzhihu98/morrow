import { ConnectSourceRequest, SourceKind, type ConnectSourceResponse } from '@morrow/core';
import { getAuth, LINK_PARAMS } from '@/lib/auth/auth';
import { authed, isAuthEnabled } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { apiError } from '@/lib/server/http';
import { PROVIDER_FOR } from '@/lib/sources/tokens';

/**
 * POST /api/sources/[kind]/connect `{ callbackURL? }` → `{ kind, url, authorizeUrl }`.
 * Starts Better Auth `linkSocial` for the source's provider with its scopes (Calendar: calendar.readonly with
 * offline access + consent; Spotify: recently-played + top-read). The browser navigates to `url`; the OAuth
 * callback stores the grant and triggers the first sync. Demo mode: linked immediately, `url` null.
 */
export const POST = authed(async (_user, req: Request, ctx: RouteContext<'/api/sources/[kind]/connect'>) => {
  const parsed = SourceKind.safeParse((await ctx.params).kind);
  if (!parsed.success) return apiError('bad_request', 'Unknown source.');
  const kind = parsed.data;

  if (!isAuthEnabled()) {
    await getRepository().setDemoSourceLinked(_user.id, kind, true);
    return Response.json({ kind, url: null, authorizeUrl: null } satisfies ConnectSourceResponse);
  }

  const provider = PROVIDER_FOR[kind];
  if (!provider) return apiError('bad_request', 'Morrow will ask for this source when a prophecy needs it.');
  const body = ConnectSourceRequest.safeParse(await req.json().catch(() => ({})));
  const callbackURL = body.success && body.data.callbackURL ? body.data.callbackURL : '/sources';
  const params = LINK_PARAMS[provider]!;
  try {
    const result = await getAuth().api.linkSocialAccount({
      headers: req.headers,
      body: {
        provider,
        callbackURL,
        errorCallbackURL: `${callbackURL}${callbackURL.includes('?') ? '&' : '?'}connect_error=${kind}`,
        scopes: params.scopes,
        additionalParams: params.additionalParams,
        disableRedirect: true,
      },
    });
    return Response.json({ kind, url: result.url, authorizeUrl: result.url } satisfies ConnectSourceResponse);
  } catch (e) {
    console.error('[morrow] linkSocial failed', e);
    return apiError('bad_request', `${kind} can't be connected right now. Is the provider configured?`);
  }
});
