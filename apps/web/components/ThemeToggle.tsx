'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_KEY as KEY, type ThemeChoice } from '@/lib/ui/theme';

const NEXT: Record<ThemeChoice, ThemeChoice> = { dark: 'light', light: 'system', system: 'dark' };
const LABEL: Record<ThemeChoice, string> = { dark: 'Dark', light: 'Light', system: 'System' };

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' || v === 'system' ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

const listeners = new Set<(c: ThemeChoice) => void>();

function applyTheme(next: ThemeChoice) {
  const root = document.documentElement;
  if (next === 'system') delete root.dataset.theme;
  else root.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable — the choice lasts for this page only */
  }
  for (const l of listeners) l(next);
}

/** Current theme choice, kept in sync across every switch on the page. */
export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(DEFAULT_THEME);
  useEffect(() => {
    setChoice(read());
    listeners.add(setChoice);
    return () => void listeners.delete(setChoice);
  }, []);
  return [choice, applyTheme];
}

function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      {choice === 'dark' && <path d="M9.8 9.9A4.8 4.8 0 0 1 5.1 2.2a5.3 5.3 0 1 0 6.7 6.7 4.8 4.8 0 0 1-2 1Z" fill="currentColor" />}
      {choice === 'light' && (
        <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
          <circle cx="7" cy="7" r="2.6" fill="none" />
          <path d="M7 .9v1.4M7 11.7v1.4M.9 7h1.4M11.7 7h1.4M2.7 2.7l1 1M10.3 10.3l1 1M2.7 11.3l1-1M10.3 3.7l1-1" />
        </g>
      )}
      {choice === 'system' && (
        <>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** Compact top-bar button: shows the current theme and cycles dark → light → system. */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [choice, apply] = useTheme();
  return (
    <button
      type="button"
      onClick={() => apply(NEXT[choice])}
      className="flex h-6 items-center gap-2 text-text-muted transition-colors hover:text-text-primary"
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[NEXT[choice]]}.`}
      title={`Theme: ${LABEL[choice]} — click for ${LABEL[NEXT[choice]]}`}
    >
      <ThemeIcon choice={choice} />
      {withLabel && <span className="font-mono text-label-sm uppercase">{LABEL[choice]}</span>}
    </button>
  );
}
