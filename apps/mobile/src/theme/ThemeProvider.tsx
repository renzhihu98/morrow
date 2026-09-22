import { ball, colors, grain, type Palette } from '@morrow/tokens';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

type ThemeContextValue = {
  /** v4 "Parcel" palette (SPEC §4.B). Light only — there is no theme switching. */
  palette: Palette;
  /** Crystal-ball paint (SPEC §4.E). */
  ball: typeof ball;
  /** Paper-grain parameters (SPEC §4.C). */
  grain: typeof grain;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ThemeContextValue>(() => ({ palette: colors, ball, grain }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
