'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Keeps the account timezone in step with the browser (SPEC §12.4): posts the browser zone whenever it differs
 * from the stored one (a missing zone is stored as `UTC`), then refreshes so server-rendered days and rhythms use
 * it. Mounted on onboarding (before any source connects) and on every app screen.
 */
export function TimezoneSync({ timezone }: { timezone: string }) {
  const router = useRouter();
  useEffect(() => {
    let browser: string;
    try {
      browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!browser || browser === timezone) return;
    let cancelled = false;
    void fetch('/api/me/timezone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ timezone: browser }),
    })
      .then((res) => {
        if (res.ok && !cancelled) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [timezone, router]);
  return null;
}
