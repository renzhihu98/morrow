'use client';

import { useEffect } from 'react';

/**
 * Captures the browser timezone (SPEC §12.4) — posts it once when the account has none yet (stored `UTC`
 * placeholder) so readings turn over at 04:00 local.
 */
export function TimezoneSync({ timezone }: { timezone: string }) {
  useEffect(() => {
    let browser: string;
    try {
      browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!browser || browser === timezone || timezone !== 'UTC') return;
    void fetch('/api/me/timezone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ timezone: browser }),
    });
  }, [timezone]);
  return null;
}
