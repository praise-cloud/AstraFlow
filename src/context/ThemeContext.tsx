import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getItem as storeGet, setItem as storeSet } from '@/utils/storage';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'astraflow_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    storeGet(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light') {
        setThemeState(stored);
      }
    });
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    storeSet(STORAGE_KEY, t);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
