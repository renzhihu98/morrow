import { alphaColors, colors, type Palette } from '@morrow/tokens';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

type ThemeContextValue = {
  palette: Palette;
  alpha: { accentBorder: string; dangerBorder: string };
  /** Orbit core fill — a step between bg and panel. */
  coreFill: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ThemeContextValue>(
    () => ({ palette: colors, alpha: alphaColors, coreFill: '#FFFFFF' }),
    [],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
