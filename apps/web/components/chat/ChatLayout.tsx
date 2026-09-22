import type { ReactNode } from 'react';
import { BodyFigure } from '../BodyFigure';

type Props = {
  /** The thread: day divider, messages. */
  children: ReactNode;
  /** Pinned under the thread. */
  composer: ReactNode;
  /**
   * Right column (desktop only, 296 wide): the body figure (Reading / Asking / Answer) or the data rail
   * (Prophecy fulfilled). Omit for a centred 760 thread (Sealed reading).
   */
  aside?: ReactNode;
  /** Thread sits on the composer (live chat) or starts at the top (sealed transcript). */
  anchor?: 'bottom' | 'top';
  /** Above the thread, outside the scrolling messages (Sealed reading header). */
  header?: ReactNode;
};

/**
 * Chat screen frame (SPEC §4.F, Paper B8E-0 / BE5-0 / AST-0 / C1G-0 / C4I-0). At 1440 the thread is
 * 760 wide at x 216–976 with the aside at x 1040–1336; without an aside it's centred (x 340–1100).
 * Under lg the aside is hidden and the thread takes the full width.
 */
export function ChatLayout({ children, composer, aside, anchor = 'bottom', header }: Props) {
  // The page itself never scrolls: nav, figure column and composer stay put; only the thread scrolls.
  const column = (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {header}
      <div className="scrollbar-none -mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1">
        <div className={`flex flex-col gap-5 pb-3 ${anchor === 'bottom' ? 'mt-auto pt-8 lg:pt-4' : 'pt-8'}`}>
          {children}
        </div>
      </div>
      <div className="shrink-0 pb-6 pt-2.5 lg:pb-[30px]">{composer}</div>
    </div>
  );

  if (!aside) {
    return (
      <main className="mx-auto flex h-[calc(100dvh-64px)] w-full max-w-[808px] flex-col overflow-hidden px-6 lg:h-[calc(100dvh-88px)]">
        {column}
      </main>
    );
  }

  return (
    <main className="mx-auto grid h-[calc(100dvh-64px)] w-full max-w-[1440px] grid-cols-1 overflow-hidden px-6 lg:h-[calc(100dvh-88px)] lg:grid-cols-[minmax(0,760px)_296px] lg:gap-16 lg:px-12 xl:pl-[216px] xl:pr-[104px]">
      {column}
      <aside className="hidden h-full min-h-0 pb-[30px] pt-10 lg:flex">{aside}</aside>
    </main>
  );
}

/** Desktop figure column: the body figure, vertically centred, same place on Reading / Asking / Answer. */
export function FigureColumn({ caption }: { caption?: ReactNode }) {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="relative">
        <BodyFigure height={420} />
        {caption && (
          <p className="absolute inset-x-[-40px] top-[373px] text-center text-[12px] leading-4 text-text-muted">{caption}</p>
        )}
      </div>
    </div>
  );
}

/** Prophecy fulfilled data rail: hairline left rule, label, serif line, Foretold / Fulfilled / Record rows. */
export function FulfilledRail({
  label,
  headline,
  rows,
}: {
  label: string;
  headline: string;
  rows: { label: string; value: string; strong?: boolean }[];
}) {
  return (
    <div className="flex h-full w-full flex-col border-l border-hairline pl-10">
      <span className="label text-text-muted">{label}</span>
      <p className="pt-2.5 font-serif text-[28px] leading-8 tracking-[-0.01em] text-text">{headline}</p>
      <dl className="flex flex-col pt-7">
        {rows.map((r) => (
          <div key={r.label} className="flex h-11 items-center justify-between border-t border-hairline last:border-b">
            <dt className="text-[15px] leading-[18px] text-text">{r.label}</dt>
            <dd className={`font-mono text-meta ${r.strong ? 'text-text' : 'text-text-muted'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Follow-up prompts under a Morrow message: plain hairline pills, no icons. */
export function PromptPills({ prompts, onSelect, disabled }: { prompts: string[]; onSelect: (p: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(p)}
          className="flex h-9 items-center rounded-[18px] border border-hairline px-3.5 text-[15px] leading-[18px] text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {p}
        </button>
      ))}
    </div>
  );
}

/** `2026-09-21` → `Monday · September 21` (day dividers, Today's date line). */
export function dayLabel(localDate: string): string {
  const d = new Date(`${localDate}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...o }).format(d);
  return `${f({ weekday: 'long' })} · ${f({ month: 'long', day: 'numeric' })}`;
}
