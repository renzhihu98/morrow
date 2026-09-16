import type { ReactNode } from 'react';

/** `YOU — 06:51` (muted) / `● MORROW — 06:52` (accent). */
export function TurnLabel({ who, time, faded = false }: { who: 'you' | 'morrow'; time?: string; faded?: boolean }) {
  const text = `${who === 'you' ? 'You' : 'Morrow'}${time ? ` — ${time}` : ''}`;
  if (who === 'you') return <div className="label text-text-muted">{text}</div>;
  return (
    <div className="flex items-center gap-2">
      {!faded && <span className="size-[5px] shrink-0 rounded-full bg-accent" />}
      <span className="label text-accent">{text}</span>
    </div>
  );
}

/** Mono evidence line: `SOURCE Calendar · 03.04 · 04.22 …`. */
export function EvidenceLine({ label }: { label: string }) {
  return (
    <p className="font-mono text-label tracking-[0.02em] text-text-muted">
      SOURCE <span>{label}</span>
    </p>
  );
}

/** Mono label over a mono value, used for FORETOLD / FULFILLED / RECORD stats. */
export function Stat({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-sm text-text-muted">{label}</span>
      <span className={`font-mono text-[15px] leading-5 ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</span>
    </div>
  );
}

/** Left-column page intro: mono eyebrow, serif title, body. */
export function PageIntro({ eyebrow, title, children }: { eyebrow: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="label text-text-muted">{eyebrow}</div>
      <h1 className="pt-5 font-serif text-title-m lg:pt-6 lg:text-title">{title}</h1>
      {children && <div className="max-w-[330px] pt-5 text-[15px] leading-6 text-text-secondary">{children}</div>}
    </div>
  );
}

/** Label/value rows with hairline dividers (Sources + Dossier left columns). */
export function KeyValueList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between border-b border-hairline py-3">
          <dt className="label-sm text-text-muted">{r.label}</dt>
          <dd className="label-sm text-text-primary">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
