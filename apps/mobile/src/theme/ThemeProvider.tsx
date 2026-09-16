import AsyncStorage from '@react-native-async-storage/async-storage';
import { alphaColors, colors, type Palette, type ThemeName } from '@morrow/tokens';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | ThemeName;

const STORAGE_KEY = 'morrow.theme';

type ThemeContextValue = {
  name: ThemeName;
  palette: Palette;
  alpha: { accentBorder: string; dangerBorder: string };
  /** Orbit core fill — a step between bg and panel. */
  coreFill: string;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isPreference = (v: unknown): v is ThemePreference => v === 'system' || v === 'dark' || v === 'light';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!cancelled && isPreference(v)) setPreferenceState(v);
      })
      .catch(() => {
        /* storage unavailable — follow the OS */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {
      /* fail-safe: keep in-memory preference */
    });
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((prev) => {
      const next: ThemePreference = prev === 'system' ? 'dark' : prev === 'dark' ? 'light' : 'system';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const name: ThemeName = preference === 'system' ? (scheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      palette: colors[name],
      alpha: alphaColors[name],
      coreFill: name === 'dark' ? '#121418' : '#FFFFFF',
      preference,
      setPreference,
      cyclePreference,
    }),
    [name, preference, setPreference, cyclePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
