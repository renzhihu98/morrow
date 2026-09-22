import { RAW_EVENT_TTL_HOURS } from '@morrow/core';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { SignInButton } from '@/components/auth/SignInButton';
import { BodyFigure } from '@/components/BodyFigure';
import { Wordmark } from '@/components/TopBar';
import { currentUser, isAuthEnabled } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled. Nothing was shared.',
  signup_disabled: 'Morrow signs in with Google only.',
};

const FACTS: [label: string, value: string][] = [
  ['Raw events kept', `${RAW_EVENT_TTL_HOURS} hours`],
  ['Never read', 'Health · money'],
  ['Forget everything', 'Anytime'],
];

/** 01 Sign in (Paper v4 AXP-0 / BVE-0). Google only; sources are connected separately. */
export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  await connection();
  const { next, error } = await searchParams;
  if (!isAuthEnabled()) redirect('/');
  const user = await currentUser();
  if (user) redirect(user.onboardedAt ? '/' : '/welcome/sources');

  const nextPath = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const errorMessage = typeof error === 'string' ? (ERRORS[error] ?? 'Morrow could not sign you in. Try again.') : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1088px] flex-col px-6 lg:box-content lg:px-12">
      <header className="flex h-16 items-center justify-between lg:h-24">
        <Wordmark size="sm" />
        <span className="label text-text-muted">Private beta · v0.1</span>
      </header>

      <main className="flex flex-1 flex-col items-center gap-8 py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:py-10">
        <div className="flex justify-center lg:order-2 lg:w-[420px] lg:shrink-0">
          <BodyFigure height={270} className="-my-8 lg:hidden" />
          <BodyFigure height={610} className="-my-20 hidden lg:block" />
        </div>

        <div className="flex w-full flex-col lg:order-1 lg:max-w-[680px]">
          <h1 className="font-serif text-hero-m text-text lg:text-hero">Meet Morrow.</h1>
          <p className="max-w-[540px] pt-5 text-body-lg-m text-text lg:pt-8 lg:text-[18px] lg:leading-[27px]">
            One reading a day, drawn only from the accounts you choose — and prophecies that check themselves.
          </p>
          <div className="flex flex-col items-start gap-4 pt-8 lg:pt-10">
            <SignInButton callbackURL={nextPath} />
            <p className="max-w-[400px] text-[14px] leading-[21px] text-text-muted">
              Signing in only shares your name and email. Calendar and other sources are connected separately, one at a
              time.
            </p>
            {errorMessage && (
              <p role="alert" className="text-[14px] leading-5 text-danger">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </main>

      <footer className="mb-8 flex flex-wrap items-center justify-between gap-x-10 gap-y-3 border-t border-hairline pt-5 lg:mb-9 lg:min-h-[58px] lg:pt-0">
        <dl className="flex flex-wrap items-center gap-x-10 gap-y-2">
          {FACTS.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2.5">
              <dt className="label text-text-muted">{label}</dt>
              <dd className="text-[14px] leading-[18px] text-text">{value}</dd>
            </div>
          ))}
        </dl>
        <span className="text-[14px] leading-[18px] text-accent">Terms · Privacy</span>
      </footer>
    </div>
  );
}
