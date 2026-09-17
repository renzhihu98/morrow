import type { ReactNode } from 'react';

/** `You — 06:51` (muted) / `● Morrow — 06:52` (accent). */
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

/** Small label over a mono value, used for Foretold / Fulfilled / Record stats. */
export function Stat({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-sm text-text-muted">{label}</span>
      <span className={`font-mono text-[15px] leading-5 ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</span>
    </div>
  );
}

/** Left-column page intro: serif title, body. The title says what the page is — no eyebrow above it. */
export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col">
      <h1 className="font-serif text-title-m lg:text-title">{title}</h1>
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
