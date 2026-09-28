import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

function getInitialDark() {
  try {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
  } catch (e) {}
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const value = getInitialDark();
    // Apply synchronously during the first render so there is no theme flash.
    document.documentElement.classList.toggle('dark', value);
    return value;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.backgroundColor = dark ? '#020617' : '#f4f6fb';
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch (e) {}
  }, [dark]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
