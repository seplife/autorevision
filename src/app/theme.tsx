import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'systeme' | 'clair' | 'sombre';
const STORAGE_KEY = 'rsci.theme';

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'clair' || v === 'sombre' || v === 'systeme') return v;
  } catch {
    /* stockage indisponible (navigation privée…) : préférence par défaut */
  }
  return 'systeme';
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'clair') return 'light';
  if (pref === 'sombre') return 'dark';
  return systemDark ? 'dark' : 'light';
}

interface ThemeValue {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(preference, mq?.matches ?? false);
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [preference]);

  const value = useMemo<ThemeValue>(
    () => ({
      preference,
      setPreference: (p) => {
        setPreferenceState(p);
        try {
          localStorage.setItem(STORAGE_KEY, p);
        } catch {
          /* préférence non mémorisée, sans conséquence */
        }
      },
    }),
    [preference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans ThemeProvider.');
  return ctx;
}
