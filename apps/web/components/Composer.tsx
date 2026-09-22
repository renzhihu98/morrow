'use client';

import Link from 'next/link';
import { useRef, useSyncExternalStore } from 'react';

export type ComposerState = 'idle' | 'typing' | 'waiting' | 'sealed';

type Props = {
  state: ComposerState;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onStop?: () => void;
  /** Question count: renders mono `n of 15 today` (`n/15` under 640px). Preferred over `meta`. */
  count?: { used: number; limit: number };
  /** Legacy free-form meta (desktop). Numerals only — never source names (SPEC §4.A.5). */
  meta?: string;
  /** Legacy compact meta for mobile, e.g. `2/15`. */
  metaCompact?: string;
  placeholder?: string;
  disabled?: boolean;
  sealedMessage?: string;
  /** Sealed-bar action target (default `/`). */
  sealedHref?: string;
};

const ArrowUp = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path d="M9 14V4M4.5 8.5L9 4l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NARROW = '(max-width: 639px)';
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

/** Composer — idle / typing / waiting / sealed (SPEC §4.F, Paper B8E-0 / BE5-0 / C4I-0). No source chips. */
export function Composer({
  state,
  value = '',
  onChange,
  onSubmit,
  onStop,
  count,
  meta,
  metaCompact,
  placeholder = 'Ask Morrow anything about the days ahead',
  disabled = false,
  sealedMessage = 'This reading is sealed. Morrow speaks once a day.',
  sealedHref = '/',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);

  if (state === 'sealed') {
    return (
      <div className="flex min-h-16 items-center gap-3.5 rounded-composer border border-dashed border-hairline py-2.5 pl-5 pr-2.5 lg:pl-6">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0 text-accent">
          <rect x="3.5" y="8" width="11" height="7.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 8 V5.8 a3 3 0 0 1 6 0 V8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="min-w-0 flex-1 text-body-m text-text-muted lg:text-[16px] lg:leading-5">{sealedMessage}</p>
        <Link
          href={sealedHref}
          className="flex h-11 shrink-0 items-center gap-2.5 rounded-[22px] bg-accent pl-5 pr-[18px] text-[15px] font-medium leading-[18px] text-on-accent"
        >
          <span className="hidden sm:inline">Today&apos;s reading</span>
          <span className="sm:hidden">Today</span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M3.5 8 H12 M8.5 4.5 L12 8 L8.5 11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    );
  }

  const waiting = state === 'waiting';
  const canSend = !waiting && !disabled && value.trim().length > 0;
  const wide = count ? `${count.used} of ${count.limit} today` : meta;
  const compact = count ? `${count.used}/${count.limit}` : metaCompact;

  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (canSend) onSubmit?.(value.trim());
  };

  return (
    <form
      onSubmit={submit}
      onClick={() => inputRef.current?.focus()}
      className="flex h-16 items-center gap-3.5 rounded-composer border border-hairline bg-surface pl-5 pr-2.5 lg:pl-6"
    >
      <input
        ref={inputRef}
        value={waiting ? '' : value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(e);
        }}
        placeholder={waiting ? 'Morrow is reading…' : narrow && placeholder.startsWith('Ask Morrow') ? 'Ask Morrow anything' : placeholder}
        disabled={waiting || disabled}
        maxLength={2000}
        aria-label="Ask Morrow"
        className="min-w-0 flex-1 bg-transparent text-body-m text-text caret-accent outline-none placeholder:text-text-muted disabled:cursor-default lg:text-[16px] lg:leading-5"
      />
      {wide && <span className="hidden shrink-0 font-mono text-meta text-text-muted sm:inline">{wide}</span>}
      {compact && <span className="shrink-0 font-mono text-meta text-text-muted sm:hidden">{compact}</span>}
      {waiting ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent"
        >
          <span className="size-3 rounded-[2px] bg-accent" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:cursor-default"
        >
          <ArrowUp />
        </button>
      )}
    </form>
  );
}
