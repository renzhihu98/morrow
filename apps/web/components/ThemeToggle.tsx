'use client';

import { useEffect, useState } from 'react';

type Choice = 'system' | 'dark' | 'light';
const KEY = 'morrow-theme';
const NEXT: Record<Choice, Choice> = { system: 'dark', dark: 'light', light: 'system' };

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Cycles system → dark → light. Sets `data-theme` on <html>; tokens.css handles the rest. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>('system');
  useEffect(() => setChoice(read()), []);

  const apply = (next: Choice) => {
    setChoice(next);
    const root = document.documentElement;
    if (next === 'system') delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable — the choice lasts for this page only */
    }
  };

  return (
    <button
      type="button"
      onClick={() => apply(NEXT[choice])}
      className="flex size-6 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
      aria-label={`Theme: ${choice}. Switch to ${NEXT[choice]}.`}
      title={`Theme: ${choice}`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
        {choice === 'system' && <path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill="currentColor" />}
        {choice === 'dark' && <circle cx="7" cy="7" r="3" fill="currentColor" />}
      </svg>
    </button>
  );
}
