'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { downloadJson } from './DossierView';
import { Button, ButtonLink } from './ui/Button';

type Props = {
  counts: { readings: number; prophecies: number; openProphecies: number; dossierKb: string; connections: string[] };
};

/** 14 Forget everything (Paper v4 BE4-0) — type FORGET to arm the danger button; goodbye state afterwards. */
export function ConfirmForget({ counts }: Props) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [state, setState] = useState<'confirm' | 'working' | 'gone' | 'error'>('confirm');
  const armed = value.trim() === 'FORGET';

  const forget = async () => {
    if (!armed) return;
    setState('working');
    const res = await fetch('/api/forget', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'FORGET' }),
    });
    setState(res.ok ? 'gone' : 'error');
  };

  const copy = async () => {
    const [dossier, readings, prophecies] = await Promise.all(
      ['/api/dossier', '/api/readings', '/api/prophecies'].map((u) => fetch(u).then((r) => r.json())),
    );
    downloadJson('morrow-export.json', { dossier, readings, prophecies });
  };

  if (state === 'gone') {
    return (
      <div className="flex max-w-[640px] flex-col items-start">
        <span className="label text-text-muted">Sources · Forget everything</span>
        <h1 className="pt-6 font-serif text-confirm-m text-text lg:text-confirm">Morrow has let you go.</h1>
        <p className="max-w-[440px] pt-8 text-body-lg-m text-text lg:text-[18px] lg:leading-[27px]">
          Your account, readings, prophecies and dossier are gone, and every source is disconnected. If you come back,
          Morrow will start from nothing.
        </p>
        <ButtonLink href="/sign-in" variant="secondary" className="mt-10">
          Begin again
        </ButtonLink>
      </div>
    );
  }

  const connections = counts.connections;
  const rows = [
    { label: 'Readings and their transcripts', value: String(counts.readings) },
    {
      label: counts.openProphecies > 0 ? `Prophecies, including ${counts.openProphecies} still open` : 'Prophecies',
      value: String(counts.prophecies),
    },
    { label: 'Your dossier', value: counts.dossierKb },
    {
      label: connections.length > 0 ? `Connections to ${connections.join(', ')}` : 'Source connections',
      value: String(connections.length),
    },
  ];

  return (
    <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
      <div className="flex flex-col items-start lg:w-[520px] lg:shrink-0">
        <span className="label text-text-muted">Sources · Forget everything</span>
        <h1 className="pt-5 font-serif text-confirm-m text-text lg:pt-6 lg:text-confirm lg:leading-[98px]">Let Morrow forget you?</h1>
        <p className="max-w-[440px] pt-5 text-body-lg-m text-text lg:pt-8 lg:text-[18px] lg:leading-[27px]">
          This can&apos;t be undone. Every source will be disconnected, and Morrow will permanently delete:
        </p>
      </div>

      <div className="flex w-full flex-col lg:w-[480px] lg:shrink-0 lg:pt-4">
        <ul className="border-t border-hairline">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline justify-between gap-4 border-b border-hairline py-[18px]">
              <span className="text-body-m text-text lg:text-body">{r.label}</span>
              <span className="shrink-0 font-mono text-[13px] leading-4 text-text-muted">{r.value}</span>
            </li>
          ))}
        </ul>

        <label className="mt-14 flex flex-col gap-2.5">
          <span className="label text-text-muted">Type FORGET to confirm</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void forget()}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-14 rounded-button border border-danger-border bg-surface px-6 font-mono text-[16px] leading-5 tracking-[0.12em] text-text caret-danger outline-none focus-visible:border-danger"
          />
        </label>

        <div className="mt-10 flex flex-col gap-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link
              href="/sources"
              className="inline-flex h-14 flex-1 items-center justify-center rounded-button border border-text/30 px-7 text-[16px] font-medium leading-5 text-text transition-colors hover:bg-text/5"
            >
              Keep everything
            </Link>
            <Button variant="danger" onClick={forget} disabled={!armed || state === 'working'} className="flex-1">
              {state === 'working' ? 'Forgetting…' : 'Forget everything'}
            </Button>
          </div>
          <button
            type="button"
            onClick={copy}
            className="self-start text-[15px] leading-5 text-accent underline decoration-1 underline-offset-[3px]"
          >
            Download a copy first
          </button>
        </div>
        {state === 'error' && (
          <p role="alert" className="pt-4 text-[14px] leading-5 text-danger">
            Morrow couldn&apos;t forget just now. Nothing was deleted.
          </p>
        )}
      </div>
    </div>
  );
}
