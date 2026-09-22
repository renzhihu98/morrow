'use client';

import { formatLocalTime, type ConnectSourceResponse, type Source } from '@morrow/core';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { StatusDot } from './Labels';

function meta(source: Source): string {
  if (source.status !== 'linked') return source.status === 'error' ? (source.syncState === 'needs_reauth' ? 'Needs reconnecting' : 'Needs attention') : 'Not linked';
  if (source.syncState === 'pending' || source.syncState === 'syncing') return 'Reading…';
  const parts: string[] = [];
  if (source.provider !== source.name) parts.push(source.provider);
  if (source.stat) parts.push(`${source.stat.value.toLocaleString('en-US')} ${source.stat.label}`);
  if (source.stat && source.calendarCount) parts.push(`${source.calendarCount} ${source.calendarCount === 1 ? 'calendar' : 'calendars'}`);
  else if (source.watchingCount > 0)
    parts.push(`Watching ${source.watchingCount} ${source.watchingCount === 1 ? 'prophecy' : 'prophecies'}`);
  return parts.join(' · ');
}

/** One row of the Sources table (v4 12, Paper C11-0): serif name + meta, what Morrow reads, status/connect. */
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

  const muted = source.status === 'not_linked';

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-hairline py-5 lg:grid-cols-[264px_1fr_116px] lg:gap-x-0">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`font-serif text-[26px] leading-[30px] tracking-[-0.01em] lg:text-[28px] lg:leading-8 ${muted ? 'text-text-muted' : 'text-text'}`}>
          {source.name}
        </span>
        <span className="text-[13px] leading-[18px] text-text-muted">{meta(source)}</span>
      </span>
      <span
        className={`col-span-2 row-start-2 text-[15px] leading-[22px] lg:col-span-1 lg:row-start-auto lg:pr-6 ${
          muted ? 'text-text-muted' : 'text-text'
        }`}
      >
        {source.reads}
      </span>
      <span className="col-start-2 row-start-1 flex flex-col items-end gap-1 lg:col-start-auto lg:row-start-auto">
        {linked ? (
          <>
            <span className="flex items-center gap-2 text-[13px] leading-4 text-text">
              <StatusDot size={7} /> Linked
            </span>
            <span className="group relative">
              <span className="font-mono text-meta text-text-muted group-focus-within:invisible group-hover:invisible">
                {source.lastSyncedAt ? `Synced ${formatLocalTime(source.lastSyncedAt, timeZone)}` : 'Syncing'}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => act('DELETE')}
                className="absolute right-0 top-0 whitespace-nowrap text-[13px] leading-4 text-danger opacity-0 focus:opacity-100 group-hover:opacity-100"
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
            className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-[18px] border border-accent px-4 text-[14px] font-medium leading-[18px] text-accent transition-colors hover:bg-accent/5 disabled:opacity-50"
          >
            {pending ? 'Connecting…' : source.status === 'error' ? 'Reconnect' : 'Connect'}
          </button>
        )}
        {error && <span className="text-[13px] leading-4 text-danger">{error}</span>}
      </span>
    </li>
  );
}
