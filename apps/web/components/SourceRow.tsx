'use client';

import { formatLocalTime, type ConnectSourceResponse, type Source } from '@morrow/core';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

function meta(source: Source): string {
  if (source.status !== 'linked') return source.status === 'error' ? (source.syncState === 'needs_reauth' ? 'Needs reconnecting' : 'Needs attention') : 'Not linked';
  if (source.syncState === 'pending' || source.syncState === 'syncing') return 'Reading…';
  const parts: string[] = [];
  if (source.provider !== source.name) parts.push(source.provider);
  if (source.stat) parts.push(`${source.stat.value.toLocaleString('en-US')} ${source.stat.label}`);
  else if (source.watchingCount > 0)
    parts.push(`Watching ${source.watchingCount} ${source.watchingCount === 1 ? 'prophecy' : 'prophecies'}`);
  return parts.join(' · ');
}

/** One row of the Sources table (screen 10): glyph, name + meta, what Morrow reads, status/connect. */
export function SourceRow({ source, timeZone }: { source: Source; timeZone: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const linked = source.status === 'linked';

  const act = (method: 'POST' | 'DELETE') =>
    startTransition(async () => {
      setError(null);
      const url = method === 'POST' ? `/api/sources/${source.kind}/connect` : `/api/sources/${source.kind}`;
      const res = await fetch(url, {
        method,
        ...(method === 'POST'
          ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callbackURL: '/sources' }) }
          : {}),
      });
      if (!res.ok) return setError(res.status === 400 && method === 'POST' ? 'Not available yet.' : 'Try again.');
      if (method === 'POST') {
        const body = (await res.json()) as ConnectSourceResponse;
        const next = body.url ?? body.authorizeUrl;
        if (next) return window.location.assign(next);
      }
      router.refresh();
    });

  return (
    <li className="grid grid-cols-[40px_1fr_auto] items-center gap-x-4 gap-y-2 border-t border-hairline py-[22px] lg:grid-cols-[40px_244px_1fr_auto]">
      <span
        className={`flex size-10 items-center justify-center rounded-glyph border font-mono text-label-sm ${
          linked ? 'border-hairline-strong text-text-primary' : 'border-dashed border-hairline-strong text-text-faint'
        }`}
        aria-hidden
      >
        {source.name.slice(0, 2).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className={`font-serif text-[26px] leading-[30px] ${linked ? 'text-text-primary' : 'text-text-secondary'}`}>
          {source.name}
        </span>
        <span className="label-sm text-text-muted">{meta(source)}</span>
      </span>
      <span className="col-span-3 row-start-2 text-[15px] leading-[21px] text-text-secondary lg:col-span-1 lg:row-start-auto lg:max-w-[330px] lg:pr-6">
        {source.reads}
      </span>
      <span className="col-start-3 row-start-1 flex flex-col items-end gap-1 lg:col-start-auto lg:row-start-auto">
        {linked ? (
          <>
            <span className="label-sm flex items-center gap-2 text-accent">
              <span className="size-2 rounded-full bg-accent" /> Linked
            </span>
            <span className="group relative">
              <span className="label-sm text-text-muted group-hover:invisible group-focus-within:invisible">
                {source.lastSyncedAt ? `Sync ${formatLocalTime(source.lastSyncedAt, timeZone)}` : 'Syncing'}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => act('DELETE')}
                className="label-sm absolute right-0 top-0 text-danger opacity-0 focus:opacity-100 group-hover:opacity-100"
              >
                Disconnect
              </button>
            </span>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => act('POST')}
            className="h-[34px] rounded-[8px] bg-accent-fill px-3.5 text-sm font-medium text-on-accent disabled:opacity-60"
          >
            {pending ? 'Connecting…' : source.status === 'error' ? 'Reconnect' : 'Connect'}
          </button>
        )}
        {error && <span className="label-sm text-danger">{error}</span>}
      </span>
    </li>
  );
}
