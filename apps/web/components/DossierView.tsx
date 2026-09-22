'use client';

import type { Dossier, DossierCategory } from '@morrow/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { sourceName } from '@/lib/ui/format';

const CATEGORIES: DossierCategory[] = ['rhythms', 'pursuits', 'people', 'places', 'tastes'];

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

const CATEGORY_LABEL: Record<DossierCategory, string> = {
  rhythms: 'Rhythms',
  pursuits: 'Pursuits',
  people: 'People',
  places: 'Places',
  tastes: 'Tastes',
};

/** Hover/focus swap: the resting content, replaced by a Brick "Forget this ×". */
function ForgetSwap({ children, onForget, forgetting, width }: { children: ReactNode; onForget: () => void; forgetting: boolean; width: string }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-end ${width}`}>
      <span className="flex items-center gap-4 group-focus-within:invisible group-hover:invisible">{children}</span>
      <button
        type="button"
        onClick={onForget}
        disabled={forgetting}
        className="absolute right-0 top-1/2 -translate-y-1/2 whitespace-nowrap text-[14px] leading-[18px] text-danger opacity-0 underline-offset-4 hover:underline focus:opacity-100 group-hover:opacity-100"
      >
        {forgetting ? 'Forgetting…' : 'Forget this ×'}
      </button>
    </span>
  );
}

/** A dossier fact row: label, serif value, cited sources (swapped for "Forget this ×" on hover/focus). */
function DossierRow({
  label,
  value,
  sources,
  onForget,
  forgetting,
}: {
  label: string;
  value: string;
  sources: string;
  onForget: () => void;
  forgetting: boolean;
}) {
  return (
    <li className="group flex flex-col gap-1 border-b border-hairline py-3 sm:min-h-[52px] sm:flex-row sm:items-center sm:gap-0 sm:py-2">
      <span className="w-40 shrink-0 text-[14px] leading-[18px] text-text-muted">{label}</span>
      <span className={`min-w-0 flex-1 font-serif text-row-m text-text lg:text-[24px] lg:leading-7 ${forgetting ? 'opacity-40' : ''}`}>{value}</span>
      <ForgetSwap onForget={onForget} forgetting={forgetting} width="sm:w-40">
        <span className="label text-right text-text-muted">{sources}</span>
      </ForgetSwap>
    </li>
  );
}

/** 13 Dossier (Paper v4 D3U-0): Readable / Raw JSON switch, Rhythms / People / Patterns groups, forget a single fact. */
export function DossierView({ initial }: { initial: Dossier }) {
  const router = useRouter();
  const [dossier, setDossier] = useState(initial);
  const [mode, setMode] = useState<'readable' | 'raw'>('readable');
  const [forgetting, setForgetting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Server refresh after a forget brings the recomputed size; adopt it.
  useEffect(() => setDossier(initial), [initial]);

  const forget = async (id: string) => {
    setForgetting(id);
    setError(null);
    const res = await fetch(`/api/dossier/facts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setForgetting(null);
    if (!res.ok) return setError('Morrow could not forget that. Try again.');
    setDossier((d) => ({ ...d, facts: d.facts.filter((f) => f.id !== id), patterns: d.patterns.filter((p) => p.id !== id) }));
    router.refresh();
  };

  const namesOf = (sources: Dossier['facts'][number]['sources']) => sources.map(sourceName).join(' · ');

  return (
    <main className="mx-auto w-full max-w-[1184px] px-6 pb-20 pt-6 lg:box-content lg:grid lg:grid-cols-[380px_minmax(0,712px)] lg:justify-between lg:gap-10 lg:px-12 lg:pt-12">
      <div className="flex flex-col">
        <Link href="/sources" className="self-start text-[14px] leading-[18px] text-accent underline-offset-4 hover:underline">
          ← Sources
        </Link>
        <h1 className="pt-5 font-serif text-title-m text-text lg:pt-[22px] lg:text-title lg:leading-[84px]">Your dossier</h1>
        <p className="max-w-[360px] pt-4 text-body-m text-text-muted lg:text-body">
          Everything Morrow knows about you. Not your emails or events — only what was distilled from them. Readings come
          from this page alone.
        </p>
        <dl className="flex flex-col pt-8 lg:w-[340px]">
          {[
            { label: 'Observed', value: `${dossier.facts.length} ${dossier.facts.length === 1 ? 'fact' : 'facts'}` },
            { label: 'Inferred', value: `${dossier.patterns.length} ${dossier.patterns.length === 1 ? 'pattern' : 'patterns'}` },
          ].map((r) => (
            <div key={r.label} className="flex h-11 items-center justify-between gap-4 border-b border-hairline">
              <dt className="label text-text-muted">{r.label}</dt>
              <dd className="text-[15px] leading-5 text-text">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center gap-7 pt-6">
          <button
            type="button"
            onClick={() => downloadJson('morrow-dossier.json', dossier)}
            className="text-[15px] font-medium leading-5 text-accent underline decoration-1 underline-offset-4"
          >
            Download JSON
          </button>
          <span className="text-[15px] leading-5 text-text-muted" title="Coming soon">
            Correct something
          </span>
        </div>
      </div>

      <section className="mt-12 flex flex-col gap-[22px] lg:mt-0" aria-label="Dossier">
        <div className="flex justify-end">
          <div role="tablist" aria-label="Dossier view" className="flex rounded-[18px] border border-hairline p-[3px]">
            {(['readable', 'raw'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-[14px] px-3.5 py-1.5 text-[13px] leading-4 transition-colors ${
                  mode === m ? 'bg-accent font-medium text-on-accent' : 'text-text-muted hover:text-text'
                }`}
              >
                {m === 'readable' ? 'Readable' : 'Raw JSON'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[14px] leading-5 text-danger">
            {error}
          </p>
        )}

        {mode === 'raw' ? (
          <pre className="overflow-x-auto rounded-card border border-hairline bg-surface p-5 font-mono text-[12px] leading-5 text-text">
            {JSON.stringify(dossier, null, 2)}
          </pre>
        ) : (
          <div className="flex flex-col gap-[22px]">
            {CATEGORIES.map((category) => {
              const facts = dossier.facts.filter((f) => f.category === category);
              if (facts.length === 0) return null;
              return (
                <div key={category}>
                  <h2 className="label border-b border-hairline pb-2.5 text-text-muted">{CATEGORY_LABEL[category]}</h2>
                  <ul>
                    {facts.map((f) => (
                      <DossierRow
                        key={f.id}
                        label={f.label}
                        value={f.value}
                        sources={namesOf(f.sources)}
                        forgetting={forgetting === f.id}
                        onForget={() => forget(f.id)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
            {dossier.patterns.length > 0 && (
              <div>
                <div className="flex justify-between border-b border-dashed border-text/30 pb-2.5">
                  <h2 className="label text-text-muted">Patterns · inferred</h2>
                  <span className="label text-text-muted">Confidence</span>
                </div>
                <ul>
                  {dossier.patterns.map((p) => (
                    <li key={p.id} className="group flex min-h-[52px] items-center gap-4 border-b border-dashed border-text/30 py-2">
                      <span
                        className={`min-w-0 flex-1 font-serif text-row-m text-text-muted lg:text-[24px] lg:leading-7 ${
                          forgetting === p.id ? 'opacity-40' : ''
                        }`}
                      >
                        {p.statement}
                      </span>
                      <ForgetSwap onForget={() => forget(p.id)} forgetting={forgetting === p.id} width="w-[116px]">
                        <span className="hidden h-[3px] w-16 rounded-[2px] bg-hairline sm:flex" aria-hidden>
                          <span className="h-[3px] rounded-[2px] bg-accent" style={{ width: `${Math.round(p.confidence * 100)}%` }} />
                        </span>
                        <span className="w-9 text-right font-mono text-meta text-text">{p.confidence.toFixed(2)}</span>
                      </ForgetSwap>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dossier.facts.length === 0 && dossier.patterns.length === 0 && (
              <p className="border-t border-hairline pt-6 text-body-m text-text lg:text-body">Morrow knows nothing about you yet.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
