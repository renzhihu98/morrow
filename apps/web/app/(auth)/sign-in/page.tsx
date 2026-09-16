import { RAW_EVENT_TTL_HOURS } from '@morrow/core';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { SignInButton } from '@/components/auth/SignInButton';
import { Orbit } from '@/components/Orbit';
import { Wordmark } from '@/components/TopBar';
import { currentUser, isAuthEnabled } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled. Nothing was shared.',
  signup_disabled: 'Morrow signs in with Google only.',
};

/** Screen 13 — Sign in (Paper 35P-0 / 3C9-0). Google only; sources are connected separately. */
export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  await connection();
  const { next, error } = await searchParams;
  if (!isAuthEnabled()) redirect('/');
  const user = await currentUser();
  if (user) redirect(user.onboardedAt ? '/' : '/welcome/sources');

  const nextPath = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const errorMessage = typeof error === 'string' ? (ERRORS[error] ?? 'Morrow could not sign you in. Try again.') : null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-12 lg:py-7">
        <Wordmark />
        <span className="label text-text-muted">Private beta · v0.1</span>
      </header>

      <div
        className="pointer-events-none mx-auto mt-2 w-[240px] sm:w-[320px] lg:absolute lg:left-[calc(50%-30px)] lg:top-[120px] lg:mt-0 lg:w-[660px] xl:left-[690px]"
        aria-hidden
      >
        <Orbit state="idle" nodes={[{}, {}, { accent: true }]} />
      </div>

      <main className="relative flex flex-1 flex-col px-6 pb-10 pt-8 lg:px-[120px] lg:pt-[162px]">
        <div className="flex w-full max-w-[440px] flex-col">
          <span className="label text-text-muted">Sign in</span>
          <h1 className="pt-5 font-serif text-display-m lg:pt-6 lg:text-display">Meet Morrow.</h1>
          <p className="max-w-[400px] pt-5 text-body-m text-text-secondary lg:pt-[22px] lg:text-[16px] lg:leading-[26px]">
            One reading a day, drawn only from the accounts you choose — and prophecies that check themselves.
          </p>
          <SignInButton callbackURL={nextPath} />
          <p className="max-w-[400px] pt-3.5 text-[13px] leading-5 text-text-muted">
            Signing in only shares your name and email. Calendar and other sources are connected separately, one at a time.
          </p>
          {errorMessage && <p className="pt-4 text-sm text-danger">{errorMessage}</p>}
        </div>
      </main>

      <footer className="relative mx-6 mb-10 flex flex-wrap items-center gap-x-10 gap-y-3 border-t border-hairline pt-[18px] lg:mx-[120px] lg:mb-14">
        <span className="flex gap-2.5">
          <span className="label-sm text-text-muted">Raw events kept</span>
          <span className="label-sm text-text-primary">{RAW_EVENT_TTL_HOURS} hours</span>
        </span>
        <span className="flex gap-2.5">
          <span className="label-sm text-text-muted">Never read</span>
          <span className="label-sm text-text-primary">Health · Money</span>
        </span>
        <span className="flex gap-2.5">
          <span className="label-sm text-text-muted">Forget everything</span>
          <span className="label-sm text-text-primary">Anytime</span>
        </span>
        <span className="text-[13px] leading-[18px] text-text-muted sm:ml-auto">Terms · Privacy</span>
      </footer>
    </div>
  );
}
