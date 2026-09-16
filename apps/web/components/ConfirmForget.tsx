'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { downloadJson } from './DossierView';
import { FadingOrbit } from './Orbit';

type Props = {
  counts: { readings: number; prophecies: number; openProphecies: number; dossierKb: string; connections: string[] };
};

/** Forget everything (screen 12) — type FORGET to arm the danger button; goodbye state afterwards. */
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
    if (res.ok) router.refresh();
  };

  const copy = async () => {
    const [dossier, readings, prophecies] = await Promise.all(
      ['/api/dossier', '/api/readings', '/api/prophecies'].map((u) => fetch(u).then((r) => r.json())),
    );
    downloadJson('morrow-export.json', { dossier, readings, prophecies });
  };

  if (state === 'gone') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="opacity-50">
          <FadingOrbit />
        </div>
        <span className="label pt-10 text-text-muted">Forgotten</span>
        <h1 className="pt-5 font-serif text-confirm-m lg:text-confirm">Morrow has let you go.</h1>
        <p className="max-w-[440px] pt-5 text-[15px] leading-6 text-text-secondary">
          Your readings, prophecies and dossier are gone, and every source is disconnected. If you come back, Morrow will
          start from nothing.
        </p>
        <Link href="/" className="mt-10 rounded-button border border-hairline-strong px-4 py-2.5 text-sm">
          Begin again
        </Link>
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
    <div className="flex flex-col items-center">
      <FadingOrbit />
      <span className="label pt-10 text-danger">Forget everything</span>
      <h1 className="pt-4 text-center font-serif text-confirm-m lg:text-confirm">Let Morrow forget you?</h1>
      <p className="max-w-[440px] pt-5 text-center text-[15px] leading-6 text-text-secondary">
        This can&apos;t be undone. Every source will be disconnected, and Morrow will permanently delete:
      </p>

      <ul className="mt-12 w-full rounded-card border border-hairline bg-panel px-5">
        {rows.map((r, i) => (
          <li key={r.label} className={`flex items-center justify-between gap-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
            <span className="text-sm leading-5 lg:text-[14px]">{r.label}</span>
            <span className="font-mono text-label-sm text-text-muted">{r.value}</span>
          </li>
        ))}
      </ul>

      <label className="mt-7 flex w-full flex-col gap-2.5">
        <span className="label-sm text-text-muted">Type FORGET to confirm</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void forget()}
          autoComplete="off"
          spellCheck={false}
          className={`h-[46px] rounded-button border bg-bg px-4 font-mono text-[15px] tracking-[0.06em] caret-danger outline-none transition-colors ${
            armed ? 'border-danger-border' : 'border-hairline-strong focus:border-hairline-strong'
          }`}
        />
      </label>

      <div className="mt-5 flex w-full flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={copy} className="text-left text-sm text-text-secondary underline underline-offset-4 sm:mr-auto">
          Download a copy first
        </button>
        <Link href="/sources" className="rounded-button border border-hairline-strong px-4 py-2.5 text-center text-sm">
          Keep everything
        </Link>
        <button
          type="button"
          onClick={forget}
          disabled={!armed || state === 'working'}
          className="rounded-button bg-danger px-4 py-2.5 text-sm font-medium text-on-danger transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state === 'working' ? 'Forgetting…' : 'Forget everything'}
        </button>
      </div>
      {state === 'error' && <p className="pt-4 text-sm text-danger">Morrow couldn&apos;t forget just now. Nothing was deleted.</p>}
    </div>
  );
}
