/**
 * ThemeContext.tsx
 *
 * Defines the app's light/dark color palettes and exposes them via a React
 * context so any component can read the current theme's colors
 * (`useAppTheme().colors`) and know whether dark mode is active
 * (`useAppTheme().isDark`), without prop-drilling. Also used by
 * `AppNavigator.tsx` to build a matching react-navigation theme so native
 * navigation chrome (headers, tab bar) stays visually consistent with the
 * rest of the app.
 */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';

/** The full set of themeable colors every screen/component draws from
 * instead of hardcoding hex values. */
export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textDim: string;
  primary: string;
  danger: string;
  border: string;
}

const lightColors: ThemeColors = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#333333',
  textDim: '#888888',
  primary: '#007AFF', // Standard iOS Blue
  danger: '#FF3B30',
  border: '#E5E5EA',
};

const darkColors: ThemeColors = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  textDim: '#EBEBF5',
  primary: '#0A84FF',
  danger: '#FF453A',
  border: '#38383A',
};

interface ThemeContextProps {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
});

/**
 * Provides application-wide colors and handles light/dark mode transitions based on system preferences.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initializes from the OS-level color scheme (light/dark) on first
  // render...
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  // Tracks whether the user has manually overridden the theme via
  // `toggleTheme`. Once set, the system-scheme sync effect below backs off
  // and leaves the user's choice alone for the rest of the session.
  const userOverride = useRef(false);

  // ...and keeps following it afterward: if the user changes their device's
  // system theme while the app is open, `isDark` updates to match — unless
  // the user has manually picked a theme via `toggleTheme`, in which case
  // their choice takes precedence over further system changes.
  useEffect(() => {
    if (userOverride.current) return;
    setIsDark(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  // Lets a component (e.g. a settings screen) manually flip the theme,
  // independent of the system setting. Marks the override flag so the
  // effect above stops re-syncing to the OS theme afterward.
  const toggleTheme = () => {
    userOverride.current = true;
    setIsDark(prev => !prev);
  };
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access the current theme colors and toggle functions.
 */
export const useAppTheme = () => useContext(ThemeContext);
