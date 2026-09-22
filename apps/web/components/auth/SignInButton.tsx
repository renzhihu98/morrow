'use client';

import { useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { authClient } from '@/lib/auth/client';

const TZ_COOKIE = 'morrow_tz';

/** Hands the browser timezone to the server for the user-create hook, so a new account never starts as UTC. */
function rememberTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=600; samesite=lax`;
  } catch {
    // No zone available: the account starts as UTC and TimezoneSync corrects it after sign-in.
  }
}

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
    <path d="M16.5 9.2c0-.6-.05-1.1-.15-1.6H9v3.1h4.2a3.6 3.6 0 0 1-1.55 2.35v1.95h2.5c1.47-1.35 2.35-3.35 2.35-5.8Z" fill="currentColor" />
    <path d="M9 17c2.1 0 3.85-.7 5.15-1.9l-2.5-1.95c-.7.47-1.6.75-2.65.75-2.03 0-3.76-1.37-4.37-3.22H2.05v2A8 8 0 0 0 9 17Z" fill="currentColor" />
    <path d="M4.63 10.68a4.8 4.8 0 0 1 0-3.36v-2H2.05a8 8 0 0 0 0 7.36l2.58-2Z" fill="currentColor" />
    <path d="M9 4.4c1.15 0 2.18.4 3 1.17l2.22-2.22A8 8 0 0 0 2.05 5.32l2.58 2C5.24 5.77 6.97 4.4 9 4.4Z" fill="currentColor" />
  </svg>
);

/** "Continue with Google" — Better Auth social sign-in (openid email profile only). */
export function SignInButton({ callbackURL }: { callbackURL: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  useEffect(rememberTimezone, []);

  const signIn = async () => {
    setState('working');
    rememberTimezone();
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL,
      newUserCallbackURL: '/welcome/sources',
      errorCallbackURL: '/sign-in',
    });
    if (error) setState('error');
  };

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={state === 'working'}
        className={buttonClass('primary', 'lg', 'disabled:opacity-70')}
      >
        <GoogleGlyph />
        {state === 'working' ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {state === 'error' && <p role="alert" className="text-[14px] leading-5 text-danger">Google sign-in isn&apos;t available right now. Try again.</p>}
    </>
  );
}
