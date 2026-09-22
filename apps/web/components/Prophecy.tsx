import { formatShortDate, windowProgress, type Prophecy } from '@morrow/core';
import type { ReactNode } from 'react';
import { prophecyFootnote, shortDateOf } from '@/lib/ui/format';
import { MoonGlyph } from './MoonGlyph';

/* v4 prophecy card + list pieces (SPEC §4.F, Paper B8E-0 / C1G-0 / AXO-0). No serial numbers, no sources. */

/** `fulfilled` → `Fulfilled`: the stored status is a code, the screen wants a word. */
export const statusWord = (status: Prophecy['status']) => status.charAt(0).toUpperCase() + status.slice(1);

/** Moon for a prophecy: open → likelihood phase, resolved → full / new. */
export function ProphecyMoon({ prophecy, size = 20 }: { prophecy: Prophecy; size?: number }) {
  return <MoonGlyph likelihood={prophecy.likelihood} status={prophecy.status} size={size} />;
}

/** `Likelihood` label + Oxblood bar on a hairline track (3px) + mono value. */
export function Likelihood({ value, width = 150, showLabel = true }: { value: number; width?: number; showLabel?: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      {showLabel && <span className="label shrink-0 text-text-muted">Likelihood</span>}
      <span
        className="flex h-[3px] shrink-0 rounded-[2px] bg-hairline"
        style={{ width }}
        role="meter"
        aria-label="Likelihood"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="h-[3px] rounded-[2px] bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="shrink-0 font-mono text-meta text-text">{value.toFixed(2)}</span>
    </div>
  );
}

type PanelProps = {
  prophecy: Prophecy;
  timeZone: string;
  /** Footer line on the right. Defaults to the status footnote ("I'll tell you when it lands."); `false` hides it. */
  footer?: ReactNode | false;
  className?: string;
};

/**
 * Inline prophecy card inside a Morrow message (Reading / Prophecy fulfilled / Sealed).
 * surface + hairline, radius 14, padding 18/24/20. Open → Likelihood bar; fulfilled → Chartreuse `Landed` row.
 */
export function ProphecyPanel({ prophecy, timeZone, footer, className = '' }: PanelProps) {
  const start = shortDateOf(prophecy.windowStart, timeZone);
  const end = shortDateOf(prophecy.windowEnd, timeZone);
  const resolvedOn = shortDateOf(prophecy.resolvedAt ?? prophecy.windowEnd, timeZone);
  const note = footer === false ? null : (footer ?? prophecyFootnote(prophecy));

  return (
    <section
      className={`flex w-full max-w-[620px] flex-col gap-3.5 rounded-card border border-hairline bg-surface px-5 pb-5 pt-[18px] lg:px-6 ${className}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <ProphecyMoon prophecy={prophecy} />
          <span className="label font-medium text-accent">Prophecy</span>
        </div>
        <span className="flex-1 text-right font-mono text-meta text-text-muted">
          Window {start} → {end}
        </span>
      </div>
      <p className="font-serif text-prophecy-m text-text lg:text-prophecy">{prophecy.statement}</p>
      {prophecy.status === 'open' ? (
        <div className="flex flex-col gap-2 pt-0.5 sm:flex-row sm:items-center sm:gap-3.5">
          <Likelihood value={prophecy.likelihood} />
          {note && (
            <span className="font-serif text-[18px] leading-[22px] text-text-muted sm:flex-1 sm:text-right">{note}</span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-hairline pt-3.5 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="flex items-center gap-2.5">
            {prophecy.status === 'fulfilled' && <span className="size-2 shrink-0 rounded-full bg-highlight" />}
            <span className="shrink-0 font-mono text-meta text-text">
              {prophecy.status === 'fulfilled' ? 'Landed' : 'Expired'} {resolvedOn}
            </span>
          </div>
          {note && (
            <span className="font-serif text-[18px] leading-[22px] text-text-muted sm:flex-1 sm:text-right">{note}</span>
          )}
        </div>
      )}
    </section>
  );
}

/** Window bar: mono start → hairline track with elapsed fill → mono end, then `Likelihood 0.58`. */
export function WindowBar({ prophecy, now, timeZone }: { prophecy: Prophecy; now: Date; timeZone: string }) {
  const progress = windowProgress(prophecy, now);
  return (
    <div className="flex items-center gap-3 pt-0.5">
      <span className="shrink-0 font-mono text-meta text-text-muted">{shortDateOf(prophecy.windowStart, timeZone)}</span>
      <span
        className="flex h-[3px] min-w-0 flex-1 rounded-[2px] bg-hairline"
        role="progressbar"
        aria-label="Window elapsed"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="h-[3px] rounded-[2px] bg-accent"
          style={{ width: `${Math.max(progress * 100, progress > 0 ? 1.5 : 0)}%` }}
        />
      </span>
      <span className="shrink-0 font-mono text-meta text-text-muted">{shortDateOf(prophecy.windowEnd, timeZone)}</span>
      <span className="hidden shrink-0 text-right font-mono text-meta text-text sm:block sm:w-[122px]">
        Likelihood {prophecy.likelihood.toFixed(2)}
      </span>
    </div>
  );
}

/** Open prophecy list card (Prophecies page): moon + `From 09.30`, serif statement, window bar. */
export function ProphecyCard({ prophecy, now, timeZone }: { prophecy: Prophecy; now: Date; timeZone: string }) {
  const daysLeft = Math.ceil((Date.parse(prophecy.windowEnd) - now.getTime()) / 86_400_000);
  const closingSoon = daysLeft <= 3;
  return (
    <article className="flex flex-col gap-3 rounded-card border border-hairline bg-surface px-5 py-[18px] lg:px-[22px]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ProphecyMoon prophecy={prophecy} />
          <span className="font-mono text-meta text-text-muted">From {formatShortDate(prophecy.madeOn)}</span>
        </div>
        {closingSoon && (
          <span className="text-right font-mono text-meta text-accent">
            {daysLeft <= 1 ? 'Closes today' : `Closes in ${daysLeft} days`}
          </span>
        )}
      </div>
      <p className="font-serif text-prophecy-m text-text lg:text-prophecy">{prophecy.statement}</p>
      <WindowBar prophecy={prophecy} now={now} timeZone={timeZone} />
      <span className="font-mono text-meta text-text sm:hidden">Likelihood {prophecy.likelihood.toFixed(2)}</span>
    </article>
  );
}

/** Resolved row (hairline list): serif title, mono date, moon + status word. Expired statements are muted. */
export function ResolvedRow({ prophecy, timeZone }: { prophecy: Prophecy; timeZone: string }) {
  const expired = prophecy.status === 'expired';
  return (
    <li className="flex min-h-14 items-center gap-4 border-t border-hairline py-3 sm:gap-6">
      <span className={`min-w-0 flex-1 font-serif text-row-m lg:text-list-item ${expired ? 'text-text-muted' : 'text-text'}`}>
        {prophecy.title}
      </span>
      <span className="hidden w-12 shrink-0 font-mono text-meta text-text-muted sm:block">
        {shortDateOf(prophecy.resolvedAt ?? prophecy.windowEnd, timeZone)}
      </span>
      <span className="flex shrink-0 items-center gap-2 sm:w-[108px]">
        <ProphecyMoon prophecy={prophecy} size={16} />
        <span className="label hidden text-text-muted sm:inline">{statusWord(prophecy.status)}</span>
      </span>
    </li>
  );
}
