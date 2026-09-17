'use client';

import type { Dossier, DossierCategory } from '@morrow/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sourceName } from '@/lib/ui/format';
import { KeyValueList } from './Labels';

const CATEGORIES: DossierCategory[] = ['rhythms', 'pursuits', 'people', 'places', 'tastes'];

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/** A dossier fact row with a hover/focus "Forget this ×" action. */
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
    <li className="group flex flex-col gap-1 border-t border-hairline py-3.5 sm:flex-row sm:items-center sm:gap-0">
      <span className="label-sm w-40 shrink-0 text-text-muted">{label}</span>
      <span className={`min-w-0 flex-1 font-serif text-row-m lg:text-row ${forgetting ? 'opacity-40' : ''}`}>{value}</span>
      <span className="relative flex shrink-0 justify-end sm:w-[140px]">
        <span className="label-sm text-text-muted group-focus-within:invisible group-hover:invisible">{sources}</span>
        <button
          type="button"
          onClick={onForget}
          disabled={forgetting}
          className="label-sm absolute right-0 top-0 whitespace-nowrap text-accent opacity-0 focus:opacity-100 group-hover:opacity-100"
        >
          {forgetting ? 'Forgetting…' : 'Forget this ×'}
        </button>
      </span>
    </li>
  );
}

/** Dossier (screen 11): Readable / Raw JSON toggle, forget a single fact. */
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
    <main className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-10 lg:grid lg:grid-cols-[340px_minmax(0,760px)] lg:gap-[100px] lg:px-[120px] lg:pt-[72px]">
      <div>
        <Link href="/sources" className="label text-text-secondary transition-colors hover:text-text-primary">
          ← Sources
        </Link>
        <h1 className="pt-10 font-serif text-title-m lg:text-title">Your dossier</h1>
        <p className="max-w-[340px] pt-5 text-[15px] leading-6 text-text-secondary">
          Everything Morrow knows about you. Not your emails or events — only what was distilled from them. Readings come
          from this page alone.
        </p>
        <div className="pt-8">
          <KeyValueList
            rows={[
              { label: 'Observed', value: `${dossier.facts.length} facts` },
              { label: 'Inferred', value: `${dossier.patterns.length} patterns` },
            ]}
          />
        </div>
        <div className="flex gap-6 pt-7 text-[15px] leading-6">
          <button type="button" onClick={() => downloadJson('morrow-dossier.json', dossier)} className="underline underline-offset-4">
            Download JSON
          </button>
          <span className="text-text-muted" title="Coming soon">
            Correct something
          </span>
        </div>
      </div>

      <section className="mt-14 flex flex-col lg:mt-0">
        <div className="flex justify-end pb-6">
          <div role="tablist" aria-label="Dossier view" className="flex rounded-[10px] border border-hairline p-[3px]">
            {(['readable', 'raw'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`label-sm rounded-[7px] px-3 py-2 transition-colors ${
                  mode === m ? 'bg-subtle text-text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {m === 'readable' ? 'Readable' : 'Raw JSON'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="pb-4 text-sm text-danger">{error}</p>}

        {mode === 'raw' ? (
          <pre className="overflow-x-auto rounded-card border border-hairline bg-panel p-5 font-mono text-[12px] leading-5 text-text-secondary">
            {JSON.stringify(dossier, null, 2)}
          </pre>
        ) : (
          <div className="flex flex-col gap-7">
            {CATEGORIES.map((category) => {
              const facts = dossier.facts.filter((f) => f.category === category);
              if (facts.length === 0) return null;
              return (
                <div key={category}>
                  <h2 className="label-sm pb-3 capitalize text-text-muted">{category}</h2>
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
                <div className="flex justify-between pb-3">
                  <h2 className="label-sm text-text-muted">Patterns · inferred</h2>
                  <span className="label-sm text-text-muted">Confidence</span>
                </div>
                <ul className="border-b border-dashed border-hairline-strong">
                  {dossier.patterns.map((p) => (
                    <li key={p.id} className="group flex items-center gap-4 border-t border-dashed border-hairline-strong py-3.5">
                      <span className={`flex-1 font-serif text-row-m text-text-secondary lg:text-row ${forgetting === p.id ? 'opacity-40' : ''}`}>
                        {p.statement}
                      </span>
                      <span className="relative flex w-[110px] shrink-0 justify-end">
                        <span className="font-mono text-label-sm text-text-primary group-focus-within:invisible group-hover:invisible">
                          {p.confidence.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => forget(p.id)}
                          className="label-sm absolute right-0 top-0 whitespace-nowrap text-accent opacity-0 focus:opacity-100 group-hover:opacity-100"
                        >
                          Forget this ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dossier.facts.length === 0 && dossier.patterns.length === 0 && (
              <p className="border-t border-hairline pt-6 text-text-secondary">Morrow knows nothing about you yet.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
