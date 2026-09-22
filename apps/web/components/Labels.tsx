import type { ReactNode } from 'react';

/* Sentence-case Geist labels only — no uppercase anywhere; mono only for numerals (SPEC §4.D). */

/** Plain label: Geist 13/16 (12 on mobile), Capers. `tone="accent"` for `Prophecy`-style Oxblood 500. */
export function Label({
  children,
  tone = 'muted',
  className = '',
}: {
  children: ReactNode;
  tone?: 'muted' | 'accent' | 'text';
  className?: string;
}) {
  const color = tone === 'accent' ? 'font-medium text-accent' : tone === 'text' ? 'text-text' : 'text-text-muted';
  return <span className={`label ${color} ${className}`}>{children}</span>;
}

/** Tiny Chartreuse status dot (landed / live / linked). Never carries text. */
export function StatusDot({ size = 6, className = '' }: { size?: number; className?: string }) {
  return <span aria-hidden className={`shrink-0 rounded-full bg-highlight ${className}`} style={{ width: size, height: size }} />;
}

/** Mono numerals: times, `09.30` dates, counts, likelihood. 12/16. */
export function Meta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-meta text-text-muted ${className}`}>{children}</span>;
}

type StatTone = 'fulfilled' | 'open' | 'expired' | 'default';

/**
 * Small label over a serif 40/44 value (Prophecies / Past readings counts, Paper B3N-0).
 * `tone="fulfilled"` (or legacy `accent`) adds the Chartreuse dot; `open` puts the label in Oxblood;
 * `expired` mutes the value.
 */
export function Stat({ label, value, tone, accent = false }: { label: string; value: ReactNode; tone?: StatTone; accent?: boolean }) {
  const t: StatTone = tone ?? (accent ? 'fulfilled' : 'default');
  return (
    <div className="flex flex-col gap-1">
      <span className={`label flex items-center gap-1.5 ${t === 'open' ? 'text-accent' : 'text-text-muted'}`}>
        {t === 'fulfilled' && <StatusDot />}
        {label}
      </span>
      <span className={`font-serif text-[40px] leading-[44px] ${t === 'expired' ? 'text-text-muted' : 'text-text'}`}>{value}</span>
    </div>
  );
}

/** Left-column page intro: serif title (80/80, 52 mobile), body. No eyebrow above it. */
export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col">
      <h1 className="font-serif text-title-m text-text lg:text-title">{title}</h1>
      {children && <div className="max-w-[360px] pt-5 text-body-m text-text-muted lg:text-body">{children}</div>}
    </div>
  );
}

/** Label/value rows with hairline dividers (Sources + Dossier). */
export function KeyValueList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 border-b border-hairline py-3">
          <dt className="label text-text-muted">{r.label}</dt>
          <dd className="label text-right text-text">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
