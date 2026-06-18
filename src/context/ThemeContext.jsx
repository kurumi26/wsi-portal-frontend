import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const storageKey = 'wsi-portal-theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    document.documentElement.style.colorScheme = 'light';
    localStorage.setItem(storageKey, 'light');
  }, [theme]);

  const toggleTheme = () => {
    setTheme('light');
  };

  const value = useMemo(
    () => ({
      theme,
      isDarkMode: false,
      setTheme: () => setTheme('light'),
      toggleTheme,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
