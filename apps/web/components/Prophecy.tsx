import { formatProphecyNumber, formatShortDate, windowProgress, type Prophecy, type SourceKind } from '@morrow/core';
import { prophecyFootnote, shortDateOf, sourceName } from '@/lib/ui/format';

/** Likelihood track: 120px, accent fill. */
function Likelihood({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="label text-text-muted">Likelihood</span>
      <span className="flex h-0.5 w-[120px] shrink-0 bg-subtle">
        <span className="h-0.5 bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="font-mono text-label text-text-primary">{value.toFixed(2)}</span>
    </div>
  );
}

/** Prophecy panel inside a reading (screens 02, 05). */
export function ProphecyPanel({ prophecy, timeZone }: { prophecy: Prophecy; timeZone: string }) {
  const fulfilled = prophecy.status === 'fulfilled';
  const right =
    prophecy.status === 'open'
      ? `Window ${shortDateOf(prophecy.windowStart, timeZone)} → ${shortDateOf(prophecy.windowEnd, timeZone)}`
      : `${prophecy.status} ${shortDateOf(prophecy.resolvedAt ?? prophecy.windowEnd, timeZone)}`;
  return (
    <section
      className={`flex w-full flex-col gap-[18px] rounded-panel border bg-panel px-5 py-5 lg:max-w-[680px] lg:px-[26px] lg:py-[22px] ${
        fulfilled ? 'border-accent-border' : 'border-hairline'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="label text-accent">Prophecy {formatProphecyNumber(prophecy.number)}</span>
        <span className={`label text-right ${fulfilled ? 'text-accent' : 'text-text-muted'}`}>{right}</span>
      </div>
      <p className="font-serif text-prophecy-m lg:text-prophecy">{prophecy.statement}</p>
      <div className="flex flex-col gap-3 border-t border-hairline pt-3.5 sm:flex-row sm:items-center sm:justify-between">
        <Likelihood value={prophecy.likelihood} />
        <span className="text-sm leading-5 text-text-secondary">{prophecyFootnote(prophecy)}</span>
      </div>
    </section>
  );
}

/** Window bar: start → end with elapsed fill (freezes at resolution). */
export function WindowBar({ prophecy, now, timeZone }: { prophecy: Prophecy; now: Date; timeZone: string }) {
  const progress = windowProgress(prophecy, now);
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-label-sm text-text-muted">{shortDateOf(prophecy.windowStart, timeZone)}</span>
      <span className="flex h-0.5 min-w-0 flex-1 bg-subtle lg:w-[400px] lg:flex-none" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span className="h-0.5 bg-accent" style={{ width: `${Math.max(progress * 100, progress > 0 ? 1.5 : 0)}%` }} />
      </span>
      <span className="font-mono text-label-sm text-text-muted">{shortDateOf(prophecy.windowEnd, timeZone)}</span>
      <span className="label-sm hidden flex-1 text-right text-text-muted sm:block">Likelihood {prophecy.likelihood.toFixed(2)}</span>
    </div>
  );
}

const watchingLabel = (kinds: SourceKind[]) => `Watching ${kinds.map(sourceName).join(' · ')}`;

/** Open prophecy card (screen 09). */
export function ProphecyCard({ prophecy, now, timeZone }: { prophecy: Prophecy; now: Date; timeZone: string }) {
  const daysLeft = Math.ceil((Date.parse(prophecy.windowEnd) - now.getTime()) / 86_400_000);
  const closingSoon = daysLeft <= 3;
  return (
    <article className="flex flex-col gap-3 rounded-card border border-hairline bg-panel px-5 py-[18px] lg:px-[22px]">
      <div className="flex items-center justify-between gap-4">
        <span className="label-sm text-text-secondary">
          {formatProphecyNumber(prophecy.number)} · From {formatShortDate(prophecy.madeOn)}
        </span>
        <span className={`label-sm text-right ${closingSoon ? 'text-accent' : 'text-text-muted'}`}>
          {closingSoon ? (daysLeft <= 1 ? 'Closes today' : `Closes in ${daysLeft} days`) : watchingLabel(prophecy.watching)}
        </span>
      </div>
      <p className="font-serif text-list-item-m lg:text-list-item">{prophecy.statement}</p>
      <WindowBar prophecy={prophecy} now={now} timeZone={timeZone} />
    </article>
  );
}

/** Resolved row: number, serif title, status. */
export function ResolvedRow({ prophecy, timeZone }: { prophecy: Prophecy; timeZone: string }) {
  const fulfilled = prophecy.status === 'fulfilled';
  return (
    <li className="flex items-center gap-3 border-t border-hairline py-3.5">
      <span className="w-12 shrink-0 font-mono text-label-sm text-text-muted lg:w-[60px]">
        {formatProphecyNumber(prophecy.number)}
      </span>
      <span className={`min-w-0 flex-1 font-serif text-row-m lg:text-[20px] lg:leading-[26px] ${fulfilled ? 'text-text-primary' : 'text-text-secondary'}`}>
        {prophecy.title}
      </span>
      <span className={`label-sm flex shrink-0 items-center justify-end gap-2 text-right lg:w-[190px] ${fulfilled ? 'text-accent' : 'text-text-muted'}`}>
        {fulfilled ? <span className="size-2 rounded-full bg-accent" /> : <span aria-hidden>–</span>}
        <span className="hidden sm:inline">{prophecy.status}</span> {shortDateOf(prophecy.resolvedAt ?? prophecy.windowEnd, timeZone)}
      </span>
    </li>
  );
}
