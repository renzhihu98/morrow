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
  /** Right-side mono meta: linked sources (`CAL · SPT`) or `n OF 15 TODAY`. */
  meta?: string;
  /** Compact meta for mobile, e.g. `2/15`. */
  metaCompact?: string;
  placeholder?: string;
  disabled?: boolean;
  sealedMessage?: string;
};

const ArrowUp = ({ className = '' }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={className}>
    <path d="M8 13 V3 M3.5 7.5 L8 3 L12.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NARROW = '(max-width: 639px)';
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

/** Composer — idle / typing / waiting / sealed (SPEC §4.4). */
export function Composer({
  state,
  value = '',
  onChange,
  onSubmit,
  onStop,
  meta,
  metaCompact,
  placeholder = 'Ask Morrow anything about the days ahead',
  disabled = false,
  sealedMessage = 'This reading is sealed. Morrow speaks once a day.',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);

  if (state === 'sealed') {
    return (
      <div className="flex items-center gap-4 rounded-panel border border-dashed border-hairline-strong bg-bg py-3.5 pl-5 pr-3.5 lg:pl-6">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-text-muted">
          <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <p className="flex-1 text-[15px] leading-6 text-text-secondary">{sealedMessage}</p>
        <Link
          href="/"
          className="flex h-10 shrink-0 items-center gap-2.5 rounded-button bg-accent-fill px-4 text-sm font-medium text-on-accent"
        >
          <span className="hidden sm:inline">Today&apos;s reading</span>
          <span className="sm:hidden">Today</span>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M3 7 H11 M7.5 3.5 L11 7 L7.5 10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    );
  }

  const waiting = state === 'waiting';
  const canSend = !waiting && !disabled && value.trim().length > 0;

  const submit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (canSend) onSubmit?.(value.trim());
  };

  return (
    <form
      onSubmit={submit}
      onClick={() => inputRef.current?.focus()}
      className={`flex items-center gap-3 rounded-panel border bg-panel py-3.5 pl-5 pr-3.5 transition-colors lg:gap-[18px] lg:pl-6 ${
        state === 'typing' && !disabled ? 'border-accent-border' : 'border-hairline'
      }`}
    >
      <span className={`shrink-0 font-mono text-base leading-5 ${waiting || disabled ? 'text-text-faint' : 'text-accent'}`} aria-hidden>
        ›
      </span>
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
        className={`min-w-0 flex-1 bg-transparent text-body-m text-text-primary caret-accent outline-none lg:text-body ${
          waiting ? 'placeholder:text-text-faint' : 'placeholder:text-placeholder'
        }`}
      />
      {meta && <span className="hidden shrink-0 font-mono text-label text-text-muted sm:inline">{meta}</span>}
      {metaCompact && <span className="shrink-0 font-mono text-label-sm text-text-muted sm:hidden">{metaCompact}</span>}
      {waiting ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="flex size-10 shrink-0 items-center justify-center rounded-button bg-subtle"
        >
          <span className="size-[11px] rounded-[2px] bg-text-secondary" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="flex size-10 shrink-0 items-center justify-center rounded-button bg-accent-fill text-on-accent disabled:cursor-default"
        >
          <ArrowUp />
        </button>
      )}
    </form>
  );
}
