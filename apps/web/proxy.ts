import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection (SPEC §12.2), Next 16 `proxy` convention. Only active when DATABASE_URL is set.
 * Optimistic: checks for the Better Auth session cookie (no DB round-trip). Pages and route handlers verify the
 * session for real (`requirePageUser` / `authed`) and apply the onboarding redirect to /welcome/sources.
 */
const PUBLIC = [/^\/sign-in(\/|$)/, /^\/(privacy|terms)(\/|$)/, /^\/api\/auth(\/|$)/, /^\/api\/cron(\/|$)/];

export function proxy(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Sign in to talk to Morrow.' } }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/sign-in';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
};
